import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clientIp, route } from "@/lib/api";
import { createSession, registerUser, setSessionCookie } from "@/lib/auth";
import { nowIso, q1, run, type Row } from "@/lib/db";
import { env } from "@/lib/env";

export const GET = route("auth.google.callback", async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const jar = await cookies();
  const expected = jar.get("cw_oauth_state")?.value;
  jar.delete("cw_oauth_state");

  if (error) return NextResponse.redirect(`${env.appUrl}/login?error=${encodeURIComponent(error)}`);
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(
      `${env.appUrl}/login?error=${encodeURIComponent("Sign-in session expired. Please try again.")}`,
    );
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: `${env.appUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error("token exchange failed");
    const tokens: any = await tokenRes.json();

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) throw new Error("profile fetch failed");
    const profile: any = await profileRes.json();
    const email = String(profile.email ?? "").toLowerCase();
    if (!email) throw new Error("no email on Google account");

    let user = await q1<Row>(`SELECT * FROM users WHERE email = ?`, [email]);
    if (!user) {
      const id = await registerUser({
        email,
        name: profile.name ?? email.split("@")[0],
        provider: "google",
        googleSub: profile.sub,
        avatarUrl: profile.picture,
      });
      user = await q1<Row>(`SELECT * FROM users WHERE id = ?`, [id]);
    } else {
      await run(
        `UPDATE users SET provider = 'google', google_sub = ?, avatar_url = COALESCE(avatar_url, ?), updated_at = ? WHERE id = ?`,
        [profile.sub ?? null, profile.picture ?? null, nowIso(), user.id],
      );
    }

    const session = await createSession(String(user!.id), {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: clientIp(req),
    });
    await setSessionCookie(session.token, session.expiresAt);
    return NextResponse.redirect(`${env.appUrl}/dashboard`);
  } catch {
    return NextResponse.redirect(
      `${env.appUrl}/login?error=${encodeURIComponent("Google sign-in failed. Please try again.")}`,
    );
  }
});
