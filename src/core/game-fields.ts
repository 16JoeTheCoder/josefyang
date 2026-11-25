/** Editable fields of a game on the hub (same descriptor style as build-fields.ts), plus the hub page copy. */
import { f, t, noImage, noVideo, type Content } from "./fields";

export const gameFields = {
  name: f.giant("Game name", { max: 32, maxLines: 2, fit: 18 }),
  tagline: f.label("Tagline (one line)", { max: 90, maxLines: 1, fit: 64 }),
  description: f.body("Description", { max: 1600, maxLines: 24, multiline: true }),
  url: f.url("Game address (its own https:// URL)"),
  status: f.select("Status", [
    { value: "development", label: "In development" },
    { value: "playable", label: "Playable" },
    { value: "released", label: "Released" },
  ]),
  platforms: f.group("Platforms", {
    browser: f.toggle("Plays in the browser"),
    android: f.toggle("Installs on Android"),
    ios: f.toggle("Installs on iPhone and iPad"),
  }),
  genres: f.list("Genres", "Genre", { name: f.pill("Genre") }, 0, 3),
  playLabel: f.button("Play button label", 18),
  featured: f.toggle("Featured (leads the hub)"),
  icon: f.image("Icon", "1 / 1", ["object", "fill"], "Game icon, 512 × 512"),
  cover: f.image("Cover", "16 / 9", ["fill"], "Cover image, 1600 × 900"),
  screenshots: f.list("Screenshots", "Screenshot", {
    image: f.image("Screenshot", "16 / 9", ["fill", "fit"], "Screenshot, 16:9"),
    caption: f.label("Caption", { max: 80, maxLines: 1 }),
  }, 0, 8),
  trailer: f.video("Trailer (short MP4)", "Trailer clip, added later"),
  trailerPoster: f.image("Trailer poster", "16 / 9", ["fill"], "Trailer poster, 16:9"),
};

export type GameFields = Content<typeof gameFields>;
export type GameStatus = GameFields["status"];

export const gameDefaults = (name = "[Game name]"): GameFields => ({
  name: t(name),
  tagline: t("[One line: what you do in this game.]"),
  description: t("[What the game is, what it feels like to play, and why it exists.]"),
  url: "",
  status: "development",
  platforms: { browser: true, android: false, ios: false },
  genres: [],
  playLabel: t("Play"),
  featured: false,
  icon: noImage("object"),
  cover: noImage("fill"),
  screenshots: [],
  trailer: noVideo(),
  trailerPoster: noImage("fill"),
});

/** A game as stored in games.draft_json / published_json. The slug lives in the doc so a draft rename never moves the live URL. */
export interface GameDoc { slug: string; game: GameFields }

/* ---------- hub page copy (settings key "games_hub", edited in Admin → Game hub text) ---------- */

export const hubFields = {
  brand: f.label("Header name (top left)", { max: 40, maxLines: 1 }),
  title: f.giant("Hub title", { max: 24, maxLines: 2, fit: 14 }),
  line: f.body("Hero line", { max: 200, maxLines: 3, fit: 140 }),
  featuredLabel: f.pill("Featured pill"),
  gridTitle: f.heading("Games heading", { max: 24, maxLines: 1, fit: 16 }),
  emptyTitle: f.subheading("Empty state title", { max: 40, maxLines: 1 }),
  emptyText: f.body("Empty state text", { max: 160, maxLines: 3, fit: 130 }),
  detailsLabel: f.label("Details link", { max: 24, maxLines: 1 }),
  soonLabel: f.label("Label when a game has no address yet", { max: 28, maxLines: 1 }),
  devlogsTitle: f.heading("Latest devlogs heading", { max: 28, maxLines: 1, fit: 18 }),
  devlogsEmpty: f.body("No devlogs yet text", { max: 120, maxLines: 2 }),
  readLabel: f.label("Devlog link text", { max: 28, maxLines: 1 }),
  backLabel: f.label("Back to hub link", { max: 24, maxLines: 1 }),
  siteLabel: f.label("Link to josefyang.com", { max: 28, maxLines: 1 }),
  aboutTitle: f.subheading("Description heading", { max: 24, maxLines: 1 }),
  screenshotsTitle: f.subheading("Screenshots heading", { max: 24, maxLines: 1 }),
  trailerTitle: f.subheading("Trailer heading", { max: 24, maxLines: 1 }),
  platformsTitle: f.subheading("Where to play heading", { max: 24, maxLines: 1 }),
  browserNote: f.label("Browser note", { max: 90, maxLines: 2 }),
  androidTitle: f.label("Android heading", { max: 40, maxLines: 1 }),
  androidSteps: f.body("Android: how to install (one step per line)", { max: 400, maxLines: 8, multiline: true }),
  iosTitle: f.label("iPhone and iPad heading", { max: 40, maxLines: 1 }),
  iosSteps: f.body("iPhone and iPad: how to install (one step per line)", { max: 400, maxLines: 8, multiline: true }),
  gameDevlogsTitle: f.subheading("Devlog heading on a game page", { max: 28, maxLines: 1 }),
  gameDevlogsEmpty: f.body("No devlogs for this game yet", { max: 120, maxLines: 2 }),
  statusDevelopment: f.pill("Status: In development"),
  statusPlayable: f.pill("Status: Playable"),
  statusReleased: f.pill("Status: Released"),
  platformBrowser: f.pill("Platform: browser", 24),
  platformAndroid: f.pill("Platform: Android", 24),
  platformIos: f.pill("Platform: iPhone and iPad", 24),
  footerLine: f.label("Footer line", { max: 80, maxLines: 1 }),
};

export type HubCopy = Content<typeof hubFields>;

export const hubDefaults: HubCopy = {
  brand: t("Games by Josef Yang"),
  title: t("[Hub title]"),
  line: t("[One or two lines about the games here and how to play them.]"),
  featuredLabel: t("Featured"),
  gridTitle: t("All games"),
  emptyTitle: t("[No games yet]"),
  emptyText: t("[The first game is being built. Check back soon.]"),
  detailsLabel: t("Details"),
  soonLabel: t("Not playable yet"),
  devlogsTitle: t("Latest devlogs"),
  devlogsEmpty: t("[No devlogs yet.]"),
  readLabel: t("Read on josefyang.com"),
  backLabel: t("All games"),
  siteLabel: t("josefyang.com"),
  aboutTitle: t("About this game"),
  screenshotsTitle: t("Screenshots"),
  trailerTitle: t("Trailer"),
  platformsTitle: t("Where to play"),
  browserNote: t("Open it in any modern browser. Nothing to install."),
  androidTitle: t("Install on Android (Chrome)"),
  androidSteps: t("Open the game in Chrome.\nTap the three-dot menu.\nTap Install app, or Add to Home screen."),
  iosTitle: t("Install on iPhone or iPad (Safari)"),
  iosSteps: t("Open the game in Safari.\nTap the Share button.\nTap Add to Home Screen, then Add."),
  gameDevlogsTitle: t("Devlog"),
  gameDevlogsEmpty: t("[No devlog posts for this game yet.]"),
  statusDevelopment: t("In development"),
  statusPlayable: t("Playable"),
  statusReleased: t("Released"),
  platformBrowser: t("Browser"),
  platformAndroid: t("Android"),
  platformIos: t("iPhone and iPad"),
  footerLine: t("[Made in Jakarta.]"),
};
