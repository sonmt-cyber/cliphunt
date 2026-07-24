import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/security";
import { databaseConfigured, ensureSchema, sql } from "@/lib/vault-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!databaseConfigured()) return NextResponse.json({ error: "Chưa kết nối cơ sở dữ liệu." }, { status: 503 });
  const body = await request.json();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const bootstrapToken = String(body.bootstrapToken || "");
  if (!process.env.ADMIN_BOOTSTRAP_TOKEN || bootstrapToken !== process.env.ADMIN_BOOTSTRAP_TOKEN) {
    return NextResponse.json({ error: "Mã khởi tạo không đúng." }, { status: 403 });
  }
  if (username.length < 3 || password.length < 12) {
    return NextResponse.json({ error: "Tên đăng nhập tối thiểu 3 ký tự, mật khẩu tối thiểu 12 ký tự." }, { status: 400 });
  }
  await ensureSchema();
  const existing = await sql()<[{ count: number }]>`select count(*)::int as count from profiles`;
  if (existing[0].count) return NextResponse.json({ error: "Tài khoản admin đã được tạo." }, { status: 409 });
  await sql()`insert into profiles (username, username_norm, password_hash, role)
    values (${username}, ${username.toLowerCase()}, ${hashPassword(password)}, 'admin')`;
  return NextResponse.json({ ok: true });
}
