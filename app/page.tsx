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
      if (!response.ok) throw new Error(data.error || "KhÃ´ng thá»ƒ tÃ¬m video");
      setVideos(data.items);
      setMessage(data.notice || "");
    } catch (error) {
      setVideos([]);
      setMessage(error instanceof Error ? error.message : "ÄÃ£ cÃ³ lá»—i xáº£y ra");
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
        <a className="brand" href="#" aria-label="ClipHunt trang chá»§">
          <span className="brand-mark">â–¶</span>
          ClipHunt
        </a>
        <span className="status"><i /> TÃ¬m kiáº¿m Ä‘a nguá»“n</span>
      </nav>

      <section className="hero">
        <p className="eyebrow">VIDEO DISCOVERY ENGINE</p>
        <h1>TÃ¬m Ä‘Ãºng khoáº£nh kháº¯c.<br /><em>Trong vÃ i giÃ¢y.</em></h1>
        <p className="intro">
          Nháº­p chá»§ Ä‘á» báº¡n muá»‘n tÃ¬m. ClipHunt tá»•ng há»£p video cÃ´ng khai,
          thumbnail vÃ  link gá»‘c táº¡i má»™t nÆ¡i.
        </p>

        <form className="search-box" onSubmit={(event) => search(event)}>
          <span className="search-icon">âŒ•</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Thá»­ "funny moments", "karen"...'
            aria-label="Tá»« khÃ³a video"
          />
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            aria-label="Nguá»“n video"
          >
            <option value="all">Táº¥t cáº£ nguá»“n</option>
            <option value="dailymotion">Dailymotion</option>
            <option value="youtube">YouTube</option>
            <option value="peertube">PeerTube</option>
            <option value="archive">Internet Archive</option>
          </select>
          <button disabled={loading}>{loading ? "Äang quÃ©t..." : "TÃ¬m video"}</button>
        </form>

        <div className="suggestions">
          <span>Gá»£i Ã½:</span>
          {suggestions.map((item) => (
            <button key={item} onClick={() => search(undefined, item)}>{item}</button>
          ))}
        </div>
      </section>

      <section className="results" aria-live="polite">
        {(videos.length > 0 || loading) && (
          <div className="results-head">
            <div>
              <p>Káº¾T QUáº¢ TÃŒM KIáº¾M</p>
              <h2>{loading ? "Äang tÃ¬m..." : `${videos.length} video cho â€œ${query}â€`}</h2>
            </div>
            <span>Link gá»‘c â€¢ Thumbnail cháº¥t lÆ°á»£ng cao</span>
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
                  <span className="play">â–¶</span>
                  {video.duration ? <b>{formatDuration(video.duration)}</b> : null}
                </a>
                <div className="card-body">
                  <span className="source">{video.source}</span>
                  <h3><a href={video.url} target="_blank" rel="noreferrer">{video.title}</a></h3>
                  <p>{video.channel || "KÃªnh cÃ´ng khai"}</p>
                  <div className="card-actions">
                    <a href={video.url} target="_blank" rel="noreferrer">Má»Ÿ video â†—</a>
                    <button onClick={() => copyLink(video)}>
                      {copied === video.id ? "ÄÃ£ sao chÃ©p âœ“" : "Sao chÃ©p link"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
        </div>

        {!loading && videos.length === 0 && !message && (
          <div className="empty">
            <span>â–¶</span>
            <h2>Video báº¡n cáº§n Ä‘ang á»Ÿ ngoÃ i kia.</h2>
            <p>Báº¯t Ä‘áº§u vá»›i má»™t tá»« khÃ³a hoáº·c chá»n gá»£i Ã½ phÃ­a trÃªn.</p>
          </div>
        )}
      </section>

      <footer>
        <span>ClipHunt MVP</span>
        <p>Chá»‰ hiá»ƒn thá»‹ metadata vÃ  liÃªn káº¿t tá»›i ná»™i dung cÃ´ng khai. Báº£n quyá»n thuá»™c ná»n táº£ng vÃ  chá»§ sá»Ÿ há»¯u video.</p>
      </footer>
    </main>
  );
}

