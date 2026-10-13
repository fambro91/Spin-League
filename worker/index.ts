import { ensureSchema, type Env } from "./db";
import { cronTick } from "./game";
import { handleApi, HttpError, json } from "./api";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(req, env, url);
      } catch (e: any) {
        if (e instanceof HttpError) return json({ error: e.message }, e.status);
        console.error(e);
        return json({ error: "Errore del server. Riprova tra poco." }, 500);
      }
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_ev: ScheduledController, env: Env, ctx: ExecutionContext) {
    await ensureSchema(env.DB);
    ctx.waitUntil(cronTick(env));
  },
};

