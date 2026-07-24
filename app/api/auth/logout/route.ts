import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashToken } from "@/lib/security";
import { databaseConfigured, sql } from "@/lib/vault-db";

export async function POST() {
  const jar = await cookies();
  const token = jar.get("cliphunt_session")?.value;
  if (token && databaseConfigured()) await sql()`delete from sessions where token_hash=${hashToken(token)}`;
  jar.set("cliphunt_session", "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}
