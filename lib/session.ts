import { cookies } from "next/headers";
import { ensureSchema, sql } from "./vault-db";
import { hashToken } from "./security";

export type SessionProfile = {
  id: string;
  username: string;
  role: "admin" | "member";
};

export async function currentProfile(): Promise<SessionProfile | null> {
  await ensureSchema();
  const token = (await cookies()).get("cliphunt_session")?.value;
  if (!token) return null;
  const rows = await sql()<SessionProfile[]>`
    select p.id, p.username, p.role
    from sessions s
    join profiles p on p.id = s.profile_id
    where s.token_hash = ${hashToken(token)}
      and s.expires_at > now()
      and p.active = true
    limit 1
  `;
  return rows[0] || null;
}

export async function requireAdmin() {
  const profile = await currentProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("UNAUTHORIZED");
  }
  return profile;
}

export async function audit(
  profileId: string | null,
  action: string,
  targetType?: string,
  targetId?: string,
) {
  await sql()`
    insert into audit_log (profile_id, action, target_type, target_id)
    values (${profileId}, ${action}, ${targetType || null}, ${targetId || null})
  `;
}
