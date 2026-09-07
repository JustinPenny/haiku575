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

- **Caddy** (`deploy/Caddyfile`): `sudo apt install caddy`, edit the domain in the Caddyfile, `sudo cp deploy/Caddyfile /etc/caddy/Caddyfile`, `sudo systemctl restart caddy`. Automatic Let's Encrypt HTTPS. **Only works if your router can actually get a public IP** — see the CGNAT note below.
- **Cloudflare Tunnel**: skip Caddy, point a tunnel hostname at `http://localhost:3000` directly. Works behind CGNAT, no router config needed. This is what's actually running in production for this project — see "Cloudflare Quick Tunnel setup" below.

## 4. Get traffic to the Pi
Port-forwarding 80/443 only works if your ISP gives your router a real public IP. Many residential ISPs instead use CGNAT (Carrier-Grade NAT) — check by comparing your router's reported WAN IP against what a site like whatismyipaddress.com shows from a device on that network; if they don't match, or your WAN IP falls in `100.64.0.0/10`, you're behind CGNAT and port-forwarding can never work, no matter how it's configured. Cloudflare Tunnel sidesteps this entirely since the Pi makes an outbound-only connection out to Cloudflare's edge.

### Cloudflare Quick Tunnel setup (current production setup)
This project doesn't have a stable domain pointed at the tunnel — quick tunnels are free but hand out a random `*.trycloudflare.com` URL that changes every time the tunnel (re)starts. To avoid needing to SSH in after every reboot just to find the new URL, `deploy/haiku-tunnel.sh` starts the tunnel, grabs the assigned URL from its log output, and emails it via `msmtp`.

1. Install cloudflared (Cloudflare's apt repo may not support very new Debian codenames — if `apt` fails, grab the `.deb` directly instead):
   ```
   curl -L -o cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
   sudo dpkg -i cloudflared.deb
   ```
   (swap `arm64` for `armhf` on 32-bit Pi OS — check with `dpkg --print-architecture`)

2. Set up email notifications: install `msmtp` + `msmtp-mta`, then create `~/.msmtprc` (mode `600`) with a Gmail SMTP config using an [App Password](https://myaccount.google.com/apppasswords) (requires 2-Step Verification enabled first). Test with:
   ```
   echo -e "Subject: Test\n\nIt works." | msmtp you@example.com
   ```

3. Copy the wrapper script and edit the email address in it:
   ```
   sudo cp deploy/haiku-tunnel.sh /usr/local/bin/haiku-tunnel.sh
   sudo chmod +x /usr/local/bin/haiku-tunnel.sh
   sudo nano /usr/local/bin/haiku-tunnel.sh   # set NOTIFY_EMAIL
   ```

4. Install the service, editing `User=` to match whichever user's `~/.msmtprc` you configured:
   ```
   sudo cp deploy/cloudflared-tunnel.service /etc/systemd/system/
   sudo nano /etc/systemd/system/cloudflared-tunnel.service   # fix User=
   sudo systemctl daemon-reload
   sudo systemctl enable --now cloudflared-tunnel
   ```

5. Grab the current URL any time from `journalctl -u cloudflared-tunnel -n 50 --no-pager | grep trycloudflare.com`, or just check email after a reboot.

**Note:** since the URL changes on every restart, this isn't a bookmarkable/shareable link long-term. The permanent fix is pointing a real domain at a named tunnel instead of a quick tunnel — this requires the domain's DNS (or a delegated subdomain, which needs a Cloudflare Enterprise plan) to be managed by Cloudflare.

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
