"use client";

import { FormEvent, useEffect, useState } from "react";

type Profile = { id: string; username: string; email?: string | null; google_linked?: boolean; role: "admin" | "member"; active: boolean };
type Credential = { id: string; provider: string; label: string; login_identifier?: string };
type Status = { configured: boolean; initialized: boolean; googleConfigured?: boolean; profile: Profile | null };
type Field = { name: string; label: string; secret?: boolean; optional?: boolean };
type Platform = {
  id: string;
  name: string;
  mark: string;
  mode: string;
  summary: string;
  fields: Field[];
  guide: string[];
  docs: string;
};

const platforms: Platform[] = [
  { id:"google",name:"Google Web Search",mark:"G",mode:"API",summary:"Tìm video và trang báo trên web qua Programmable Search.",fields:[
    {name:"apiKey",label:"Google API key",secret:true},{name:"searchEngineId",label:"Search Engine ID (cx)"}
  ],guide:["Mở Google Cloud Console và chọn hoặc tạo project.","Bật Custom Search JSON API, sau đó tạo API key trong Credentials.","Tạo Programmable Search Engine và sao chép Search Engine ID (cx). Lưu ý: API này đã đóng với khách hàng mới."],docs:"https://developers.google.com/custom-search/v1/overview"},
  { id:"youtube",name:"YouTube",mark:"▶",mode:"API",summary:"Tìm video, kênh, playlist và thumbnail bằng YouTube Data API v3.",fields:[
    {name:"apiKey",label:"YouTube Data API key",secret:true},{name:"oauthClientId",label:"OAuth Client ID",optional:true},{name:"oauthClientSecret",label:"OAuth Client Secret",secret:true,optional:true}
  ],guide:["Tạo project trong Google Cloud Console.","Bật YouTube Data API v3.","Vào Credentials → Create credentials → API key. Chỉ cần OAuth nếu truy cập dữ liệu riêng tư."],docs:"https://developers.google.com/youtube/v3/getting-started"},
  { id:"x",name:"X",mark:"𝕏",mode:"API",summary:"Tìm bài đăng có video bằng X API v2.",fields:[
    {name:"bearerToken",label:"Bearer Token",secret:true},{name:"apiKey",label:"API Key",secret:true,optional:true},{name:"apiSecret",label:"API Key Secret",secret:true,optional:true}
  ],guide:["Đăng ký tài khoản tại X Developer Portal.","Tạo Project và App.","Trong Keys and tokens, tạo Bearer Token; quyền endpoint phụ thuộc gói X API."],docs:"https://developer.x.com/en/docs/authentication/oauth-2-0"},
  { id:"facebook",name:"Facebook",mark:"f",mode:"Meta API",summary:"Truy cập video của Page hoặc nội dung được người dùng cấp quyền.",fields:[
    {name:"appId",label:"Meta App ID"},{name:"appSecret",label:"Meta App Secret",secret:true},{name:"accessToken",label:"Page/User Access Token",secret:true}
  ],guide:["Tạo app trong Meta for Developers.","Thêm Facebook Login hoặc sản phẩm API phù hợp.","Tạo User/Page Access Token và xin đúng permissions; không thể quét nội dung riêng tư."],docs:"https://developers.facebook.com/docs/facebook-login/guides/access-tokens/"},
  { id:"instagram",name:"Instagram",mark:"◎",mode:"Meta API",summary:"Đọc media của tài khoản Professional đã cấp quyền.",fields:[
    {name:"appId",label:"Meta App ID"},{name:"appSecret",label:"Meta App Secret",secret:true},{name:"accessToken",label:"Instagram Access Token",secret:true},{name:"instagramAccountId",label:"Instagram Account ID",optional:true}
  ],guide:["Tài khoản Instagram cần là Business hoặc Creator.","Tạo Meta app và thêm Instagram API.","Cấu hình redirect URI, cấp quyền và đổi authorization code lấy access token."],docs:"https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started"},
  { id:"tiktok",name:"TikTok",mark:"♪",mode:"OAuth",summary:"Kết nối Login Kit/Display API để đọc video của tài khoản đã đồng ý.",fields:[
    {name:"clientKey",label:"Client Key"},{name:"clientSecret",label:"Client Secret",secret:true},{name:"accessToken",label:"Access Token",secret:true,optional:true},{name:"refreshToken",label:"Refresh Token",secret:true,optional:true}
  ],guide:["Tạo app tại TikTok for Developers.","Thêm Login Kit, khai báo HTTPS redirect URI và scopes như video.list.","Lấy Client Key/Secret; hoàn tất OAuth để nhận access/refresh token. App có thể cần xét duyệt."],docs:"https://developers.tiktok.com/doc/login-kit-web"},
  { id:"pinterest",name:"Pinterest",mark:"P",mode:"OAuth",summary:"Đọc Pin/video từ tài khoản đã cấp quyền qua Pinterest API.",fields:[
    {name:"appId",label:"App ID"},{name:"appSecret",label:"App Secret",secret:true},{name:"accessToken",label:"Access Token",secret:true},{name:"refreshToken",label:"Refresh Token",secret:true,optional:true}
  ],guide:["Đăng ký app trong Pinterest Developers.","Khai báo redirect URI và chọn scopes, ví dụ pins:read.","Thực hiện OAuth Authorization Code để nhận access token."],docs:"https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/"},
  { id:"dailymotion",name:"Dailymotion",mark:"d",mode:"API / tài khoản",summary:"Public search không cần đăng nhập; quản lý kênh cần OAuth/API key.",fields:[
    {name:"apiKey",label:"API Key / Client ID",secret:true},{name:"apiSecret",label:"API Secret / Client Secret",secret:true},{name:"username",label:"Tên đăng nhập kênh",optional:true},{name:"password",label:"Mật khẩu kênh",secret:true,optional:true}
  ],guide:["Đăng nhập Dailymotion Studio với quyền Owner/Admin.","Vào Organization → API keys → Create API key.","Chọn Public/Private key và OAuth grant phù hợp; secret thường chỉ hiển thị một lần."],docs:"https://developers.dailymotion.com/docs/authenticate"},
  { id:"peertube",name:"PeerTube",mark:"P2P",mode:"Instance OAuth",summary:"Public search thường không cần API; thao tác tài khoản dùng OAuth của từng instance.",fields:[
    {name:"instanceUrl",label:"URL PeerTube instance"},{name:"username",label:"Username",optional:true},{name:"password",label:"Password",secret:true,optional:true},{name:"clientId",label:"OAuth Client ID",secret:true,optional:true},{name:"clientSecret",label:"OAuth Client Secret",secret:true,optional:true}
  ],guide:["Nhập URL instance, ví dụ https://peertube.example.com.","Public video search không cần tài khoản.","Nếu cần đăng nhập, instance cung cấp client tại /api/v1/oauth-clients/local rồi đổi thông tin đăng nhập lấy token."],docs:"https://docs.joinpeertube.org/api/rest-getting-started"},
  { id:"rumble",name:"Rumble",mark:"R",mode:"Tài khoản / feed",summary:"Rumble chưa cung cấp API tìm kiếm công khai tổng quát; có thể lưu tài khoản/feed được cấp.",fields:[
    {name:"username",label:"Email / username"},{name:"password",label:"Password",secret:true},{name:"feedUrl",label:"RSS/Video feed URL",optional:true}
  ],guide:["Đăng nhập hoặc tạo tài khoản Rumble.","Nếu kênh cung cấp RSS/video feed, sao chép URL vào đây.","ClipHunt chỉ dùng nội dung công khai hoặc được tài khoản này cấp quyền; không vượt CAPTCHA/giới hạn nền tảng."],docs:"https://rumble.com/account/login"},
];

