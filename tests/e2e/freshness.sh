#!/usr/bin/env bash
# Freshness fixture (local, disposable DB). Run from repo root after `npm run build`:  bash tests/e2e/freshness.sh
# Proves: miss vs hit cost, a change made WITHOUT a purge is served stale until the 60 s TTL, and a publish purges.
set -u
PORT=8798; U="http://localhost:$PORT"
pkill -f "port $PORT" 2>/dev/null; sleep 1
npx wrangler dev -c dist/server/wrangler.json --port $PORT --persist-to .wrangler/state --var CACHE_PAGES:1 --var DEV_ADMIN_BYPASS:1 --var GAME_HOST: >/dev/null 2>&1 &
for _ in $(seq 1 60); do curl -s -o /dev/null "$U/robots.txt" && break; sleep 1; done
db() { npx wrangler d1 execute josefyang-db --local --persist-to .wrangler/state --command "$1" >/dev/null 2>&1; }
marker() { curl -s "$U/games" | grep -o 'FRESHNESS-[A-Z0-9-]*' | head -1; }
t() { curl -s -o /dev/null -w "%{time_starttransfer}" "$U$1"; }
# Seed a published games page whose intro carries a marker.
set_marker() { db "INSERT INTO pages (id, draft_json, published_json, updated_at, published_at) VALUES ('games', '[{\"sectionId\":\"games-journey\",\"moduleId\":\"games-journey\",\"moduleVersion\":1,\"content\":{\"intro\":{\"value\":\"$1\"}}}]', '[{\"sectionId\":\"games-journey\",\"moduleId\":\"games-journey\",\"moduleVersion\":1,\"content\":{\"intro\":{\"value\":\"$1\"}}}]', 1, 1) ON CONFLICT(id) DO UPDATE SET draft_json = excluded.draft_json, published_json = excluded.published_json"; }
set_marker "FRESHNESS-A"
echo "miss TTFB s: $(t /games?nocache=$RANDOM)"; curl -s -o /dev/null "$U/games"
echo "hit  TTFB s: $(t /games)"
echo "served before change: $(marker)"
set_marker "FRESHNESS-B"; T0=$(date +%s)
echo "after DB change, no purge (t+0): $(marker)  (expected stale A)"
sleep 55; echo "t+$(( $(date +%s) - T0 ))s: $(marker)  (still A allowed)"
sleep 8;  echo "t+$(( $(date +%s) - T0 ))s: $(marker)  (expected B: TTL 60 s)"
# Publish path: draft change + publish through the admin API purges this data centre immediately.
db "UPDATE pages SET draft_json = replace(draft_json, 'FRESHNESS-B', 'FRESHNESS-C') WHERE id = 'games'"
curl -s -o /dev/null "$U/games"
curl -s -X POST -H "Origin: $U" -H "Content-Type: application/json" -d '{}' "$U/api/admin/pages/games/publish" >/dev/null; sleep 1
echo "after publish (t+0): $(marker)  (expected C: purged)"
echo "cache-control on the stored copy is s-maxage=60; browser max-age=0"
db "DELETE FROM pages WHERE id = 'games'"
pkill -f "port $PORT" 2>/dev/null
