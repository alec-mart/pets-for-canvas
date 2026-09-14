"""Pets for Canvas API: the coin ledger, feedback, promo codes, and the privacy page. The report and estimate endpoints are legacy; no shipped client calls them.

Run locally:  .venv/bin/uvicorn backend.app:app --reload
Deploy:       set DATABASE_URL (Postgres), MIN_N=5, CORS_ORIGINS.
"""

import os

from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func, insert, select
from sqlalchemy.exc import IntegrityError

from .db import devices, engine, feedback, init_db, reports
from .ledger import _dev_ok, ledgers, promo_codes, promo_redemptions, router as ledger_router
from .social import router as social_router

BUCKETS = ["lt1", "1_3", "3_6", "6_10", "gt10"]
MIN_N = int(os.environ.get("MIN_N", "5"))  # privacy floor — 5 by default; override only for local dev
REPORT_CAP = 60  # reports per device per day

app = FastAPI(title="canvas-digest", docs_url=None, redoc_url=None)
# any Canvas domain: the API is anonymous (no cookies, no credentials, self-minted device ids), so open CORS is safe
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["content-type", "x-dev"],
)


app.include_router(ledger_router)
app.include_router(social_router)


# per-IP rate limit on writes
import time as _time
from collections import defaultdict, deque
from fastapi import Request
from fastapi.responses import JSONResponse
_hits: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def _ratelimit(request: Request, call_next):
    # the LAST x-forwarded-for value is the one the edge proxy appended (a client can prepend fakes, not append);
    # POSTs 240 / 5 min, GETs 600 / 5 min; the table is bounded so header spraying can't grow memory
    xff = request.headers.get("x-forwarded-for", "")
    ip = (xff.split(",")[-1].strip() if xff else (request.client.host if request.client else "?"))[:64]
    limit = 240 if request.method == "POST" else 600
    q = _hits[ip]; now = _time.time()
    while q and now - q[0] > 300:
        q.popleft()
    if len(q) >= limit:
        return JSONResponse({"detail": "slow down"}, status_code=429)
    q.append(now)
    if len(_hits) > 20000:
        for k in list(_hits)[:10000]:
            del _hits[k]
    return await call_next(request)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/privacy-check")
def privacy_check() -> dict:
    return {"policy_present": _PRIVACY_MD.exists()}


class ReportIn(BaseModel):
    device_id: str = Field(min_length=8, max_length=64, pattern="^[A-Za-z0-9]+$")
    host: str = Field(default="mtu.instructure.com", max_length=120)  # the Canvas domain the report came from
    course_id: int
    assignment_id: int
    kind: str = Field(default="assignment", max_length=32)
    bucket: str
    title: str = Field(default="", max_length=300)
    reported_at: str | None = Field(default=None, max_length=40)


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}


class FeedbackIn(BaseModel):
    device_id: str = Field(min_length=8, max_length=64)
    message: str = Field(min_length=3, max_length=2000)
    version: str = Field(default="", max_length=20)
    host: str = Field(default="", max_length=120)


@app.post("/feedback")
def create_feedback(f: FeedbackIn) -> dict:
    """Concerns, suggestions, bugs — from the extension's Settings. Read them in the DB."""
    with engine.begin() as conn:
        conn.execute(insert(feedback).values(
            device_id=f.device_id, message=f.message.strip(), version=f.version, host=f.host.lower().strip(),
        ))
    return {"status": "ok"}


