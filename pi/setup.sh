#!/usr/bin/env bash
#
# Turns a fresh Raspberry Pi OS (Bookworm, 64-bit) into an arcade handheld:
# both games on local disk, served from localhost, Chromium booting straight
# into them full screen.
#
#   curl -fsSL https://raw.githubusercontent.com/JTPetrotech/jtpetrotech.github.io/main/pi/setup.sh | bash
#
# or clone the repo and run ./pi/setup.sh
#
# Safe to run more than once. It does not touch anything outside ~/arcade and
# a handful of autostart files.

set -euo pipefail

ARCADE="$HOME/arcade"
PORT=8080
GAMES=(
  "top-shelf|https://github.com/JTPetrotech/top-shelf.git|Top Shelf|3D hockey"
  "poker-pages|https://github.com/JTPetrotech/poker-pages.git|Side Pot|Texas Hold'em"
)

say(){ printf '\n\033[1;33m==>\033[0m %s\n' "$1"; }

# ---------------------------------------------------------------- sanity ----
if ! grep -qi 'raspbian\|raspberry pi os\|debian' /etc/os-release 2>/dev/null; then
  echo "This expects Raspberry Pi OS. Carrying on, but you are off the map." >&2
fi

MODEL="$(tr -d '\0' < /proc/device-tree/model 2>/dev/null || echo unknown)"
say "Building the arcade on: $MODEL"
case "$MODEL" in
  *"Pi 5"*|*"Pi 4"*|*"Pi 500"*) ;;
  *) echo "    Warning: a Pi 4 or 5 is wanted here. WebGL will crawl on anything older." >&2 ;;
esac

# ------------------------------------------------------------- packages ----
say "Installing packages"
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends \
  chromium-browser git python3 unclutter-xfixes >/dev/null 2>&1 \
  || sudo apt-get install -y --no-install-recommends chromium git python3

# ---------------------------------------------------------------- games ----
mkdir -p "$ARCADE"
for entry in "${GAMES[@]}"; do
  IFS='|' read -r dir url name _ <<< "$entry"
  if [ -d "$ARCADE/$dir/.git" ]; then
    say "Updating $name"
    git -C "$ARCADE/$dir" pull --quiet --ff-only || echo "    (no network; keeping the copy on disk)"
  else
    say "Fetching $name"
    git clone --depth 1 --quiet "$url" "$ARCADE/$dir" \
      || { echo "    Could not fetch $name. Check the network and run this again." >&2; }
  fi
done

# ------------------------------------------------------- the local hub -----
# The published hub points at github.io. On the console we want local copies,
# so the thing works with no network at all.
say "Writing the local hub"
HUB_SRC=""
for candidate in "$(dirname "$0")/../index.html" "$ARCADE/hub/index.html"; do
  [ -f "$candidate" ] && { HUB_SRC="$candidate"; break; }
done

# Piped through curl there is no local copy to find, so fetch the published one.
if [ -z "$HUB_SRC" ]; then
  if curl -fsSL -o "$ARCADE/.hub-src.html" \
       "https://jtpetrotech.github.io/" 2>/dev/null \
     && grep -q 'class="game"' "$ARCADE/.hub-src.html"; then
    HUB_SRC="$ARCADE/.hub-src.html"
    echo "    pulled the published hub"
  fi
fi

if [ -n "$HUB_SRC" ]; then
  python3 - "$HUB_SRC" "$ARCADE/index.html" <<'PY'
import sys, pathlib
src, out = sys.argv[1], sys.argv[2]
html = pathlib.Path(src).read_text(encoding='utf-8')
html = html.replace('https://jtpetrotech.github.io/top-shelf/', '/top-shelf/')
html = html.replace('https://jtpetrotech.github.io/poker-pages/', '/poker-pages/')
html = html.replace('once a page has loaded it keeps working with no signal',
                    'everything here is on this device already')
pathlib.Path(out).write_text(html, encoding='utf-8')
print('    hub rewritten to local paths')
PY
else
  echo "    No hub source found; writing a plain one."
  cat > "$ARCADE/index.html" <<'HTML'
<!DOCTYPE html><html><head><meta charset="utf-8"><title>The Arcade</title>
<style>body{background:#05080d;color:#e9f0f8;font:16px system-ui;display:grid;
place-items:center;height:100vh;margin:0;gap:18px}a{color:#ffc43d;font-size:28px}</style>
</head><body><h1>The Arcade</h1>
<a href="/top-shelf/">Top Shelf</a><a href="/poker-pages/">Side Pot</a></body></html>
HTML
fi

# ------------------------------------------------------------- the server --
# Both games are served over http rather than opened as file:// - Side Pot uses
# module scripts and fetch, which file:// blocks.
say "Installing the local server"
cat > "$ARCADE/serve.py" <<'PY'
#!/usr/bin/env python3
"""Serves ~/arcade on localhost. No access from outside the device."""
import http.server, functools, os, socketserver

ROOT = os.path.expanduser('~/arcade')
PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a):
        pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', PORT),
                            functools.partial(Handler, directory=ROOT)) as httpd:
    httpd.serve_forever()
PY
chmod +x "$ARCADE/serve.py"

sudo tee /etc/systemd/system/arcade-server.service >/dev/null <<EOF
[Unit]
Description=Arcade local game server
After=network.target

[Service]
ExecStart=/usr/bin/python3 $ARCADE/serve.py
Restart=always
User=$USER

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now arcade-server.service

# -------------------------------------------------------------- kiosk ------
say "Setting up the kiosk"
BROWSER="$(command -v chromium-browser || command -v chromium)"
cat > "$ARCADE/kiosk.sh" <<EOF
#!/usr/bin/env bash
# Waits for the local server, then opens the hub full screen.
for i in \$(seq 1 40); do
  curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done
exec "$BROWSER" \\
  --kiosk \\
  --app="http://127.0.0.1:$PORT/" \\
  --noerrdialogs \\
  --disable-infobars \\
  --disable-session-crashed-bubble \\
  --disable-features=TranslateUI \\
  --check-for-update-interval=31536000 \\
  --autoplay-policy=no-user-gesture-required \\
  --disable-pinch \\
  --overscroll-history-navigation=0 \\
  --user-data-dir="\$HOME/.arcade-chrome"
EOF
# There is deliberately no --use-gl flag. Chromium picks the right backend on
# Bookworm; forcing a wrong one silently falls back to software rendering,
# which would make a WebGL game unplayable and look like a hardware fault.
# Check chrome://gpu reads "WebGL: Hardware accelerated" before blaming the Pi.
chmod +x "$ARCADE/kiosk.sh"

mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/arcade.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Arcade
Exec=$ARCADE/kiosk.sh
X-GNOME-Autostart-enabled=true
EOF

# ------------------------------------------------------------- display -----
say "Turning off screen blanking"
sudo raspi-config nonint do_blanking 1 2>/dev/null || \
  echo "    raspi-config could not do it; turn blanking off in Preferences."

say "Done."
cat <<EOF

  Games live in   $ARCADE
  Served at       http://127.0.0.1:$PORT/
  Kiosk script    $ARCADE/kiosk.sh
  Autostart       ~/.config/autostart/arcade.desktop

  Reboot and it should come up straight into the hub.
  To get out of the kiosk: Alt+F4, or Ctrl+Alt+F2 for a console.
  To update the games later: run this script again.

EOF
