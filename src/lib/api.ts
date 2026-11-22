/** Small helpers shared by every API route: JSON responses, typed errors, guards. */
import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "./auth";
import { run } from "./db";
import crypto from "node:crypto";

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (m: string, d?: unknown) => new HttpError(400, m, d);
export const unauthorized = (m = "You need to sign in to continue.") => new HttpError(401, m);
export const forbidden = (m = "You do not have access to this resource.") => new HttpError(403, m);
export const notFound = (m = "Not found.") => new HttpError(404, m);
export const tooMany = (m = "Too many requests. Try again shortly.") => new HttpError(429, m);

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw forbidden("Administrator access required.");
  return user;
}

export async function logError(scope: string, error: unknown, context?: unknown) {
  const err = error as Error;
  try {
    await run(
      `INSERT INTO error_logs (id, level, scope, message, stack, context_json, created_at)
       VALUES (?, 'error', ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        scope,
        err?.message ?? String(error),
        err?.stack ?? null,
        context ? JSON.stringify(context).slice(0, 4000) : null,
        new Date().toISOString(),
      ],
    );
  } catch {
    // never let logging break a request
  }
}

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response> | Response;

/** Wraps a route handler with uniform error handling + logging. */
export function route<Ctx = { params: Promise<Record<string, string>> }>(
  scope: string,
  handler: Handler<Ctx>,
) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message, details: error.details ?? null }, error.status);
      }
      await logError(scope, error, { url: req.url, method: req.method });
      return json({ error: "Something went wrong on our side. Please retry." }, 500);
    }
  };
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw badRequest("Expected a JSON body.");
  }
}

export function clientIp(req: Request): string | undefined {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined
  );
}
