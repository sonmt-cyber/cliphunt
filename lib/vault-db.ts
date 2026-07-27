import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<void> | null = null;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function sql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL chưa được cấu hình");
  }
  if (!client) {
    client = postgres(process.env.DATABASE_URL, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: "require",
    });
  }
  return client;
}

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = sql();
      await db`
        create table if not exists profiles (
          id uuid primary key default gen_random_uuid(),
          username text not null,
          username_norm text not null unique,
          password_hash text not null,
          role text not null check (role in ('admin', 'member')),
          active boolean not null default true,
          failed_attempts integer not null default 0,
          locked_until timestamptz,
          created_at timestamptz not null default now()
        )
      `;
      await db`alter table profiles add column if not exists email text`;
      await db`alter table profiles add column if not exists google_sub text`;
      await db`create unique index if not exists profiles_email_unique on profiles (lower(email)) where email is not null`;
      await db`create unique index if not exists profiles_google_sub_unique on profiles (google_sub) where google_sub is not null`;
      await db`
        create table if not exists sessions (
          token_hash text primary key,
          profile_id uuid not null references profiles(id) on delete cascade,
          expires_at timestamptz not null,
          created_at timestamptz not null default now()
        )
      `;
      await db`
        create table if not exists platform_credentials (
          id uuid primary key default gen_random_uuid(),
          provider text not null,
          label text not null,
          login_identifier text,
          secret_ciphertext text not null,
          secret_iv text not null,
          secret_tag text not null,
          config_json jsonb not null default '{}'::jsonb,
          created_by uuid not null references profiles(id),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `;
      await db`
        create table if not exists credential_permissions (
          profile_id uuid not null references profiles(id) on delete cascade,
          credential_id uuid not null references platform_credentials(id) on delete cascade,
          can_view boolean not null default false,
          can_edit boolean not null default false,
          primary key (profile_id, credential_id)
        )
      `;
      await db`
        create table if not exists audit_log (
          id bigserial primary key,
          profile_id uuid references profiles(id),
          action text not null,
          target_type text,
          target_id text,
          created_at timestamptz not null default now()
        )
      `;
      await db`delete from sessions where expires_at < now()`;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

