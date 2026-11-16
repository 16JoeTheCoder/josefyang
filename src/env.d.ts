/// <reference types="astro/client" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    MEDIA: R2Bucket;
    ASSETS: Fetcher;
    ADMIN_EMAIL: string;
    CACHE_PAGES: string;
    MEDIA_BASE_URL: string;
    CF_ACCESS_AUD?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ANALYTICS_TOKEN?: string;
    DEV_ADMIN_BYPASS?: string;
  }
}
interface Env extends Cloudflare.Env {}

declare namespace App {
  interface Locals {
    cfContext: ExecutionContext;
    /** "draft" when rendering /preview/*, otherwise "published". */
    mode: "draft" | "published";
    adminEmail?: string;
  }
}
