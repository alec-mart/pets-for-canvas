# backend

FastAPI + SQLAlchemy Core. Postgres on Railway; SQLite locally.

```
.venv/bin/uvicorn backend.app:app --reload --port 8971
```

Env: `DATABASE_URL` (unset = `backend/canvas_digest.db`), `MIN_N`, `CORS_ORIGINS`, `DEV_SECRET`.

## Endpoints

- `GET /healthz`, `GET /privacy`
- `GET /ledger/{device_id}` — the whole game state for one install
- `POST /ledger/{device_id}/earn` — submission / milestone events, deduped and capped per day
- `POST /ledger/{device_id}/spend` — every shop action; prices, ownership, box odds and streak payouts are decided here (`ledger.py`)
- `POST /feedback` — the Settings feedback box
- `/admin/*` — inbox, purge, promo codes; require the `x-dev` header
- `POST /reports`, `GET /estimates` — the time-estimate program removed from the extension in 1.0.5; no shipped client calls them
- `/presence`, `/visitor`, sync codes — for features that are built but not shipped (see the `@strip` blocks in `extension/`)
