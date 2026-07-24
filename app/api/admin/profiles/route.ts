import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/security";
import { audit, requireAdmin } from "@/lib/session";
import { ensureSchema, sql } from "@/lib/vault-db";

export async function GET() {
  try {
    await ensureSchema(); await requireAdmin();
    const profiles = await sql()`select id,username,role,active,created_at from profiles order by created_at`;
    return NextResponse.json({ profiles });
  } catch { return NextResponse.json({ error: "Không có quyền admin." }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    await ensureSchema(); const admin = await requireAdmin();
    const b = await request.json(); const username=String(b.username||"").trim(); const password=String(b.password||"");
    const role = b.role === "admin" ? "admin" : "member";
    if(username.length<3||password.length<12) return NextResponse.json({error:"Tên đăng nhập tối thiểu 3 ký tự, mật khẩu tối thiểu 12 ký tự."},{status:400});
    const rows=await sql()<Array<{id:string}>>`insert into profiles(username,username_norm,password_hash,role)
      values(${username},${username.toLowerCase()},${hashPassword(password)},${role}) returning id`;
    await audit(admin.id,"profile.create","profile",rows[0].id);
    return NextResponse.json({ok:true});
  } catch { return NextResponse.json({error:"Không thể tạo profile; tên có thể đã tồn tại."},{status:400}); }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema(); const admin=await requireAdmin(); const b=await request.json();
    if(b.password && String(b.password).length<12) return NextResponse.json({error:"Mật khẩu tối thiểu 12 ký tự."},{status:400});
    await sql()`update profiles set
      active=coalesce(${typeof b.active==="boolean"?b.active:null},active),
      role=coalesce(${b.role==="admin"||b.role==="member"?b.role:null},role),
      password_hash=coalesce(${b.password?hashPassword(String(b.password)):null},password_hash)
      where id=${String(b.id)}`;
    await audit(admin.id,"profile.update","profile",String(b.id));
    return NextResponse.json({ok:true});
  } catch { return NextResponse.json({error:"Không có quyền hoặc dữ liệu không hợp lệ."},{status:403}); }
}
