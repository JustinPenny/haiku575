# Deploying to a Raspberry Pi

## 1. On the Pi
```
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3
git clone https://github.com/JustinPenny/haiku575.git
cd haiku575
npm install
```
Run `npm install` on the Pi itself, not copied from another machine — `better-sqlite3` has a compiled native binary and needs to build/fetch the one matching the Pi's OS/arch.

## 2. Run it as a service
```
sudo cp deploy/haiku575.service /etc/systemd/system/
sudo nano /etc/systemd/system/haiku575.service   # fix User= and WorkingDirectory=
sudo systemctl daemon-reload
sudo systemctl enable --now haiku575
journalctl -u haiku575 -f   # logs
```

## 3. Put HTTPS in front of it
The app binds to `127.0.0.1:3000` by default (see `server.js`) — it's not meant to face the internet directly. Pick one:

- **Caddy** (`deploy/Caddyfile`): `sudo apt install caddy`, edit the domain in the Caddyfile, `sudo cp deploy/Caddyfile /etc/caddy/Caddyfile`, `sudo systemctl restart caddy`. Automatic Let's Encrypt HTTPS.
- **Cloudflare Tunnel**: skip Caddy, point a tunnel hostname at `http://localhost:3000` directly. Works behind CGNAT, no router config needed.

## 4. Get traffic to the Pi
Either port-forward 80/443 to the Pi's (reserved) local IP + a Dynamic DNS hostname, or use Cloudflare Tunnel (no port forwarding at all). Full tradeoffs discussed in chat.

## Environment variables
| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | what the app listens on |
| `HOST` | `127.0.0.1` | set to `0.0.0.0` only if you need LAN-wide access without a proxy in front |
| `NODE_ENV` | unset | set to `production` in the service file |

## Don't forget
- `ufw` allowing only 22 (+ 80/443 if port-forwarding)
- SSH key-only auth
- Back up `haiku575.db`/`-wal`/`-shm` — SD cards aren't a great long-term home for a database; consider booting off a USB SSD instead