async function api(url:string, options?:RequestInit){
  const r=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options?.headers||{})}});
  const data=await r.json(); if(!r.ok) throw new Error(data.error||"Có lỗi xảy ra."); return data;
}

export default function Settings(){
  const [status,setStatus]=useState<Status|null>(null);
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [credentials,setCredentials]=useState<Credential[]>([]);
  const [message,setMessage]=useState("");
  const [revealed,setRevealed]=useState<Record<string,string>>({});
  const [selected,setSelected]=useState<Platform|null>(null);
  const googleError = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("error");

  const refresh=async()=>{const s=await api("/api/auth/status");setStatus(s);if(s.profile){setCredentials((await api("/api/vault/credentials")).credentials);if(s.profile.role==="admin")setProfiles((await api("/api/admin/profiles")).profiles)}};
  useEffect(()=>{refresh().catch(e=>setMessage(e.message))},[]);

  const submit=async(e:FormEvent<HTMLFormElement>,url:string)=>{
    e.preventDefault(); const form=e.currentTarget; setMessage("");
    const body=Object.fromEntries(new FormData(form));
    try{await api(url,{method:"POST",body:JSON.stringify(body)});form.reset();await refresh();setMessage("Đã lưu thành công.")}
    catch(err){setMessage((err as Error).message)}
  };

  const savePlatform=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault(); if(!selected)return; const form=e.currentTarget;
    const values=Object.fromEntries(new FormData(form));
    const loginIdentifier=String(values.username||values.email||values.instanceUrl||"");
    try{
      await api("/api/vault/credentials",{method:"POST",body:JSON.stringify({
        provider:selected.id,label:selected.name,loginIdentifier,secret:JSON.stringify(values)
      })});
      form.reset(); setSelected(null); await refresh(); setMessage(`${selected.name} đã được mã hóa và lưu.`);
    }catch(err){setMessage((err as Error).message)}
  };

  if(!status)return <main className="vault"><p>Đang kiểm tra bảo mật…</p></main>;
  if(!status.configured)return <main className="vault"><a href="/">← ClipHunt</a><h1>Két bảo mật chưa được kết nối</h1><p>Cần kết nối PostgreSQL và khóa mã hóa trên Vercel.</p></main>;
  if(!status.initialized)return <main className="vault"><a href="/">← ClipHunt</a><h1>Tạo admin đầu tiên</h1><p>Liên hệ quản trị viên máy chủ để hoàn tất khởi tạo.</p></main>;
  if(!status.profile)return <main className="vault"><a href="/">← ClipHunt</a><h1>Đăng nhập ClipHunt</h1><p>Đăng nhập bằng profile được admin cấp.</p><a className={`google-login ${status.googleConfigured?"":"disabled"}`} href={status.googleConfigured?"/api/auth/google/start":"#"} aria-disabled={!status.googleConfigured}><span>G</span> Đăng nhập bằng Google</a>{!status.googleConfigured&&<p className="oauth-note">Admin chưa cấu hình Google OAuth trên máy chủ.</p>}<div className="login-divider"><span>hoặc dùng mật khẩu</span></div><form onSubmit={async e=>{await submit(e,"/api/auth/login");location.reload()}}><input name="username" placeholder="Tên đăng nhập" required/><input name="password" type="password" placeholder="Mật khẩu" required/><button>Đăng nhập</button></form><details className="recovery"><summary>Không đăng nhập được? Khôi phục admin</summary><p>Đặt mật khẩu mới và xóa trạng thái khóa.</p><form onSubmit={e=>submit(e,"/api/auth/recover")}><input name="username" placeholder="Tên admin" required/><input name="password" type="password" minLength={12} placeholder="Mật khẩu mới (tối thiểu 12 ký tự)" required/><input name="bootstrapToken" type="password" placeholder="Mã khôi phục máy chủ" required/><button>Đặt lại mật khẩu admin</button></form></details>{googleError&&<p className="notice">{googleError==="google_not_linked"?"Email Google này chưa được admin gán cho profile ClipHunt.":googleError==="google_not_configured"?"Google OAuth chưa được cấu hình trên Vercel.":"Đăng nhập Google không thành công. Vui lòng thử lại."}</p>}<p className="notice">{message}</p></main>;

  const connected=new Set(credentials.map(c=>c.provider.toLowerCase()));
  return <main className="vault vault-wide">
    <div className="vault-head"><div><a href="/">← ClipHunt</a><h1>Kết nối nền tảng</h1><p>Đăng nhập: <b>{status.profile.username}</b> · {status.profile.role==="admin"?"Admin":"Thành viên"}</p></div><button className="secondary" onClick={async()=>{await api("/api/auth/logout",{method:"POST"});location.reload()}}>Đăng xuất</button></div>
    <p className="security-note">🔒 API key, token và mật khẩu được mã hóa trên máy chủ. ClipHunt không lưu bí mật trong trình duyệt.</p>
    {status.profile.role==="admin"?<section><div className="section-title"><div><p>10 KẾT NỐI</p><h2>Chọn nền tảng để cấu hình</h2></div><span>{connected.size}/{platforms.length} đã lưu</span></div>
      <div className="platform-grid">{platforms.map(p=><article className={`platform-card ${connected.has(p.id)?"connected":""}`} key={p.id}>
        <div className="platform-top"><b className={`platform-mark ${p.id}`}>{p.mark}</b><span>{connected.has(p.id)?"● Đã lưu":"○ Chưa kết nối"}</span></div>
        <h3>{p.name}</h3><small>{p.mode}</small><p>{p.summary}</p>
        <button onClick={()=>setSelected(p)}>{connected.has(p.id)?"Thêm cấu hình khác":"Cấu hình"}</button>
      </article>)}</div>
    </section>:<section><h2>Kết nối được cấp</h2><p>Admin quản lý và cấp quyền xem kết nối cho profile của bạn.</p></section>}

    <section><h2>Dữ liệu đã mã hóa</h2>{credentials.length===0?<p>Chưa có kết nối nào.</p>:<div className="vault-list">{credentials.map(c=><article key={c.id}><div><b>{platforms.find(p=>p.id===c.provider)?.name||c.provider}</b><span>{c.label}{c.login_identifier?` · ${c.login_identifier}`:""}</span></div>{revealed[c.id]?<code>{revealed[c.id]}</code>:<form onSubmit={async e=>{e.preventDefault();const pw=String(new FormData(e.currentTarget).get("password"));try{const d=await api("/api/vault/reveal",{method:"POST",body:JSON.stringify({id:c.id,password:pw})});setRevealed(v=>({...v,[c.id]:d.secret}));setTimeout(()=>setRevealed(v=>{const n={...v};delete n[c.id];return n}),30000)}catch(err){setMessage((err as Error).message)}}}><input name="password" type="password" placeholder="Nhập mật khẩu profile để xem" required/><button>Xem 30 giây</button></form>}</article>)}</div>}</section>

    {status.profile.role==="admin"&&<section><h2>Quản lý profile</h2><p>Nhập email Google của từng người để họ dùng nút “Đăng nhập bằng Google”. Google không tự tạo profile hoặc tự cấp quyền.</p><div className="profile-chips">{profiles.map(p=><span key={p.id}>{p.username} · {p.email||"chưa gán email"} · {p.google_linked?"Google đã liên kết":"Google chưa liên kết"} · {p.role} · {p.active?"hoạt động":"đã khóa"}</span>)}</div><form onSubmit={e=>submit(e,"/api/admin/profiles")}><input name="username" placeholder="Tên profile mới" required/><input name="email" type="email" placeholder="Email Google được phép đăng nhập"/><input name="password" type="password" minLength={12} placeholder="Mật khẩu tạm (tối thiểu 12 ký tự)" required/><select name="role"><option value="member">Thành viên</option><option value="admin">Admin</option></select><button>Tạo profile</button></form><details className="api-guide"><summary>Cấu hình nút Đăng nhập bằng Google</summary><ol><li>Tạo OAuth 2.0 Client loại Web application trong Google Cloud Console.</li><li>Thêm redirect URI: <code>{typeof window!=="undefined"?`${window.location.origin}/api/auth/google/callback`:"https://cliphunt-5pkc.vercel.app/api/auth/google/callback"}</code></li><li>Thêm GOOGLE_OAUTH_CLIENT_ID và GOOGLE_OAUTH_CLIENT_SECRET vào Environment Variables của Vercel rồi Redeploy.</li></ol><a href="https://developers.google.com/identity/protocols/oauth2/web-server" target="_blank" rel="noreferrer">Mở hướng dẫn chính thức của Google ↗</a></details></section>}
    <p className="notice">{message}</p>

    {selected&&<div className="platform-modal" role="dialog" aria-modal="true" aria-label={`Cấu hình ${selected.name}`}><div className="platform-dialog">
      <button className="modal-close" onClick={()=>setSelected(null)} aria-label="Đóng">×</button>
      <div className="dialog-heading"><b className={`platform-mark ${selected.id}`}>{selected.mark}</b><div><small>{selected.mode}</small><h2>{selected.name}</h2></div></div>
      <p>{selected.summary}</p>
      <form onSubmit={savePlatform}>{selected.fields.map(f=><label key={f.name}><span>{f.label}{f.optional?" (không bắt buộc)":""}</span><input name={f.name} type={f.secret?"password":"text"} required={!f.optional} autoComplete="off"/></label>)}<button>Mã hóa và lưu kết nối</button></form>
      <details className="api-guide" open><summary>Hướng dẫn lấy API / đăng nhập</summary><ol>{selected.guide.map((s,i)=><li key={i}>{s}</li>)}</ol><a href={selected.docs} target="_blank" rel="noreferrer">Mở tài liệu chính thức ↗</a></details>
    </div></div>}
  </main>;
}

