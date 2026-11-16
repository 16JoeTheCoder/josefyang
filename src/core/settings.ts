/** Site-wide settings (architecture §6.2 settings table). Each key is a set of descriptor fields, edited like a module. */
import { f, t, noImage, type Content, type Fields } from "./fields";

const site = {
  logo: f.label("Logo text", { max: 20, maxLines: 1 }),
  navProjects: f.label("Nav: Projects", { max: 14, maxLines: 1 }),
  navFailures: f.label("Nav: Failures", { max: 14, maxLines: 1 }),
  navDevlog: f.label("Nav: Devlog", { max: 14, maxLines: 1 }),
  navAbout: f.label("Nav: About", { max: 14, maxLines: 1 }),
  navContact: f.label("Nav: Get in touch", { max: 16, maxLines: 1 }),
  menuLabel: f.label("Mobile menu button", { max: 10, maxLines: 1 }),
  footerLead: f.body("Footer lead line", { max: 60, maxLines: 1 }),
  footerProjectsButton: f.button("Footer button 1"),
  footerAboutButton: f.button("Footer button 2"),
  colPages: f.label("Column: Pages", { max: 20, maxLines: 1 }),
  colHome: f.label("Link: Home", { max: 20, maxLines: 1 }),
  colTools: f.label("Column: My tools", { max: 20, maxLines: 1 }),
  colElsewhere: f.label("Column: Elsewhere", { max: 20, maxLines: 1 }),
  colMore: f.label("Column: More", { max: 20, maxLines: 1 }),
  cvLink: f.label("Link: Download CV", { max: 24, maxLines: 1 }),
  howBuiltLink: f.label("Link: How this site is built", { max: 30, maxLines: 1 }),
  howBuiltUrl: f.url("How this site is built (URL)"),
  copyright: f.label("Copyright line", { max: 60, maxLines: 1 }),
  signoff: f.label("Sign-off line", { max: 80, maxLines: 1 }),
  emptyImage: f.label("Generic empty image label", { max: 40, maxLines: 1 }),
  failedPill: f.pill("Failed pill"),
  notFoundTitle: f.giant("404 page title", { max: 20, maxLines: 1 }),
  notFoundText: f.body("404 page text", { max: 140, maxLines: 2 }),
};

const contacts = {
  email: f.label("Email", { max: 60, maxLines: 1 }),
  instagram: f.url("Instagram URL"),
  github: f.url("GitHub URL"),
  youtube: f.url("YouTube URL"),
  linkedin: f.url("LinkedIn URL"),
  instagramLabel: f.label("Instagram label", { max: 16, maxLines: 1 }),
  githubLabel: f.label("GitHub label", { max: 16, maxLines: 1 }),
  youtubeLabel: f.label("YouTube label", { max: 16, maxLines: 1 }),
  linkedinLabel: f.label("LinkedIn label", { max: 16, maxLines: 1 }),
  fuseUrl: f.url("Fuse URL"),
  fuseLabel: f.label("Fuse label", { max: 16, maxLines: 1 }),
  chronosUrl: f.url("Chronos URL"),
  chronosLabel: f.label("Chronos label", { max: 16, maxLines: 1 }),
};

const seo = {
  title: f.label("Site title", { max: 60, maxLines: 1 }),
  description: f.body("Default description", { max: 160, maxLines: 3 }),
  ogImage: f.image("Default social image", "1.91 / 1", ["fill"], "Social image, 1200 × 630"),
};

const cv = {
  fileKey: f.url("CV file (upload in Settings)"),
};

const devlog = {
  monthNotes: f.list("Month notes", "Note", {
    month: f.date("Month (YYYY-MM)"),
    note: f.label("Note", { max: 60, maxLines: 1 }),
  }, 0, 24),
};

export const settingsFields = { site, contacts, seo, cv, devlog } satisfies Record<string, Fields>;
export type SettingsKey = keyof typeof settingsFields;
export type SiteSettings = { [K in SettingsKey]: Content<(typeof settingsFields)[K]> };

export const settingsDefaults: SiteSettings = {
  site: {
    logo: t("Josef Yang"),
    navProjects: t("Projects"),
    navFailures: t("Failures"),
    navDevlog: t("Devlog"),
    navAbout: t("About"),
    navContact: t("Get in touch"),
    menuLabel: t("Menu"),
    footerLead: t("Building something? Let's talk."),
    footerProjectsButton: t("See the projects"),
    footerAboutButton: t("About me"),
    colPages: t("Pages"),
    colHome: t("Home"),
    colTools: t("My tools"),
    colElsewhere: t("Elsewhere"),
    colMore: t("More"),
    cvLink: t("Download CV"),
    howBuiltLink: t("How this site is built"),
    howBuiltUrl: "https://github.com/16JoeTheCoder/josefyang",
    copyright: t("© 2026 Josef Yang, Jakarta"),
    signoff: t("Built after dark, with jazz on and too much kopi."),
    emptyImage: t("Image, added later"),
    failedPill: t("Failed"),
    notFoundTitle: t("Not here"),
    notFoundText: t("This page doesn't exist, or it moved. The builds are all on one page."),
  },
  contacts: {
    email: t("josef@josefyang.com"),
    instagram: "",
    github: "https://github.com/16JoeTheCoder",
    youtube: "",
    linkedin: "",
    instagramLabel: t("Instagram"),
    githubLabel: t("GitHub"),
    youtubeLabel: t("YouTube"),
    linkedinLabel: t("LinkedIn"),
    fuseUrl: "https://fuse.josefyang.com",
    fuseLabel: t("Fuse"),
    chronosUrl: "https://github.com/16JoeTheCoder/chronos",
    chronosLabel: t("Chronos"),
  },
  seo: {
    title: t("Josef Yang"),
    description: t("Josef Yang, student engineer in Jakarta. Hardware and software builds, failures included."),
    ogImage: noImage("fill"),
  },
  cv: { fileKey: "" },
  devlog: { monthNotes: [{ month: "2026-10", note: t("The month I started building.") }] },
};
