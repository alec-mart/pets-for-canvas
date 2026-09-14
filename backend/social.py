"""Visits: classmates' pets wander onto your Canvas page.

Presence: while a Canvas tab is open (and the student opted in) the extension checks in every few
minutes with its campus host and course ids. Rows die after PRESENCE_TTL. The visitor picker is
STRICT about campus: same host only — an MTU student never sees a Michigan State pet. Candidates must
share a course and be online now; rarer pets (animal + worn collar) are weighted to visit more.
What a visitor wears comes from the LEDGER (server-authoritative), never from the client body.
"""
import json
import random
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Integer, String, Table, Text, func, select

from .db import engine, metadata
from .ledger import COLLARS, _load, ledgers, pid_of

router = APIRouter()

presence = Table(
    "presence",
    metadata,
    Column("device_id", String(64), primary_key=True),
    Column("host", String(120), nullable=False),
    Column("courses", Text, nullable=False),        # JSON list of ints
    Column("pet_name", String(18), nullable=False, default=""),
    Column("best_streak", Integer, nullable=False, default=0),   # client-reported (the streak lives in the browser)
    Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now()),
)
PRESENCE_TTL = timedelta(minutes=20)
RARITY_W = {"common": 1, "uncommon": 2, "rare": 4, "epic": 8, "legendary": 16}
ANIMAL_RARITY = {"pup": "common", "animal_pup": "common", "animal_cat": "common", "animal_capy": "epic"}
DEMO_HOSTS = {"mtu.instructure.com"}   # demo visitor until there are other users (client caps demo visits at 1/day)
DEMO = {"demo": True, "nick": "Amart", "animal": "animal_capy", "collar": "aurora", "pet_name": "Capy",
        "showcase": ["aurora", "gold"], "best_streak": 112}

# ---- auto nicks: everyone gets one (safe word lists), changing it costs coins ----
_ADJ = ["Sleepy", "Brave", "Cozy", "Swift", "Lucky", "Sunny", "Mellow", "Clever", "Snowy", "Dusty", "Peppy", "Quiet", "Rusty",
        "Fuzzy", "Zippy", "Jolly", "Mossy", "Misty", "Hazel", "Amber", "Wobbly", "Sneaky", "Bouncy", "Chilly", "Toasty", "Breezy"]
_ANI = ["Otter", "Moose", "Finch", "Badger", "Heron", "Lynx", "Beaver", "Marten", "Loon", "Trout", "Pika", "Wren", "Elk",
        "Fox", "Owl", "Hare", "Newt", "Crane", "Stoat", "Robin", "Bison", "Puffin", "Gecko", "Koala", "Yak", "Panda"]
def gen_nick(device_id: str) -> str:
    import hashlib
    h = hashlib.sha256(device_id.encode()).digest()
    return f"{_ADJ[h[0] % len(_ADJ)]}{_ANI[h[1] % len(_ANI)]}{h[2] % 90 + 10}"

# ---- nicknames: deterministic filter (leetspeak-normalised), 3–14 chars, letters/digits/underscore ----
_BAD = {"fuck", "shit", "cunt", "bitch", "nigger", "nigga", "faggot", "fag", "retard", "whore", "slut", "dick", "cock",
        "pussy", "asshole", "rape", "nazi", "hitler", "kike", "chink", "spic", "tranny", "dyke", "porn", "sex", "penis", "vagina"}
_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i"})
def nick_ok(nick: str) -> bool:
    if not re.fullmatch(r"[A-Za-z0-9_]{3,14}", nick):
        return False
    flat = re.sub(r"[^a-z]", "", nick.lower().translate(_LEET))
    return not any(b in flat for b in _BAD)


class PresenceIn(BaseModel):
    device_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9]+$")
    host: str = Field(min_length=3, max_length=120)
    courses: list[int] = Field(default_factory=list, max_length=40)
    pet_name: str = Field(default="", max_length=18)
    best_streak: int = Field(default=0, ge=0, le=100000)


@router.post("/presence")
def post_presence(p: PresenceIn) -> dict:
    host = p.host.lower().strip()
    with engine.begin() as conn:
        if not conn.execute(select(ledgers.c.device_id).where(ledgers.c.device_id == p.device_id)).first():
            raise HTTPException(403, "no ledger")
        row = {"device_id": p.device_id, "host": host, "courses": json.dumps(sorted(set(p.courses))[:40]),
               "pet_name": p.pet_name.strip()[:18], "best_streak": p.best_streak, "updated_at": datetime.now(timezone.utc)}
        if conn.execute(select(presence.c.device_id).where(presence.c.device_id == p.device_id)).first():
            conn.execute(presence.update().where(presence.c.device_id == p.device_id).values(**row))
        else:
            conn.execute(presence.insert().values(**row))
        conn.execute(presence.delete().where(presence.c.updated_at < datetime.now(timezone.utc) - PRESENCE_TTL * 6))
    return {"status": "ok"}


def _card(conn, device_id: str, row) -> dict:
    s = _load(conn, device_id)
    eq = s.get("equipped") or {}
    owned_collars = [k[7:] for k in s.get("owned", []) if k.startswith("collar_")]
    showcase = s.get("showcase") or sorted(owned_collars, key=lambda c: -RARITY_W[COLLARS.get(c, ("common",))[0]])[:2]
    return {"pid": s.get("pid") or pid_of(device_id), "nick": s.get("nick") or "", "animal": eq.get("animal") or "pup", "collar": eq.get("collar") or "coral",
            "pet_name": row.pet_name or "", "showcase": showcase[:2], "best_streak": int(row.best_streak or 0)}


@router.get("/visitor")
def get_visitor(device_id: str = Query(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9]+$"),
                host: str = Query(min_length=3, max_length=120),
                courses: str = Query(default="", max_length=600)) -> dict:
    host = host.lower().strip()
    mine = {int(c) for c in courses.split(",") if c.strip().isdigit()}
    cutoff = datetime.now(timezone.utc) - PRESENCE_TTL
    with engine.begin() as conn:
        me = _load(conn, device_id)
        friends = set(me.get("friends", []))
        rows = conn.execute(select(presence).where(presence.c.host == host, presence.c.updated_at >= cutoff,
                                                   presence.c.device_id != device_id)).all()
        pool = []
        for r in rows:
            theirs = set(json.loads(r.courses or "[]"))
            is_friend = r.device_id in friends
            if not (theirs & mine) and not is_friend:
                continue
            s = _load(conn, r.device_id)
            eq = s.get("equipped") or {}
            w = RARITY_W[ANIMAL_RARITY.get(eq.get("animal") or "pup", "common")] + RARITY_W[COLLARS.get(eq.get("collar") or "coral", ("common",))[0]]
            if is_friend: w *= 6
            pool.append((w, r))
        if pool:
            total = sum(w for w, _ in pool); pick = random.uniform(0, total)
            for w, r in pool:
                pick -= w
                if pick <= 0:
                    return {"visitor": _card(conn, r.device_id, r)}
            return {"visitor": _card(conn, pool[-1][1].device_id, pool[-1][1])}
    if host in DEMO_HOSTS:
        return {"visitor": dict(DEMO)}
    return {"visitor": None}
