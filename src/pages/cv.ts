/** /cv always points at the current CV (uploaded in Settings). */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { loadPageData } from "../core/db";
import { mediaBase } from "../core/media";

export const GET: APIRoute = async ({ redirect }) => {
  const { data } = await loadPageData(env.DB, "published");
  const key = data.settings.cv.fileKey;
  if (!key) return new Response("No CV uploaded yet", { status: 404 });
  return redirect(`${mediaBase(env.MEDIA_BASE_URL)}/${key}`, 302);
};
