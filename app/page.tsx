"use client";

import { FormEvent, useState } from "react";

type Video = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  source: string;
  channel?: string;
  duration?: number;
};

const suggestions = ["funny moments", "karen", "incredible moments"];

const sourceConnections = [
  { name: "Dailymotion", state: "Đang hoạt động", tone: "live" },
  { name: "PeerTube", state: "Đang hoạt động", tone: "live" },
  { name: "Internet Archive", state: "Đang hoạt động", tone: "live" },
  { name: "YouTube", state: "Cần API key", tone: "key" },
  { name: "Reddit", state: "Cần ứng dụng Reddit", tone: "key" },
  { name: "X", state: "Cần Bearer Token", tone: "key" },
  { name: "Web & báo chí", state: "Cần Google Search API", tone: "key" },
  { name: "Facebook / Instagram / Threads", state: "Chỉ nội dung được cấp quyền", tone: "limited" },
];

const externalSources = [
  {
    name: "Reddit",
    href: (query: string) =>
      `https://www.reddit.com/search/?q=${encodeURIComponent(query)}&type=media`,
  },
  {
    name: "X",
    href: (query: string) =>
      `https://x.com/search?q=${encodeURIComponent(`${query} filter:videos`)}&src=typed_query`,
  },
  {
    name: "Facebook",
    href: (query: string) =>
      `https://www.facebook.com/search/videos?q=${encodeURIComponent(query)}`,
  },
  {
    name: "Instagram",
    href: (query: string) =>
      `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(query)}`,
  },
  {
    name: "Threads",
    href: (query: string) =>
      `https://www.threads.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    name: "Rumble",
    href: (query: string) =>
      `https://rumble.com/search/video?q=${encodeURIComponent(query)}`,
  },
  {
    name: "Google News",
    href: (query: string) =>
      `https://news.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    name: "Bing Video",
    href: (query: string) =>
      `https://www.bing.com/videos/search?q=${encodeURIComponent(query)}`,
  },
];

function formatDuration(seconds?: number) {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");

  async function search(event?: FormEvent, nextQuery?: string) {
    event?.preventDefault();
    const term = (nextQuery ?? query).trim();
    if (!term) return;
    setQuery(term);
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(term)}&source=${source}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể tìm video");
      setVideos(data.items);
      setMessage(data.notice || "");
    } catch (error) {
      setVideos([]);
      setMessage(error instanceof Error ? error.message : "Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(video: Video) {
    await navigator.clipboard.writeText(video.url);
    setCopied(video.id);
    window.setTimeout(() => setCopied(""), 1400);
  }

  return (
    <main>
      <nav className="nav">
        <a className="brand" href="#" aria-label="ClipHunt trang chủ">
          <span className="brand-mark">▶</span>
          ClipHunt
        </a>
        <span className="status"><i /> Tìm kiếm đa nguồn</span>
      </nav>

      <section className="hero">
        <p className="eyebrow">VIDEO DISCOVERY ENGINE</p>
        <h1>Tìm đúng khoảnh khắc.<br /><em>Trong vài giây.</em></h1>
        <p className="intro">
          Nhập chủ đề bạn muốn tìm. ClipHunt tổng hợp video công khai,
          thumbnail và link gốc tại một nơi.
        </p>

        <form className="search-box" onSubmit={(event) => search(event)}>
          <span className="search-icon">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Thử "funny moments", "karen"...'
            aria-label="Từ khóa video"
          />
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            aria-label="Nguồn video"
          >
            <option value="all">Tất cả nguồn</option>
            <option value="dailymotion">Dailymotion</option>
            <option value="youtube">YouTube</option>
            <option value="peertube">PeerTube</option>
            <option value="archive">Internet Archive</option>
            <option value="reddit">Reddit</option>
            <option value="x">X</option>
            <option value="web">Web & báo chí</option>
          </select>
          <button disabled={loading}>{loading ? "Đang quét..." : "Tìm video"}</button>
        </form>

        <div className="suggestions">
          <span>Gợi ý:</span>
          {suggestions.map((item) => (
            <button key={item} onClick={() => search(undefined, item)}>{item}</button>
          ))}
        </div>

        <details className="connections">
          <summary>Trạng thái nguồn & yêu cầu kết nối</summary>
          <div className="connection-grid">
            {sourceConnections.map((item) => (
              <div className="connection-item" key={item.name}>
                <strong>{item.name}</strong>
                <span className={item.tone}>{item.state}</span>
              </div>
            ))}
          </div>
          <p>
            Đăng nhập tài khoản cá nhân không tự động cấp quyền tìm kiếm toàn nền
            tảng. Reddit, X, YouTube và tìm kiếm báo chí cần ứng dụng nhà phát
            triển/API key. Facebook, Instagram và Threads chỉ cho phép lấy phạm
            vi nội dung mà Meta đã cấp quyền cho ứng dụng.
          </p>
        </details>
      </section>

      <section className="results" aria-live="polite">
        {(videos.length > 0 || loading) && (
          <div className="results-head">
            <div>
              <p>KẾT QUẢ TÌM KIẾM</p>
              <h2>{loading ? "Đang tìm..." : `${videos.length} video cho “${query}”`}</h2>
            </div>
            <span>Link gốc • Thumbnail chất lượng cao</span>
          </div>
        )}

        {message && <div className="notice">{message}</div>}

        <div className="grid">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => <div className="card skeleton" key={index} />)
            : videos.map((video) => (
              <article className="card" key={`${video.source}-${video.id}`}>
                <a className="thumb" href={video.url} target="_blank" rel="noreferrer">
                  <img src={video.thumbnail} alt="" />
                  <span className="play">▶</span>
                  {video.duration ? <b>{formatDuration(video.duration)}</b> : null}
                </a>
                <div className="card-body">
                  <span className="source">{video.source}</span>
                  <h3><a href={video.url} target="_blank" rel="noreferrer">{video.title}</a></h3>
                  <p>{video.channel || "Kênh công khai"}</p>
                  <div className="card-actions">
                    <a href={video.url} target="_blank" rel="noreferrer">Mở video ↗</a>
                    <button onClick={() => copyLink(video)}>
                      {copied === video.id ? "Đã sao chép ✓" : "Sao chép link"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
        </div>

        {query && (
          <div className="external-search">
            <div>
              <p>TÌM THÊM TRÊN NỀN TẢNG GỐC</p>
              <h2>Các nguồn có thể yêu cầu bạn đăng nhập</h2>
            </div>
            <div className="external-links">
              {externalSources.map((item) => (
                <a
                  key={item.name}
                  href={item.href(query)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.name} ↗
                </a>
              ))}
            </div>
          </div>
        )}

        {!loading && videos.length === 0 && !message && (
          <div className="empty">
            <span>▶</span>
            <h2>Video bạn cần đang ở ngoài kia.</h2>
            <p>Bắt đầu với một từ khóa hoặc chọn gợi ý phía trên.</p>
          </div>
        )}
      </section>

      <footer>
        <span>ClipHunt MVP</span>
        <p>Chỉ hiển thị metadata và liên kết tới nội dung công khai. Bản quyền thuộc nền tảng và chủ sở hữu video.</p>
      </footer>
    </main>
  );
}
