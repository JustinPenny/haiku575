#!/bin/bash
# Starts a Cloudflare quick tunnel pointed at the app and emails the
# assigned *.trycloudflare.com URL, since quick tunnels mint a new random
# URL every time they (re)start - there's no fixed address to bookmark.
#
# Requires msmtp configured at ~/.msmtprc for whichever user runs this
# (see deploy/cloudflared-tunnel.service's User= line - they must match).
#
# EDIT: the email address below.
NOTIFY_EMAIL="justincpenny@gmail.com"

LOGFILE="$HOME/cloudflared-tunnel.log"
rm -f "$LOGFILE"

cloudflared tunnel --url http://localhost:3000 > "$LOGFILE" 2>&1 &
CFPID=$!

URL=""
for i in $(seq 1 30); do
    URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOGFILE" | head -n1)
    [ -n "$URL" ] && break
    sleep 1
done

if [ -n "$URL" ]; then
    echo -e "Subject: Haiku575 is live\n\nNew tunnel URL: $URL" | msmtp "$NOTIFY_EMAIL"
else
    echo -e "Subject: Haiku575 tunnel FAILED to start\n\nNo URL appeared in the log within 30s." | msmtp "$NOTIFY_EMAIL"
fi

wait $CFPID
