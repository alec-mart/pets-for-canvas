#!/bin/sh
# Deploy the API to Railway with APP_COMMIT set to the commit being deployed, so GET /version
# can be checked against this repository. Run from a clean, pushed checkout.
set -e
cd "$(dirname "$0")/.."
[ -z "$(git status --porcelain)" ] || { echo "commit or stash first"; exit 1; }
SHA=$(git rev-parse HEAD)
railway variable set "APP_COMMIT=$SHA" --service canvas-digest --skip-deploys
railway up --service canvas-digest --detach
echo "deployed $SHA"
