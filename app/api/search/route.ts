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

type SourceKey = "dailymotion" | "youtube" | "peertube" | "archive";

async function searchDailymotion(query: string): Promise<Video[]> {
  const fields =
    "id,title,url,thumbnail_720_url,thumbnail_480_url,owner.screenname,duration";
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
    thumbnail:
      item.snippet.thumbnails.high?.url ||
      item.snippet.thumbnails.medium?.url,
    source: "YouTube",
    channel: item.snippet.channelTitle,
  }));
}

async function searchPeerTube(query: string): Promise<Video[]> {
  const endpoint = new URL("https://sepiasearch.org/api/v1/search/videos");
  endpoint.searchParams.set("search", query);
  endpoint.searchParams.set("count", "18");
  endpoint.searchParams.set("sort", "-match");
  endpoint.searchParams.set("nsfw", "false");

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error("PeerTube chưa phản hồi");
  const data = await response.json();

  return (data.data || [])
    .map((item: Record<string, any>) => {
      const host =
        item.channel?.host ||
        item.account?.host ||
        (item.url ? new URL(item.url).host : "");
      const thumbnail =
        item.thumbnailUrl ||
        (item.thumbnailPath && host
          ? `https://${host}${item.thumbnailPath}`
          : "");

      return {
        id: String(item.uuid || item.id),
        title: String(item.name || item.title || "Video PeerTube"),
        url: String(item.url || `https://${host}/w/${item.uuid}`),
        thumbnail,
        source: "PeerTube",
        channel: String(
          item.account?.displayName || item.channel?.displayName || host,
        ),
        duration: Number(item.duration || 0),
      };
    })
    .filter((item: Video) => item.url && item.thumbnail);
}

async function searchInternetArchive(query: string): Promise<Video[]> {
  const endpoint = new URL("https://archive.org/advancedsearch.php");
  endpoint.searchParams.set("q", `(${query}) AND mediatype:(movies)`);
  endpoint.searchParams.append("fl[]", "identifier");
  endpoint.searchParams.append("fl[]", "title");
  endpoint.searchParams.append("fl[]", "creator");
  endpoint.searchParams.set("rows", "18");
  endpoint.searchParams.set("page", "1");
  endpoint.searchParams.set("output", "json");
  endpoint.searchParams.append("sort[]", "downloads desc");

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error("Internet Archive chưa phản hồi");
  const data = await response.json();

  return (data.response?.docs || []).map((item: Record<string, any>) => {
    const id = String(item.identifier);
    const creator = Array.isArray(item.creator)
      ? item.creator.join(", ")
      : String(item.creator || "Internet Archive");

    return {
      id,
      title: String(item.title || id),
      url: `https://archive.org/details/${encodeURIComponent(id)}`,
      thumbnail: `https://archive.org/services/img/${encodeURIComponent(id)}`,
      source: "Internet Archive",
      channel: creator,
    };
  });
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const source = request.nextUrl.searchParams.get("source") || "all";
  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Từ khóa cần ít nhất 2 ký tự." },
      { status: 400 },
    );
  }

  const providers: Array<{
    key: SourceKey;
    label: string;
    enabled: boolean;
    search: (value: string) => Promise<Video[]>;
  }> = [
    {
      key: "dailymotion",
      label: "Dailymotion",
      enabled: true,
      search: searchDailymotion,
    },
    {
      key: "youtube",
      label: "YouTube",
      enabled: Boolean(process.env.YOUTUBE_API_KEY),
      search: searchYouTube,
    },
    {
      key: "peertube",
      label: "PeerTube",
      enabled: true,
      search: searchPeerTube,
    },
    {
      key: "archive",
      label: "Internet Archive",
      enabled: true,
      search: searchInternetArchive,
    },
  ];

  const selected = providers.filter(
    (provider) =>
      provider.enabled && (source === "all" || source === provider.key),
  );

  if (source === "youtube" && !process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({
      items: [],
      notice: "YouTube chưa được kết nối. Cần thêm YOUTUBE_API_KEY trong Vercel.",
      activeSources: providers
        .filter((item) => item.enabled)
        .map((item) => item.label),
    });
  }

  const settled = await Promise.allSettled(
    selected.map(async (provider) => ({
      label: provider.label,
      items: await provider.search(query),
    })),
  );
  const successful = settled
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<{
        label: string;
        items: Video[];
      }> => result.status === "fulfilled",
    )
    .map((result) => result.value);
  const failedCount = settled.length - successful.length;
  const youtubeMissing =
    (source === "all" || source === "youtube") &&
    !process.env.YOUTUBE_API_KEY;

  return NextResponse.json({
    items: successful.flatMap((result) => result.items),
    activeSources: successful.map((result) => result.label),
    notice: [
      youtubeMissing
        ? "YouTube cần YOUTUBE_API_KEY; các nguồn công khai khác vẫn đang hoạt động."
        : "",
      failedCount > 0
        ? `${failedCount} nguồn tạm thời không phản hồi; kết quả từ các nguồn còn lại vẫn được hiển thị.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  });
}
