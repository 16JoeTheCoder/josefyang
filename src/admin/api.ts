/** Tiny fetch wrapper for /api/admin. Errors come back as { error, problems?, errors? }. */
export interface ApiError { status: number; error: string; problems?: { path: string; label: string; message: string }[]; errors?: string[] }

export async function api<T>(method: string, path: string, body?: unknown, opts: { keepalive?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/admin/${path}`, {
      method,
      headers: body instanceof FormData || body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      keepalive: opts.keepalive,
    });
  } catch {
    throw { status: 0, error: "Offline, will retry" } satisfies ApiError;
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw { status: res.status, error: String(data.error ?? res.statusText), problems: data.problems as ApiError["problems"], errors: data.errors as string[] } satisfies ApiError;
  return data as T;
}

export const isApiError = (e: unknown): e is ApiError => !!e && typeof e === "object" && "error" in e && "status" in e;
