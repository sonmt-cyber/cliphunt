"use client";
import { FormEvent, useEffect, useState } from "react";

type Profile={id:string;username:string;role:"admin"|"member";active:boolean};
type Credential={id:string;provider:string;label:string;login_identifier?:string};
type Status={configured:boolean;initialized:boolean;profile:Profile|null};

async function api(url:string, options?:RequestInit){
  const r=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options?.headers||{})}});
  const data=await r.json(); if(!r.ok) throw new Error(data.error||"Có lỗi xảy ra."); return data;
}

export default function Settings(){
  const [status,setStatus]=useState<Status|null>(null),[profiles,setProfiles]=useState<Profile[]>([]),[credentials,setCredentials]=useState<Credential[]>([]);
  const [message,setMessage]=useState(""),[revealed,setRevealed]=useState<Record<string,string>>({});
  const refresh=async()=>{const s=await api("/api/auth/status");setStatus(s);if(s.profile){setCredentials((await api("/api/vault/credentials")).credentials);if(s.profile.role==="admin")setProfiles((await api("/api/admin/profiles")).profiles)}};
  useEffect(()=>{refresh().catch(e=>setMessage(e.message))},[]);
  const submit=async(e:FormEvent<HTMLFormElement>,url:string)=>{e.preventDefault();const form=e.currentTarget;setMessage("");const f=new FormData(form);const body=Object.fromEntries(f);try{await api(url,{method:"POST",body:JSON.stringify(body)});form.reset();await refresh();setMessage("Đã lưu thành công.")}catch(err){setMessage((err as Error).message)}};
  if(!status)return <main className="vault"><p>Đang kiểm tra bảo mật…</p></main>;
  if(!status.configured)return <main className="vault"><a href="/">← ClipHunt</a><h1>Két bảo mật chưa được kết nối</h1><p>Cần kết nối PostgreSQL và thêm hai khóa bí mật trên Vercel. API key chưa được phép lưu trên trình duyệt.</p></main>;
  if(!status.initialized)return <main className="vault"><a href="/">← ClipHunt</a><h1>Tạo admin đầu tiên</h1><form onSubmit={e=>submit(e,"/api/auth/bootstrap")}><input name="username" placeholder="Tên admin" required/><input name="password" type="password" minLength={12} placeholder="Mật khẩu (tối thiểu 12 ký tự)" required/><input name="bootstrapToken" type="password" placeholder="Mã khởi tạo từ Vercel" required/><button>Tạo admin</button></form><p className="notice">{message}</p></main>;
  if(!status.profile)return <main className="vault"><a href="/">← ClipHunt</a><h1>Đăng nhập ClipHunt</h1><p>Đăng nhập bằng profile được admin cấp.</p><form onSubmit={async e=>{await submit(e,"/api/auth/login");location.reload()}}><input name="username" placeholder="Tên đăng nhập" required/><input name="password" type="password" placeholder="Mật khẩu" required/><button>Đăng nhập</button></form><details className="recovery"><summary>Không đăng nhập được? Khôi phục admin</summary><p>Đặt mật khẩu mới và xóa trạng thái khóa của tài khoản admin.</p><form onSubmit={e=>submit(e,"/api/auth/recover")}><input name="username" placeholder="Tên admin" required/><input name="password" type="password" minLength={12} placeholder="Mật khẩu mới (tối thiểu 12 ký tự)" required/><input name="bootstrapToken" type="password" placeholder="Mã khôi phục máy chủ" required/><button>Đặt lại mật khẩu admin</button></form></details><p className="notice">{message}</p></main>;
  return <main className="vault"><div className="vault-head"><div><a href="/">← ClipHunt</a><h1>Két tài khoản & API</h1><p>Đang đăng nhập: <b>{status.profile.username}</b> · {status.profile.role==="admin"?"Admin":"Thành viên"}</p></div><button className="secondary" onClick={async()=>{await api("/api/auth/logout",{method:"POST"});location.reload()}}>Đăng xuất</button></div>
    <p className="security-note">🔒 Bí mật được mã hóa trên máy chủ. Mỗi lần xem đều phải nhập lại mật khẩu profile; thao tác được ghi nhật ký.</p>
    <section><h2>Tài khoản nền tảng / API</h2>{credentials.length===0?<p>Chưa có dữ liệu được cấp cho profile này.</p>:<div className="vault-list">{credentials.map(c=><article key={c.id}><div><b>{c.provider}</b><span>{c.label}{c.login_identifier?` · ${c.login_identifier}`:""}</span></div>{revealed[c.id]?<code>{revealed[c.id]}</code>:<form onSubmit={async e=>{e.preventDefault();const pw=String(new FormData(e.currentTarget).get("password"));try{const d=await api("/api/vault/reveal",{method:"POST",body:JSON.stringify({id:c.id,password:pw})});setRevealed(v=>({...v,[c.id]:d.secret}));setTimeout(()=>setRevealed(v=>{const n={...v};delete n[c.id];return n}),30000)}catch(err){setMessage((err as Error).message)}}}><input name="password" type="password" placeholder="Nhập mật khẩu để xem" required/><button>Xem 30 giây</button></form>}</article>)}</div>}</section>
    {status.profile.role==="admin"&&<><section><h2>Thêm API hoặc tài khoản</h2><form onSubmit={e=>submit(e,"/api/vault/credentials")}><input name="provider" placeholder="Nền tảng: YouTube, Reddit, X…" required/><input name="label" placeholder="Tên gợi nhớ" required/><input name="loginIdentifier" placeholder="Email / username (không bắt buộc)"/><textarea name="secret" placeholder="API key, token hoặc mật khẩu" required/><button>Mã hóa và lưu</button></form></section>
    <section><h2>Quản lý profile</h2><div className="profile-chips">{profiles.map(p=><span key={p.id}>{p.username} · {p.role} · {p.active?"hoạt động":"đã khóa"}</span>)}</div><form onSubmit={e=>submit(e,"/api/admin/profiles")}><input name="username" placeholder="Tên profile mới" required/><input name="password" type="password" minLength={12} placeholder="Mật khẩu tạm (tối thiểu 12 ký tự)" required/><select name="role"><option value="member">Thành viên</option><option value="admin">Admin</option></select><button>Tạo profile</button></form></section></>}
    <p className="notice">{message}</p>
  </main>
}
