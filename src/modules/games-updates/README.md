# Games: updates (`games-updates`)

Up to six entries from `gameUpdates()` (src/core/journey.ts): published, due, main-visible, tied to a game (`game_slug` set or `sites` includes "games"), in Devlog display order. Each links to its primary `/devlog/<slug>` route. Game-only rows (sites = ["games"]) are excluded until Phase 2 resolves their canonical. Data: MODULE_NEEDS `{ builds, devlog: { limit: 6, games: true } }`.
