"""The economy ledger. Every coin, collar, animal, box roll, rename and streak payout is decided
here, keyed by the anonymous device id; the extension only asks. Earning is deduped per key and
capped per device per day, so a forged request is bounded to one person's own cosmetics.
"""
import hmac
import json
import os
import random
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Integer, String, Table, Text, func, insert, select, update

from .db import engine, metadata

ledgers = Table(
    "ledgers",
    metadata,
    Column("device_id", String(64), primary_key=True),
    Column("state", Text, nullable=False),
    Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now()),
    Column("seen_at", DateTime(timezone=True)),
    Column("created_at", DateTime(timezone=True), server_default=func.now()),
)
# sync codes: a short-lived, one-time code that lets another install adopt this ledger
# (second laptop, reinstall). The device id itself never has to be typed or shared.
sync_codes = Table(
    "sync_codes",
    metadata,
    Column("code", String(12), primary_key=True),
    Column("device_id", String(64), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
)
SYNC_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # no 0/O/1/I
# public player ids: what a card exposes instead of the device secret. pid → device lookup table.
pids = Table("pids", metadata, Column("pid", String(16), primary_key=True), Column("device_id", String(64), nullable=False))
def pid_of(device_id: str) -> str:
    import hashlib
    return hashlib.sha256(("pid:" + device_id).encode()).hexdigest()[:12]
FRIENDS_CAP = 30
# promo codes (launch week): a code grants a collar once per ledger, until it expires or its cap is hit
promo_codes = Table("promo_codes", metadata,
    Column("code", String(24), primary_key=True), Column("collar", String(24), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False), Column("cap", Integer, nullable=False),
    Column("used", Integer, nullable=False, default=0))
# who redeemed what, when — the launch cohort for retention metrics (tools/inbox.py)
promo_redemptions = Table("promo_redemptions", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True), Column("code", String(24), nullable=False),
    Column("device_id", String(64), nullable=False), Column("at", DateTime(timezone=True), server_default=func.now()))
def _public(state: dict) -> dict:
    """What leaves the server: never another player's device id (friends become pids), no burst counters."""
    out = dict(state)
    out["friends"] = [pid_of(f) for f in state.get("friends", [])]
    out.pop("minute", None)
    return out
SYNC_TTL_S = 600
RETRO_CAP_DAYS = 30           # the client's welcome streak credit — a milestone beyond age+cap is a forgery
EARNS_PER_MINUTE = 12

router = APIRouter(prefix="/ledger")

# ── rules ──
SUBMISSION_POINTS, VISIT_POINTS = 5, 10
BOX_EVERY = 5                 # a free clothing box on the first submission, then every fifth   # visit: tapping a classmate's visiting pet
MILESTONE_POINTS = {7: 15, 10: 25, 25: 100, 30: 120, 50: 300, 75: 500, 100: 1000, 150: 1500, 200: 2000, 365: 4000}
EARN_MUL = {"gold": 1.15}            # worn-collar rate: legendary only
ADOPTION_GIFT, RENAME_COST, NICK_COST = 40, 100, 100
# newcomer streak reward (once per device): 3/day for the first 30 days, then 2/day up to day 250.
# The number is client-reported, so the ceiling bounds the exposure.
WELCOME_FIRST_DAYS, WELCOME_FIRST_RATE, WELCOME_LATER_RATE, WELCOME_MAX_DAYS = 30, 3, 2, 250
def welcome_coins(days: int) -> int:
    days = max(0, min(int(days), WELCOME_MAX_DAYS))
    return min(days, WELCOME_FIRST_DAYS) * WELCOME_FIRST_RATE + max(0, days - WELCOME_FIRST_DAYS) * WELCOME_LATER_RATE
