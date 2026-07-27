import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function base64url(value: Buffer) {
  return value.toString("base64url");
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/settings?error=google_not_configured", request.url));
  }

  const state = base64url(randomBytes(32));
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const redirectUri = new URL("/api/auth/google/callback", request.url).toString();
  const jar = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/google",
    maxAge: 600,
  };
  jar.set("cliphunt_google_state", state, cookieOptions);
  jar.set("cliphunt_google_verifier", verifier, cookieOptions);

  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return NextResponse.redirect(authorize);
}