# ---- inbox: feedback plus a pulse (x-dev secret). Read with tools/inbox.py ----
@app.get("/admin/inbox")
def admin_inbox(x_dev: str | None = Header(default=None), limit: int = Query(default=100, ge=1, le=500)) -> dict:
    if not _dev_ok(x_dev):
        raise HTTPException(403, "no")
    from datetime import datetime, timedelta, timezone
    import json as _json
    week = datetime.now(timezone.utc) - timedelta(days=7)
    with engine.begin() as conn:
        fb = conn.execute(select(feedback).order_by(feedback.c.created_at.desc()).limit(limit)).mappings().all()
        n_dev = conn.execute(select(func.count()).select_from(devices)).scalar_one()
        n_dev_wk = conn.execute(select(func.count()).select_from(devices).where(devices.c.created_at >= week)).scalar_one()
        n_rep = conn.execute(select(func.count()).select_from(reports)).scalar_one()
        n_rep_wk = conn.execute(select(func.count()).select_from(reports).where(reports.c.created_at >= week)).scalar_one()
        hosts = conn.execute(
            select(reports.c.host, func.count().label("n")).group_by(reports.c.host).order_by(func.count().desc()).limit(10)
        ).all()
        recent = conn.execute(
            select(reports.c.host, reports.c.bucket, reports.c.kind, reports.c.title, reports.c.created_at)
            .order_by(reports.c.created_at.desc()).limit(30)
        ).mappings().all()
        # installs = ledgers: content.js creates one the first time the extension loads on a Canvas page
        import json as _json
        led = conn.execute(select(ledgers.c.device_id, ledgers.c.state, ledgers.c.created_at, ledgers.c.updated_at)
                           .order_by(ledgers.c.created_at.desc()).limit(50)).all()
        n_led = conn.execute(select(func.count()).select_from(ledgers)).scalar_one()
        n_led_wk = conn.execute(select(func.count()).select_from(ledgers).where(ledgers.c.created_at >= week)).scalar_one()
        # promo cohorts: per code — redemptions by day, and how many of those accounts are still active
        promos = []
        for pc in conn.execute(select(promo_codes)).mappings().all():
            reds = conn.execute(select(promo_redemptions.c.device_id, promo_redemptions.c.at)
                                .where(promo_redemptions.c.code == pc["code"])).all()
            ids = [r[0] for r in reds]
            by_day: dict = {}
            for _, at in reds:
                k = at.date().isoformat() if at else "?"; by_day[k] = by_day.get(k, 0) + 1
            active_7d = adopted = 0
            if ids:
                rows_l = conn.execute(select(ledgers.c.device_id, ledgers.c.state, ledgers.c.updated_at).where(ledgers.c.device_id.in_(ids))).all()
                for _, st, uat in rows_l:
                    if uat and uat.replace(tzinfo=uat.tzinfo or timezone.utc) >= week: active_7d += 1
                    try:
                        if _json.loads(st).get("adopted"): adopted += 1
                    except Exception:
                        pass
            promos.append({"code": pc["code"], "collar": pc["collar"], "used": pc["used"], "cap": pc["cap"], "expires_at": pc["expires_at"].isoformat(),
                           "redeemers": len(ids), "active_7d": active_7d, "adopted": adopted, "by_day": dict(sorted(by_day.items()))})
    iso = lambda d: d.isoformat() if d else None
    installs = []
    for did, st, cat, uat in led:
        try: j = _json.loads(st)
        except Exception: j = {}
        installs.append({"device": did[:8], "device_full": did, "installed": iso(cat), "last_seen": iso(uat), "adopted": bool(j.get("adopted")),
                         "animal": (j.get("equipped") or {}).get("animal"), "balance": j.get("balance", 0), "lifetime": j.get("lifetime", 0)})
    return {
        "pulse": {"installs": n_led, "installs_7d": n_led_wk, "devices": n_dev, "devices_7d": n_dev_wk, "reports": n_rep, "reports_7d": n_rep_wk,
                  "hosts": [{"host": h, "reports": n} for h, n in hosts]},
        "installs": installs,
        "promos": promos,
        "feedback": [{"id": r["id"], "at": iso(r["created_at"]), "device": r["device_id"][:8], "version": r["version"],
                      "host": r["host"], "message": r["message"]} for r in fb],
        "recent_reports": [{"at": iso(r["created_at"]), "host": r["host"], "bucket": r["bucket"], "kind": r["kind"],
                            "title": r["title"][:80]} for r in recent],
    }


# ---- purge test rows (dev secret). Real device ids are 32 hex chars; probes are named ----
class PurgeIn(BaseModel):
    prefixes: list[str] = Field(default_factory=list, max_length=50)
    non_hex: bool = False


@app.post("/admin/purge")
def admin_purge(p: PurgeIn, x_dev: str | None = Header(default=None)) -> dict:
    if not _dev_ok(x_dev):
        raise HTTPException(403, "no")
    import re as _re
    from sqlalchemy import delete, or_
    with engine.begin() as conn:
        ids = {r[0] for r in conn.execute(select(ledgers.c.device_id)).all()}
        ids |= {r[0] for r in conn.execute(select(devices.c.device_id)).all()}
        ids |= {r[0] for r in conn.execute(select(reports.c.device_id)).all()}
        ids |= {r[0] for r in conn.execute(select(feedback.c.device_id)).all()}
        ids |= {r[0] for r in conn.execute(select(promo_redemptions.c.device_id)).all()}
        doomed = sorted(i for i in ids if (p.non_hex and not _re.fullmatch(r"[0-9a-f]{32}", i)) or any(i.startswith(x) for x in p.prefixes if x))
        n = {}
        from .social import presence
        for t in (ledgers, devices, reports, feedback, presence, promo_redemptions):
            if doomed:
                n[t.name] = conn.execute(delete(t).where(t.c.device_id.in_(doomed))).rowcount
    return {"purged": doomed, "rows": n}


# ---- promo codes (dev secret): create / inspect. python3 tools/promo.py handles this. ----
class PromoIn(BaseModel):
    code: str = Field(min_length=4, max_length=24, pattern=r"^[A-Za-z0-9]+$")
    collar: str = Field(min_length=2, max_length=24)
    days: int = Field(default=7, ge=1, le=365)
    cap: int = Field(default=10000, ge=1, le=1000000)
    delete: bool = False


@app.post("/admin/promo")
def admin_promo(p: PromoIn, x_dev: str | None = Header(default=None)) -> dict:
    if not _dev_ok(x_dev):
        raise HTTPException(403, "no")
    from datetime import datetime, timedelta, timezone
    from .ledger import promo_codes
    with engine.begin() as conn:
        conn.execute(promo_codes.delete().where(promo_codes.c.code == p.code.upper()))
        if p.delete:
            conn.execute(promo_redemptions.delete().where(promo_redemptions.c.code == p.code.upper()))
            return {"deleted": p.code.upper()}
        conn.execute(promo_codes.insert().values(code=p.code.upper(), collar=p.collar, cap=p.cap, used=0,
                                                 expires_at=datetime.now(timezone.utc) + timedelta(days=p.days)))
    return {"code": p.code.upper(), "collar": p.collar, "cap": p.cap, "days": p.days}