DAILY_CAPS = {"submission": 40, "visit": 4}
COLLARS = {  # id → (rarity, direct price or None = box only)
    "coral": ("common", 0), "sky": ("common", 60), "mint": ("common", 60), "lilac": ("common", 60), "slate": ("common", 60),
    "sunset": ("uncommon", None), "forest": ("uncommon", None), "berry": ("uncommon", None), "denim": ("uncommon", None),
    "midnight": ("rare", None), "rose": ("rare", None), "candy": ("rare", None), "tiger": ("rare", None), "ocean": ("rare", None),
    "aurora": ("epic", None), "ember": ("epic", None), "frost": ("epic", None), "comet": ("epic", None),
    "gold": ("legendary", None),
    "scroll": ("rare", None),   # launch-week promo collar: redeem code only, never in the box
}
PLUS_ONLY = {"comet", "scroll"}      # never drops: comet is granted with Plus, scroll only by launch code
ANIMALS = {"animal_pup": 300, "animal_cat": 300, "animal_capy": 2000}
REQUIRES = {"animal_capy": 100}   # the EARNED summit: the 100-day milestone unlocks the right to buy, coins still pay
STARTERS = {"animal_pup", "animal_cat"}
BOX_PRICE = 120
BOX_ODDS = [("common", 0.585), ("uncommon", 0.25), ("rare", 0.10), ("epic", 0.05), ("legendary", 0.015)]
TIER_COINS = {"common": 40, "uncommon": 80, "rare": 150, "epic": 300, "legendary": 600}
BOX_DISCOUNT = {"aurora": 30}

DEFAULT = {
    "balance": 0, "lifetime": 0, "paid": {}, "milestones_paid": {},
    "owned": ["collar_coral"], "equipped": {"collar": "coral"}, "names": {}, "free_boxes": 0, "first_box": 0, "adopted": 0, "welcome_claimed": 0,
    "milestones_pending": [],
    "day": "", "day_counts": {},
}


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _load(conn, device_id: str) -> dict:
    row = conn.execute(select(ledgers.c.state, ledgers.c.created_at).where(ledgers.c.device_id == device_id).with_for_update()).first()
    if row is None:
        try:
            conn.execute(insert(ledgers).values(device_id=device_id, state=json.dumps(DEFAULT)))
        except Exception:  # two first requests raced: the other one created it — read it
            pass
        row = conn.execute(select(ledgers.c.state, ledgers.c.created_at).where(ledgers.c.device_id == device_id).with_for_update()).first()
    state = {**json.loads(json.dumps(DEFAULT)), **json.loads(row[0])}
    created = row[1]
    state["_age_days"] = max(0, (datetime.now(timezone.utc) - created.replace(tzinfo=created.tzinfo or timezone.utc)).days) if created else 0
    if state["day"] != _today():
        state["day"], state["day_counts"] = _today(), {}
    if not state.get("nick"):
        from .social import gen_nick
        state["nick"] = gen_nick(device_id)
    if not state.get("pid"):
        state["pid"] = pid_of(device_id)
        try:
            conn.execute(insert(pids).values(pid=state["pid"], device_id=device_id))
        except Exception:
            pass
    return state


def _seen(conn, device_id: str, state: dict | None = None) -> None:
    # seen_at for "active now"; days_seen (dates only, capped) for retention
    values = {"seen_at": func.now()}
    if state is not None:
        today = _today()
        days = state.setdefault("days_seen", [])
        if today not in days:
            days.append(today); del days[:-400]
            values["state"] = json.dumps({k: v for k, v in state.items() if not k.startswith("_")})
    conn.execute(update(ledgers).where(ledgers.c.device_id == device_id).values(**values))


def _save(conn, device_id: str, state: dict) -> None:
    state = {k: v for k, v in state.items() if not k.startswith("_")}
    conn.execute(update(ledgers).where(ledgers.c.device_id == device_id).values(state=json.dumps(state)))


def _dev_ok(x_dev: str | None) -> bool:
    secret = os.environ.get("DEV_SECRET", "")
    return bool(secret) and bool(x_dev) and hmac.compare_digest(x_dev, secret)


class EarnIn(BaseModel):
    type: str = Field(pattern="^(submission|milestone|visit)$")
    key: str = Field(min_length=1, max_length=120)


class SpendIn(BaseModel):
    action: str = Field(pattern="^(equip_collar|equip_animal|buy_collar|adopt|adopt_starter|rename|open_box|claim_streak|dev_grant|set_nick|set_showcase|add_friend|remove_friend|redeem)$")
    days: int | None = Field(default=None, ge=0, le=100000)
    id: str | None = Field(default=None, max_length=40)
    key: str | None = Field(default=None, max_length=40)
    name: str | None = Field(default=None, max_length=18)
    force: str | None = Field(default=None, max_length=12)


