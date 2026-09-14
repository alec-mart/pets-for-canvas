# canvas-digest backend

Reports in, estimates out. Nothing else (digest/Discord deferred 2026-09-02).

## Run locally

```
.venv/bin/uvicorn backend.app:app --reload --port 8971
```

SQLite file appears at `backend/canvas_digest.db` (gitignored). Point the
extension at it: popup → API URL → `http://localhost:8971`.

## Endpoints

- `GET  /healthz`
- `POST /reports` — one time report; `UNIQUE(device_id, assignment_id)` makes
  it idempotent (`{"status":"duplicate"}` on repeats).
- `GET  /estimates?ids=1,2,3` — `{assignment_id: {bucket, n}}`, median bucket,
  only where n ≥ MIN_N.

## Deploy (Railway)

1. New project → deploy from this repo, root `backend/`, start command
   `uvicorn backend.app:app --host 0.0.0.0 --port $PORT` (run from repo root).
2. Add Postgres plugin → `DATABASE_URL` is injected (postgres:// is handled).
3. Env: `MIN_N=5` (privacy floor), `CORS_ORIGINS=https://mtu.instructure.com`.
4. Put the public URL into the extension popup.
