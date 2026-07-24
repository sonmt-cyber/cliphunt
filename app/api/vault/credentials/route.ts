import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/security";
import { audit, currentProfile, requireAdmin } from "@/lib/session";
import { ensureSchema, sql } from "@/lib/vault-db";

export async function GET() {
  await ensureSchema(); const profile=await currentProfile();
  if(!profile) return NextResponse.json({error:"Chưa đăng nhập."},{status:401});
  const credentials = profile.role==="admin"
    ? await sql()`select id,provider,label,login_identifier,created_at from platform_credentials order by created_at desc`
    : await sql()`select c.id,c.provider,c.label,c.login_identifier,c.created_at from platform_credentials c join credential_permissions p on p.credential_id=c.id where p.profile_id=${profile.id} and p.can_view=true order by c.created_at desc`;
  return NextResponse.json({credentials});
}

export async function POST(request:Request) {
  try {
    await ensureSchema(); const admin=await requireAdmin(); const b=await request.json();
    const provider=String(b.provider||"").trim(), label=String(b.label||"").trim(), secret=String(b.secret||"");
    if(!provider||!label||!secret) return NextResponse.json({error:"Thiếu nền tảng, tên hoặc bí mật."},{status:400});
    const enc=encryptSecret(secret);
    const rows=await sql()<Array<{id:string}>>`insert into platform_credentials(provider,label,login_identifier,secret_ciphertext,secret_iv,secret_tag,created_by)
      values(${provider},${label},${String(b.loginIdentifier||"")||null},${enc.ciphertext},${enc.iv},${enc.tag},${admin.id}) returning id`;
    const ids=Array.isArray(b.profileIds)?b.profileIds.map(String):[];
    for(const id of ids) await sql()`insert into credential_permissions(profile_id,credential_id,can_view,can_edit) values(${id},${rows[0].id},true,false) on conflict do nothing`;
    await audit(admin.id,"credential.create","credential",rows[0].id);
    return NextResponse.json({ok:true});
  } catch { return NextResponse.json({error:"Không có quyền hoặc cấu hình mã hóa chưa sẵn sàng."},{status:403}); }
}
