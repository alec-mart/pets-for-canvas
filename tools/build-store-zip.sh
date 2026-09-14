#!/bin/sh
# Build the Chrome Web Store package: a clean copy of extension/ with DEV=false,
# no test helpers, no .DS_Store. Output: dist/pets-for-canvas-<version>.zip
set -e
cd "$(dirname "$0")/.."
VER=$(python3 -c "import json; print(json.load(open('extension/manifest.json'))['version'])")
TMP=$(mktemp -d)
cp -R extension "$TMP/pkg"
sed -i '' 's/^const DEV = true;/const DEV = false;/' "$TMP/pkg/popup.js"
grep -q "^const DEV = false;" "$TMP/pkg/popup.js" || { echo "DEV flag not flipped"; exit 1; }
grep -q '^let LEDGER_DEV_SECRET = "";' "$TMP/pkg/network.js" || { echo "dev secret line changed"; exit 1; }
# every fetch( in the package must be in network.js;
# fetch(chrome.runtime.getURL(...)) loads bundled art and is allowed anywhere
for f in "$TMP/pkg"/*.js; do
  [ "$(basename "$f")" = network.js ] && continue
  if grep -n "fetch(" "$f" | grep -v "fetch(chrome.runtime.getURL" ; then echo "network call outside network.js: $f"; exit 1; fi
done
# dormant code never ships: blocks between @strip markers (visits, dev bridge, sync codes)
python3 - "$TMP/pkg" <<'EOF'
import re, sys, pathlib, subprocess
pkg = pathlib.Path(sys.argv[1])
NAMES = ["visits", "dev", "sync"]
for f in list(pkg.glob("*.js")) + list(pkg.glob("*.html")):
    s = f.read_text()
    for n in NAMES:
        s = re.sub(r"/\* @strip:%s \*/[\s\S]*?/\* @/strip:%s \*/\n?" % (n, n), "", s)
        s = re.sub(r"<!-- @strip:%s -->[\s\S]*?<!-- @/strip:%s -->\n?" % (n, n), "", s)
    assert "@strip:" not in s, f"unbalanced strip marker in {f.name}"
    f.write_text(s)
for f in pkg.glob("*.js"):
    subprocess.run(["node", "--check", str(f)], check=True)
EOF
# no comments ship: design notes, names and dates stay in the repo (tools/strip-comments.py; parse-checked below)
python3 tools/strip-comments.py "$TMP/pkg"/*.js "$TMP/pkg"/*.html
for f in "$TMP/pkg"/*.js; do node --check "$f" || { echo "strip broke $f"; exit 1; }; done
grep -q "cd_dev_secret\|LEDGER_DEV_READY" "$TMP/pkg"/*.js && { echo "dev bridge leaked into package"; exit 1; }
grep -rIl -e "Alec" -e "Claude" "$TMP/pkg" --exclude-dir=art --exclude-dir=fonts && { echo "name leak in package"; exit 1; }
find "$TMP/pkg" -name .DS_Store -delete
# build inputs, not runtime files: the Recraft sources (rigs are built from them) and the icon's SVG source
rm -f "$TMP/pkg"/art/*recraft*.svg "$TMP/pkg"/icons/icon.svg "$TMP/pkg"/README.md
mkdir -p dist && rm -f "dist/pets-for-canvas-$VER.zip"
(cd "$TMP/pkg" && zip -qr "$OLDPWD/dist/pets-for-canvas-$VER.zip" .)
rm -rf "$TMP"
echo "store package: dist/pets-for-canvas-$VER.zip (DEV=false)"
shasum -a 256 "dist/pets-for-canvas-$VER.zip"
unzip -p "dist/pets-for-canvas-$VER.zip" popup.js | grep -c "const DEV = false" >/dev/null && echo "verified: no dev helpers"
