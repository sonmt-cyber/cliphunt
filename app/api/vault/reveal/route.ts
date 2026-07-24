import { NextResponse } from "next/server";
import { decryptSecret, verifyPassword } from "@/lib/security";
import { audit, currentProfile } from "@/lib/session";
import { ensureSchema, sql } from "@/lib/vault-db";

export async function POST(request:Request) {
  await ensureSchema(); const profile=await currentProfile();
  if(!profile) return NextResponse.json({error:"Chưa đăng nhập."},{status:401});
  const b=await request.json(); const id=String(b.id||""); const password=String(b.password||"");
  const auth=await sql()<Array<{password_hash:string}>>`select password_hash from profiles where id=${profile.id}`;
  if(!auth[0]||!verifyPassword(password,auth[0].password_hash)) {
    await audit(profile.id,"credential.reveal_denied","credential",id);
    return NextResponse.json({error:"Mật khẩu profile không đúng."},{status:403});
  }
  const rows=profile.role==="admin"
    ? await sql()<Array<{secret_ciphertext:string;secret_iv:string;secret_tag:string}>>`select secret_ciphertext,secret_iv,secret_tag from platform_credentials where id=${id}`
    : await sql()<Array<{secret_ciphertext:string;secret_iv:string;secret_tag:string}>>`select c.secret_ciphertext,c.secret_iv,c.secret_tag from platform_credentials c join credential_permissions p on p.credential_id=c.id where c.id=${id} and p.profile_id=${profile.id} and p.can_view=true`;
  if(!rows[0]) return NextResponse.json({error:"Không có quyền xem."},{status:403});
  await audit(profile.id,"credential.reveal","credential",id);
  return NextResponse.json({secret:decryptSecret(rows[0].secret_ciphertext,rows[0].secret_iv,rows[0].secret_tag)});
}
