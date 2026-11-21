import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { env } from "@/lib/env";

export const GET = route("auth.google.start", async () => {
  if (!env.googleClientId || !env.googleClientSecret) {
    return NextResponse.redirect(
      `${env.appUrl}/login?error=${encodeURIComponent(
        "Google sign-in is not configured on this deployment. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      )}`,
    );
  }
  const state = crypto.randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("cw_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: `${env.appUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});
