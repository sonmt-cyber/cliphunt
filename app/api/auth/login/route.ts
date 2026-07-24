import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashToken, newSessionToken, verifyPassword } from "@/lib/security";
import { audit } from "@/lib/session";
import { databaseConfigured, ensureSchema, sql } from "@/lib/vault-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!databaseConfigured()) return NextResponse.json({ error: "Chưa kết nối cơ sở dữ liệu." }, { status: 503 });
  const body = await request.json();
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  await ensureSchema();
  const rows = await sql()<Array<{id:string;password_hash:string;active:boolean;failed_attempts:number;locked_until:Date|null}>>`
    select id, password_hash, active, failed_attempts, locked_until from profiles where username_norm=${username} limit 1`;
  const profile = rows[0];
  if (!profile || !profile.active || (profile.locked_until && profile.locked_until > new Date()) || !verifyPassword(password, profile.password_hash)) {
    if (profile) await sql()`update profiles set failed_attempts=failed_attempts+1,
      locked_until=case when failed_attempts+1 >= 5 then now()+interval '15 minutes' else locked_until end where id=${profile.id}`;
    return NextResponse.json({ error: "Sai thông tin đăng nhập hoặc tài khoản đang bị khóa." }, { status: 401 });
  }
  await sql()`update profiles set failed_attempts=0, locked_until=null where id=${profile.id}`;
  const token = newSessionToken();
  const days = Math.max(1, Math.min(30, Number(process.env.SESSION_TTL_DAYS || 7)));
  await sql()`insert into sessions (token_hash, profile_id, expires_at)
    values (${hashToken(token)}, ${profile.id}, now()+(${days}::text || ' days')::interval)`;
  (await cookies()).set("cliphunt_session", token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: "/", maxAge: days * 86400,
  });
  await audit(profile.id, "login");
  return NextResponse.json({ ok: true });
}
