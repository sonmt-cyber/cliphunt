import { NextRequest, NextResponse } from "next/server";

type Video = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  source: string;
  channel?: string;
  duration?: number;
};

async function searchDailymotion(query: string): Promise<Video[]> {
  const fields = "id,title,url,thumbnail_720_url,thumbnail_480_url,owner.screenname,duration";
  const endpoint = new URL("https://api.dailymotion.com/videos");
  endpoint.searchParams.set("search", query);
  endpoint.searchParams.set("fields", fields);
  endpoint.searchParams.set("limit", "18");
  endpoint.searchParams.set("sort", "relevance");

  const response = await fetch(endpoint, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error("Dailymotion chưa phản hồi");
  const data = await response.json();
  return (data.list || []).map((item: Record<string, unknown>) => ({
    id: String(item.id),
    title: String(item.title),
    url: String(item.url),
    thumbnail: String(item.thumbnail_720_url || item.thumbnail_480_url),
    source: "Dailymotion",
    channel: String(item["owner.screenname"] || ""),
    duration: Number(item.duration || 0),
  }));
}

async function searchYouTube(query: string): Promise<Video[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
  endpoint.searchParams.set("part", "snippet");
  endpoint.searchParams.set("type", "video");
  endpoint.searchParams.set("maxResults", "18");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("key", key);

  const response = await fetch(endpoint, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error("YouTube chưa phản hồi");
  const data = await response.json();
  return (data.items || []).map((item: Record<string, any>) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
    source: "YouTube",
    channel: item.snippet.channelTitle,
  }));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const source = request.nextUrl.searchParams.get("source") || "all";
  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Từ khóa cần ít nhất 2 ký tự." }, { status: 400 });
  }

  try {
    const tasks: Promise<Video[]>[] = [];
    if (source === "all" || source === "dailymotion") tasks.push(searchDailymotion(query));
    if (source === "all" || source === "youtube") tasks.push(searchYouTube(query));
    const items = (await Promise.all(tasks)).flat();
    const youtubeMissing = (source === "all" || source === "youtube") && !process.env.YOUTUBE_API_KEY;

    return NextResponse.json({
      items,
      notice: youtubeMissing
        ? "YouTube cần YOUTUBE_API_KEY. Hiện kết quả trực tiếp đến từ Dailymotion."
        : "",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tìm video lúc này." },
      { status: 502 },
    );
  }
}
