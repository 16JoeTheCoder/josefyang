#!/usr/bin/env bash
# Reusable route fixture (Phase 1; replay in Phases 2 and 3). Dummy hosts only, never production.
# Run from the repo root after `npm run build` with the local D1 migrated and seeded:
#   bash tests/e2e/route-fixture.sh            (both modes; prints status, Location, canonical, cache headers)
# Mode A: GAME_HOST=game.example.test, SITE_URL=https://main.example.test (Host headers sent to 127.0.0.1)
# Mode B: no GAME_HOST (local contract: catalog at /hub)
set -u
BODY=$(mktemp -p "${TMPDIR:-.wrangler}" route-body.XXXX 2>/dev/null || echo .wrangler/route-body)
PORT_A=8791; PORT_B=8792
pkill -f "port $PORT_A" 2>/dev/null; pkill -f "port $PORT_B" 2>/dev/null; sleep 1
start() { # port, extra vars...
  local port=$1; shift
  npx wrangler dev -c dist/server/wrangler.json --port "$port" --persist-to .wrangler/state --var CACHE_PAGES:0 --var DEV_ADMIN_BYPASS:1 "$@" >/dev/null 2>&1 &
  echo $!
  for _ in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$port/robots.txt" && break; sleep 1; done
}
row() { # label method host port path
  local label=$1 method=$2 host=$3 port=$4 path=$5
  local h
  if [ "$method" = HEAD ]; then h=$(curl -s -I -H "Host: $host" "http://127.0.0.1:$port$path"); : > "$BODY"
  else h=$(curl -s -o "$BODY" -D - -H "Host: $host" "http://127.0.0.1:$port$path"); fi
  local status loc cc robots canon bytes
  status=$(printf '%s' "$h" | head -1 | awk '{print $2}')
  loc=$(printf '%s' "$h" | grep -i '^location:' | tr -d '\r' | cut -d' ' -f2-)
  cc=$(printf '%s' "$h" | grep -i '^cache-control:' | tr -d '\r' | cut -d' ' -f2-)
  robots=$(printf '%s' "$h" | grep -i '^x-robots-tag:' | tr -d '\r' | cut -d' ' -f2-)
  canon=$([ "$method" = GET ] && grep -o '<link rel="canonical" href="[^"]*"' "$BODY" | sed 's/.*href="//;s/"$//' || true)
  bytes=$([ "$method" = HEAD ] && echo "-" || wc -c < "$BODY")
  printf '%-34s %-5s %-18s %-26s %-4s %-44s %-30s %-16s %s\n' "$label" "$method" "$host" "$path" "$status" "${loc:--}" "${canon:--}" "${robots:--}" "${cc:--} body=$bytes"
}
printf '%-34s %-5s %-18s %-26s %-4s %-44s %-30s %-16s %s\n' CASE METHOD HOST PATH CODE LOCATION CANONICAL ROBOTS CACHE
A=$(start $PORT_A --var GAME_HOST:game.example.test --var SITE_URL:https://main.example.test)
M=main.example.test; G=game.example.test
row "journey" GET $M $PORT_A /games
row "journey slash" GET $M $PORT_A /games/
row "/game" GET $M $PORT_A /game
row "/game HEAD" HEAD $M $PORT_A /game
row "/game/?a=1 HEAD" HEAD $M $PORT_A "/game/?a=1"
row "/game/?a=1" GET $M $PORT_A "/game/?a=1"
row "legacy detail known" GET $M $PORT_A "/games/modulus?ref=x"
row "legacy detail unknown" GET $M $PORT_A /games/nope
row "catalog root" GET $G $PORT_A /
row "catalog detail known" GET $G $PORT_A /modulus
row "catalog detail unknown (real 404)" GET $G $PORT_A /nope
row "catalog legacy /games" GET $G $PORT_A /games
row "catalog never shows portfolio" GET $G $PORT_A /builds/chronos
row "internal /hub on main" GET $M $PORT_A /hub
row "admin on catalog host" GET $G $PORT_A /admin
row "preview on catalog host" GET $G $PORT_A /preview/games
row "admin api on catalog host" GET $G $PORT_A /api/admin/pages/games
row "preview on main (no Access locally)" GET $M $PORT_A /preview/games
row "preview localhost lane" GET localhost:$PORT_A $PORT_A /preview/games
row "public feed on catalog host" GET $G $PORT_A "/api/public/v1/posts?limit=1"
pkill -f "port $PORT_A" 2>/dev/null; sleep 1
B=$(start $PORT_B --var GAME_HOST:)
L=localhost:$PORT_B
row "B journey" GET $L $PORT_B /games
row "B /game/?a=1" GET $L $PORT_B "/game/?a=1"
row "B legacy detail" GET $L $PORT_B "/games/modulus?a=1"
row "B catalog" GET $L $PORT_B /hub
row "B catalog detail unknown" GET $L $PORT_B /hub/nope
row "B preview journey" GET $L $PORT_B /preview/games
pkill -f "port $PORT_B" 2>/dev/null
