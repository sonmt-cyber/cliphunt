import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/security";
import { audit } from "@/lib/session";
import { databaseConfigured, ensureSchema, sql } from "@/lib/vault-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "Chưa kết nối cơ sở dữ liệu." }, { status: 503 });
  }

  const body = await request.json();
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const bootstrapToken = String(body.bootstrapToken || "");

  if (!process.env.ADMIN_BOOTSTRAP_TOKEN || bootstrapToken !== process.env.ADMIN_BOOTSTRAP_TOKEN) {
    return NextResponse.json({ error: "Mã khôi phục không đúng." }, { status: 403 });
  }
  if (password.length < 12) {
    return NextResponse.json({ error: "Mật khẩu mới phải có ít nhất 12 ký tự." }, { status: 400 });
  }

  await ensureSchema();
  const rows = await sql()<Array<{ id: string }>>`
    update profiles
    set password_hash = ${hashPassword(password)},
        failed_attempts = 0,
        locked_until = null,
        active = true
    where username_norm = ${username} and role = 'admin'
    returning id
  `;
  if (!rows[0]) {
    return NextResponse.json({ error: "Không tìm thấy admin này." }, { status: 404 });
  }

  await sql()`delete from sessions where profile_id = ${rows[0].id}`;
  await audit(rows[0].id, "admin.recover", "profile", rows[0].id);
  return NextResponse.json({ ok: true });
}
