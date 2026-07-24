import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/session";
import { databaseConfigured, ensureSchema, sql } from "@/lib/vault-db";

export const runtime = "nodejs";

export async function GET() {
  if (!databaseConfigured()) {
    return NextResponse.json({ configured: false, initialized: false, profile: null });
  }
  try {
    await ensureSchema();
    const count = await sql()<[{ count: number }]>`select count(*)::int as count from profiles`;
    return NextResponse.json({
      configured: true,
      initialized: count[0].count > 0,
      profile: await currentProfile(),
    });
  } catch {
    return NextResponse.json({ configured: false, initialized: false, profile: null }, { status: 503 });
  }
}
