import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashToken, newSessionToken } from "@/lib/security";
import { audit } from "@/lib/session";
import { ensureSchema, sql } from "@/lib/vault-db";

export const runtime = "nodejs";

type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string;
  iss?: string;
  exp?: string;
};

function settingsRedirect(request: Request, error?: string) {
  const url = new URL("/settings", request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const state = jar.get("cliphunt_google_state")?.value;
  const verifier = jar.get("cliphunt_google_verifier")?.value;
  jar.delete("cliphunt_google_state");
  jar.delete("cliphunt_google_verifier");

  if (!state || !verifier || url.searchParams.get("state") !== state) return settingsRedirect(request, "google_invalid_state");
  const code = url.searchParams.get("code");
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!code || !clientId || !clientSecret) return settingsRedirect(request, "google_failed");

  try {
    const redirectUri = new URL("/api/auth/google/callback", request.url).toString();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: verifier,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) return settingsRedirect(request, "google_failed");
    const token = await tokenResponse.json() as { id_token?: string };
    if (!token.id_token) return settingsRedirect(request, "google_failed");

    const infoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token)}`, { cache: "no-store" });
    if (!infoResponse.ok) return settingsRedirect(request, "google_failed");
    const info = await infoResponse.json() as GoogleTokenInfo;
    const validIssuer = info.iss === "https://accounts.google.com" || info.iss === "accounts.google.com";
    if (info.aud !== clientId || !validIssuer || info.email_verified !== "true" || !info.sub || !info.email || Number(info.exp || 0) * 1000 <= Date.now()) {
      return settingsRedirect(request, "google_failed");
    }

    await ensureSchema();
    const profiles = await sql()<Array<{id:string;google_sub:string|null}>>`
      select id, google_sub from profiles
      where active=true and (google_sub=${info.sub} or lower(email)=lower(${info.email}))
      order by case when google_sub=${info.sub} then 0 else 1 end limit 1`;
    const profile = profiles[0];
    if (!profile || (profile.google_sub && profile.google_sub !== info.sub)) return settingsRedirect(request, "google_not_linked");
    if (!profile.google_sub) await sql()`update profiles set google_sub=${info.sub} where id=${profile.id} and google_sub is null`;

    const sessionToken = newSessionToken();
    const days = Math.max(1, Math.min(30, Number(process.env.SESSION_TTL_DAYS || 7)));
    await sql()`insert into sessions (token_hash, profile_id, expires_at)
      values (${hashToken(sessionToken)}, ${profile.id}, now()+(${days}::text || ' days')::interval)`;
    jar.set("cliphunt_session", sessionToken, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
      path: "/", maxAge: days * 86400,
    });
    await audit(profile.id, "login.google");
    return settingsRedirect(request);
  } catch {
    return settingsRedirect(request, "google_failed");
  }
}