@app.get("/admin/promo")
def admin_promo_list(x_dev: str | None = Header(default=None)) -> dict:
    if not _dev_ok(x_dev):
        raise HTTPException(403, "no")
    from .ledger import promo_codes
    with engine.begin() as conn:
        rows = conn.execute(select(promo_codes)).mappings().all()
    return {"codes": [{"code": r["code"], "collar": r["collar"], "used": r["used"], "cap": r["cap"], "expires_at": r["expires_at"].isoformat()} for r in rows]}


# The privacy policy the Chrome Web Store listing points at. Source of truth is
# docs/privacy.md; rendered here as plain HTML so the URL is stable and ours.
_PRIVACY_MD = (Path(__file__).resolve().parent.parent / "docs" / "privacy.md")


@app.get("/privacy", response_class=HTMLResponse)
def privacy() -> str:
    import html as _h
    lines = _PRIVACY_MD.read_text().splitlines() if _PRIVACY_MD.exists() else ["# Privacy Policy", "Coming soon."]
    out, in_list = [], False
    for ln in lines:
        if ln.startswith("- "):
            if not in_list: out.append("<ul>"); in_list = True
            out.append(f"<li>{_h.escape(ln[2:])}</li>"); continue
        if in_list: out.append("</ul>"); in_list = False
        if ln.startswith("# "): out.append(f"<h1>{_h.escape(ln[2:])}</h1>")
        elif ln.startswith("## "): out.append(f"<h2>{_h.escape(ln[3:])}</h2>")
        elif ln.startswith("_") and ln.endswith("_"): out.append(f"<p><em>{_h.escape(ln[1:-1])}</em></p>")
        elif ln.strip(): out.append(f"<p>{_h.escape(ln)}</p>")
    if in_list: out.append("</ul>")
    body = "\n".join(out)
    return (
        "<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>Privacy Policy</title>"
        "<style>body{max-width:680px;margin:40px auto;padding:0 20px;font:16px/1.55 -apple-system,Segoe UI,sans-serif;color:#222}"
        "h1{font-size:28px}h2{font-size:19px;margin-top:28px}li{margin:4px 0}</style>"
        f"<body>{body}</body>"
    )


@app.post("/reports")
def create_report(r: ReportIn) -> dict:
    if r.bucket not in BUCKETS:
        raise HTTPException(422, f"bucket must be one of {BUCKETS}")
    with engine.begin() as conn:
        # only a device with a ledger may report, capped per day
        from .ledger import ledgers as _ledgers
        if conn.execute(select(_ledgers.c.device_id).where(_ledgers.c.device_id == r.device_id)).first() is None:
            raise HTTPException(403, "unknown device")
        today_count = conn.execute(
            select(func.count()).select_from(reports).where(
                reports.c.device_id == r.device_id, reports.c.created_at >= func.now() - __import__("datetime").timedelta(days=1)
            )
        ).scalar() or 0
        if today_count >= REPORT_CAP:
            raise HTTPException(429, "daily report cap")
        exists = conn.execute(
            select(devices.c.device_id).where(devices.c.device_id == r.device_id)
        ).first()
        if not exists:
            conn.execute(insert(devices).values(device_id=r.device_id))
        try:
            conn.execute(
                insert(reports).values(
                    device_id=r.device_id,
                    host=r.host.lower().strip(),
                    course_id=r.course_id,
                    assignment_id=r.assignment_id,
                    kind=r.kind,
                    bucket=r.bucket,
                    title=r.title,
                    reported_at=r.reported_at,
                )
            )
        except IntegrityError:
            return {"status": "duplicate"}  # never-ask-twice, server half
    return {"status": "ok"}


@app.get("/estimates")
def get_estimates(
    ids: str = Query(..., description="comma-separated assignment ids"),
    host: str = Query("mtu.instructure.com", max_length=120, description="Canvas domain the ids belong to"),
) -> dict:
    try:
        assignment_ids = [int(x) for x in ids.split(",") if x.strip()][:100]
    except ValueError:
        raise HTTPException(422, "ids must be comma-separated integers")
    out: dict[str, dict] = {}
    with engine.connect() as conn:
        rows = conn.execute(
            select(reports.c.assignment_id, reports.c.bucket).where(
                reports.c.host == host.lower().strip(),
                reports.c.assignment_id.in_(assignment_ids),
            )
        ).all()
    by_assignment: dict[int, list[int]] = {}
    for aid, bucket in rows:
        by_assignment.setdefault(aid, []).append(BUCKETS.index(bucket))
    for aid, indices in by_assignment.items():
        if len(indices) < MIN_N:
            continue
        indices.sort()
        median = indices[len(indices) // 2]
        out[str(aid)] = {"bucket": BUCKETS[median], "n": len(indices)}
    return out
