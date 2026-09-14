# Store screenshots rig

The popup can't be captured from chrome-extension:// pages, so this renders the REAL popup in headless Chrome
with faked extension APIs and a seeded state, inside a 1280×800 marketing frame.

1. Copy `extension/` to a scratch dir as `ext/`, drop `shim.js` in it, and make `ext/shot.html` = popup.html with
   `<script src="shim.js"></script>` inserted before the first script tag.
2. Serve the scratch dir: `python3 -m http.server 8765 --bind 127.0.0.1`.
3. Capture: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
   --window-size=1280,800 --force-device-scale-factor=2 --virtual-time-budget=20000 --screenshot=out.png \
   "http://127.0.0.1:8765/frame.html?state=home&h=Pets%3Csmall%3Efor%20Canvas%3C%2Fsmall%3E&t=<tagline>"`
   states: home | shop | wardrobe | claim. `frame2.html?t=` wraps `page.jpg` (a real Canvas capture) in a browser window.
4. `sips -z 800 1280 out.png` → exact store size.
Headline/tagline text in the frames is Alec's — never invent it (no-unrequested-copy rule).