@router.get("/{device_id}")
def get_ledger(device_id: str, pet: str | None = Query(default=None, pattern="^[01]$")) -> dict:
    _check_id(device_id)
    with engine.begin() as conn:
        state = _load(conn, device_id)
        if pet is not None:
            state["pet_on"] = pet == "1"
        _seen(conn, device_id, state)
        _save(conn, device_id, state)
        info = []
        for f in state.get("friends", [])[:FRIENDS_CAP]:
            fs = _load(conn, f)
            info.append({"pid": fs.get("pid"), "nick": fs.get("nick"), "animal": (fs.get("equipped") or {}).get("animal") or "pup"})
    state = _public(state); state["friends_info"] = info
    return {"state": state}


class ClaimIn(BaseModel):
    code: str = Field(min_length=4, max_length=12)


@router.post("/claim")
def claim_code(c: ClaimIn) -> dict:
    """Adopt the ledger behind a sync code. One-time; the code dies on use or after SYNC_TTL_S."""
    from datetime import datetime, timezone
    from sqlalchemy import delete
    code = c.code.strip().upper().replace("-", "")
    now = datetime.now(timezone.utc)
    with engine.begin() as conn:
        conn.execute(delete(sync_codes).where(sync_codes.c.expires_at < now))
        row = conn.execute(select(sync_codes.c.device_id).where(sync_codes.c.code == code)).first()
        if not row:
            raise HTTPException(404, "no such code")
        conn.execute(delete(sync_codes).where(sync_codes.c.code == code))
        state = _load(conn, row[0])
    return {"device_id": row[0], "state": _public(state)}


@router.post("/{device_id}/code")
def make_code(device_id: str) -> dict:
    """Mint a sync code for this ledger (replaces any earlier one)."""
    import secrets
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import delete
    _check_id(device_id)
    with engine.begin() as conn:
        if not conn.execute(select(ledgers.c.device_id).where(ledgers.c.device_id == device_id)).first():
            raise HTTPException(404, "no ledger")
        conn.execute(delete(sync_codes).where(sync_codes.c.device_id == device_id))
        code = "".join(secrets.choice(SYNC_ALPHABET) for _ in range(8))
        conn.execute(insert(sync_codes).values(code=code, device_id=device_id,
                                               expires_at=datetime.now(timezone.utc) + timedelta(seconds=SYNC_TTL_S)))
    return {"code": f"{code[:4]}-{code[4:]}", "expires_in": SYNC_TTL_S}


@router.post("/{device_id}/earn")
def earn(device_id: str, e: EarnIn) -> dict:
    _check_id(device_id)
    with engine.begin() as conn:
        s = _load(conn, device_id)
        _seen(conn, device_id, s)
        pts = 0
        # a burst guard: no client earns more than EARNS_PER_MINUTE events a minute
        minute = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")
        mc = s.setdefault("minute", {"m": minute, "n": 0})
        if mc.get("m") != minute:
            mc["m"], mc["n"] = minute, 0
        if mc["n"] >= EARNS_PER_MINUTE:
            _save(conn, device_id, s)
            return {"state": _public(s), "awarded": 0}
        mc["n"] += 1
        box_earned = False
        if e.type == "submission":
            if e.key not in s["paid"] and s["day_counts"].get("submission", 0) < DAILY_CAPS["submission"]:
                s["paid"][e.key] = _today(); s["day_counts"]["submission"] = s["day_counts"].get("submission", 0) + 1
                pts = SUBMISSION_POINTS
                n = s["submissions"] = s.get("submissions", 0) + 1
                if n == 1 or n % BOX_EVERY == 0:
                    s["free_boxes"] = s.get("free_boxes", 0) + 1
                    box_earned = True
        elif e.type == "visit":
            if e.key not in s["paid"] and s["day_counts"].get("visit", 0) < DAILY_CAPS["visit"]:
                s["paid"][e.key] = _today(); s["day_counts"]["visit"] = s["day_counts"].get("visit", 0) + 1
                pts = VISIT_POINTS
        elif e.type == "milestone":
            # streak payouts are claimed: a reached milestone goes pending and Claim pays it
            m = e.key
            reachable = s.get("_age_days", 0) + RETRO_CAP_DAYS
            pending = s.setdefault("milestones_pending", [])
            if m in {str(k) for k in MILESTONE_POINTS} and m not in s["milestones_paid"] and m not in pending and int(m) <= reachable:
                pending.append(m)
        mul = EARN_MUL.get(s["equipped"].get("collar"), 1)
        pts = round(pts * mul)
        s["balance"] += pts; s["lifetime"] += pts
        _save(conn, device_id, s)
    return {"state": _public(s), "awarded": pts, "box_earned": box_earned}


def _roll_tier(force: str | None) -> str:
    if force in TIER_COINS:
        return force
    r = random.random()
    for tier, p in BOX_ODDS:
        if r < p:
            return tier
        r -= p
    return "common"


@router.post("/{device_id}/spend")
def spend(device_id: str, sp: SpendIn, x_dev: str | None = Header(default=None)) -> dict:
    _check_id(device_id)
    with engine.begin() as conn:
        s = _load(conn, device_id)
        _seen(conn, device_id, s)
        result: dict = {}
        a = sp.action
        if a == "equip_collar":
            if f"collar_{sp.id}" not in s["owned"]:
                raise HTTPException(409, "not owned")
            s["equipped"]["collar"] = sp.id
        elif a == "equip_animal":
            key = "animal_pup" if sp.key == "pup" else sp.key
            if key not in s["owned"]:
                raise HTTPException(409, "not owned")
            s["equipped"]["animal"] = "pup" if key == "animal_pup" else key
        elif a == "buy_collar":
            rarity, price = COLLARS.get(sp.id or "", (None, None))
            if price is None:
                raise HTTPException(409, "not for sale")
            if f"collar_{sp.id}" in s["owned"]:
                raise HTTPException(409, "already owned")
            if s["balance"] < price:
                raise HTTPException(409, "not enough coins")
            s["balance"] -= price; s["owned"].append(f"collar_{sp.id}")
            result = {"bought": sp.id}
        elif a == "adopt":
            price = ANIMALS.get(sp.key or "")
            if price is None:
                raise HTTPException(409, "unknown animal")
            if sp.key in s["owned"]:
                raise HTTPException(409, "already owned")
            if sp.key in REQUIRES and str(REQUIRES[sp.key]) not in s["milestones_paid"]:
                raise HTTPException(409, "locked")
            if s["balance"] < price:
                raise HTTPException(409, "not enough coins")
            s["balance"] -= price; s["owned"].append(sp.key)
        elif a == "adopt_starter":
            if s.get("adopted") or sp.key not in STARTERS:
                raise HTTPException(409, "already adopted")
            s["adopted"] = int(datetime.now(timezone.utc).timestamp() * 1000)
            s["balance"] += ADOPTION_GIFT; s["lifetime"] += ADOPTION_GIFT
            s["first_box"] = 1  # the tour's box
            s["owned"].append(sp.key); s["equipped"]["animal"] = "pup" if sp.key == "animal_pup" else sp.key
        elif a == "rename":
            name = (sp.name or "").strip()
            if not name or not sp.key:
                raise HTTPException(422, "name required")
            if s["names"].get(sp.key):
                if s["balance"] < RENAME_COST:
                    raise HTTPException(409, "not enough coins")
                s["balance"] -= RENAME_COST
            s["names"][sp.key] = name
        elif a == "open_box":
            worn = s["equipped"].get("collar")
            price = max(0, BOX_PRICE - BOX_DISCOUNT.get(worn, 0))
            if s.get("first_box", 0) > 0:
                s["first_box"] -= 1
            elif s.get("free_boxes", 0) > 0:
                s["free_boxes"] -= 1
            elif s["balance"] >= price:
                s["balance"] -= price
            else:
                raise HTTPException(409, "not enough coins")
            tier = _roll_tier(sp.force if _dev_ok(x_dev) else None)
            pool = [cid for cid, (r, _) in COLLARS.items() if r == tier and cid not in PLUS_ONLY and f"collar_{cid}" not in s["owned"]]
            if pool:
                pick = random.choice(pool)
                s["owned"].append(f"collar_{pick}")
                result = {"tier": tier, "collar": pick}
            else:
                coins = TIER_COINS[tier]
                s["balance"] += coins; s["lifetime"] += coins
                result = {"tier": tier, "coins": coins}
        elif a == "claim_streak":
            # everything the streak owes, in one tap: the newcomer reward (once) + every pending milestone
            coins, parts = 0, []
            if not s.get("welcome_claimed"):
                days = max(0, min(int(sp.days or 0), WELCOME_MAX_DAYS))
                if days >= 1:
                    wc = welcome_coins(days)
                    coins += wc; parts.append({"kind": "welcome", "days": days, "coins": wc})
                    s["welcome_claimed"] = int(datetime.now(timezone.utc).timestamp() * 1000)
            mul = EARN_MUL.get(s["equipped"].get("collar"), 1)
            for m in list(s.get("milestones_pending", [])):
                pts = round(MILESTONE_POINTS[int(m)] * mul)
                coins += pts; parts.append({"kind": "milestone", "days": int(m), "coins": pts})
                s["milestones_paid"][m] = _today()
                if m == "7":
                    s["free_boxes"] = s.get("free_boxes", 0) + 1
            s["milestones_pending"] = []
            if not parts:
                raise HTTPException(409, "nothing to claim")
            s["balance"] += coins; s["lifetime"] += coins
            result = {"coins": coins, "parts": parts}
        elif a == "set_nick":
            from .social import nick_ok
            nick = (sp.name or "").strip()
            if not nick_ok(nick):
                raise HTTPException(409, "bad nick")
            if nick == s.get("nick"):
                raise HTTPException(409, "same nick")
            if s["balance"] < NICK_COST:
                raise HTTPException(409, "not enough coins")
            s["balance"] -= NICK_COST
            s["nick"] = nick
            result = {"nick": nick}
        elif a == "add_friend":
            row = conn.execute(select(pids.c.device_id).where(pids.c.pid == (sp.id or ""))).first()
            if not row or row[0] == device_id:
                raise HTTPException(409, "unknown player")
            friends = s.setdefault("friends", [])
            if row[0] not in friends:
                if len(friends) >= FRIENDS_CAP:
                    raise HTTPException(409, "friends full")
                friends.append(row[0])
            result = {"friends": len(friends)}
        elif a == "remove_friend":
            row = conn.execute(select(pids.c.device_id).where(pids.c.pid == (sp.id or ""))).first()
            if row: s["friends"] = [f for f in s.get("friends", []) if f != row[0]]
        elif a == "redeem":
            code = (sp.id or "").strip().upper()
            row = conn.execute(select(promo_codes).where(promo_codes.c.code == code).with_for_update()).first()
            now = datetime.now(timezone.utc)
            if not row or row.expires_at.replace(tzinfo=row.expires_at.tzinfo or timezone.utc) < now or row.used >= row.cap:
                raise HTTPException(409, "no such code")
            if code in s.setdefault("promos", []) or f"collar_{row.collar}" in s["owned"]:
                raise HTTPException(409, "already redeemed")
            conn.execute(update(promo_codes).where(promo_codes.c.code == code).values(used=row.used + 1))
            conn.execute(insert(promo_redemptions).values(code=code, device_id=device_id))
            s["promos"].append(code); s["owned"].append(f"collar_{row.collar}")
            result = {"collar": row.collar}
        elif a == "set_showcase":
            ids = [x for x in (sp.id or "").split(",") if f"collar_{x}" in s["owned"]][:2]
            s["showcase"] = ids
        elif a == "dev_grant":
            if not _dev_ok(x_dev):
                raise HTTPException(403, "no")
            s["free_boxes"] = s.get("free_boxes", 0) + 6; s["balance"] += 500; s["lifetime"] += 500
        _save(conn, device_id, s)
    return {"state": _public(s), "result": result}


def _check_id(device_id: str) -> None:
    if not (8 <= len(device_id) <= 64) or not device_id.isalnum():
        raise HTTPException(422, "bad device id")
