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

type SourceKey =
  | "dailymotion"
  | "youtube"
  | "peertube"
  | "archive"
  | "reddit"
  | "x"
  | "web";

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

async function searchReddit(query: string): Promise<Video[]> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const tokenResponse = await fetch(
    "https://www.reddit.com/api/v1/access_token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "ClipHunt/1.0 by sonmt-cyber",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    },
  );
  if (!tokenResponse.ok) throw new Error("Reddit chưa phản hồi");
  const tokenData = await tokenResponse.json();

  const endpoint = new URL("https://oauth.reddit.com/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("type", "link");
  endpoint.searchParams.set("sort", "relevance");
  endpoint.searchParams.set("limit", "18");
  endpoint.searchParams.set("raw_json", "1");

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "ClipHunt/1.0 by sonmt-cyber",
    },
    next: { revalidate: 180 },
  });
  if (!response.ok) throw new Error("Reddit chưa phản hồi");
  const data = await response.json();

  return (data.data?.children || [])
    .map((child: Record<string, any>) => child.data)
    .map((item: Record<string, any>) => {
      const preview = item.preview?.images?.[0]?.source?.url?.replace(
        /&amp;/g,
        "&",
      );
      const thumbnail =
        preview || (String(item.thumbnail).startsWith("http") ? item.thumbnail : "");
      return {
        id: String(item.id),
        title: String(item.title),
        url: `https://www.reddit.com${item.permalink}`,
        thumbnail,
        source: "Reddit",
        channel: String(item.subreddit_name_prefixed || item.author || "Reddit"),
        duration: Number(item.media?.reddit_video?.duration || 0),
      };
    })
    .filter((item: Video) => item.thumbnail);
}

async function searchX(query: string): Promise<Video[]> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return [];

  const endpoint = new URL("https://api.x.com/2/tweets/search/recent");
  endpoint.searchParams.set("query", `${query} has:videos -is:retweet`);
  endpoint.searchParams.set("max_results", "18");
  endpoint.searchParams.set("expansions", "attachments.media_keys,author_id");
  endpoint.searchParams.set("media.fields", "preview_image_url,type,url");
  endpoint.searchParams.set("user.fields", "name,username");

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 180 },
  });
  if (!response.ok) throw new Error("X chưa phản hồi");
  const data = await response.json();
  const media = new Map(
    (data.includes?.media || []).map((item: Record<string, any>) => [
      item.media_key,
      item,
    ]),
  );
  const users = new Map(
    (data.includes?.users || []).map((item: Record<string, any>) => [
      item.id,
      item,
    ]),
  );

  return (data.data || [])
    .map((item: Record<string, any>) => {
      const mediaItem = (item.attachments?.media_keys || [])
        .map((key: string) => media.get(key))
        .find((entry: Record<string, any>) => entry?.type === "video");
      const user = users.get(item.author_id) as Record<string, any> | undefined;
      return {
        id: String(item.id),
        title: String(item.text || "Video trên X"),
        url: `https://x.com/i/web/status/${item.id}`,
        thumbnail: String(mediaItem?.preview_image_url || ""),
        source: "X",
        channel: user ? `@${user.username}` : "X",
      };
    })
    .filter((item: Video) => item.thumbnail);
}

async function searchWeb(query: string): Promise<Video[]> {
  const key = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!key || !cx) return [];

  const endpoint = new URL("https://www.googleapis.com/customsearch/v1");
  endpoint.searchParams.set("key", key);
  endpoint.searchParams.set("cx", cx);
  endpoint.searchParams.set("q", `${query} video OR watch`);
  endpoint.searchParams.set("num", "10");
  endpoint.searchParams.set("safe", "active");

  const response = await fetch(endpoint, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error("Tìm kiếm Web chưa phản hồi");
  const data = await response.json();
  return (data.items || [])
    .map((item: Record<string, any>, index: number) => {
      const thumbnail =
        item.pagemap?.cse_thumbnail?.[0]?.src ||
        item.pagemap?.imageobject?.[0]?.thumbnailurl ||
        item.pagemap?.metatags?.[0]?.["og:image"] ||
        "";
      const host = new URL(item.link).hostname.replace(/^www\./, "");
      return {
        id: `${index}-${item.cacheId || item.link}`,
        title: String(item.title),
        url: String(item.link),
        thumbnail: String(thumbnail),
        source: "Web & News",
        channel: host,
      };
    })
    .filter((item: Video) => item.thumbnail);
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
    {
      key: "reddit",
      label: "Reddit",
      enabled: Boolean(
        process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET,
      ),
      search: searchReddit,
    },
    {
      key: "x",
      label: "X",
      enabled: Boolean(process.env.X_BEARER_TOKEN),
      search: searchX,
    },
    {
      key: "web",
      label: "Web & News",
      enabled: Boolean(
        process.env.GOOGLE_SEARCH_API_KEY &&
          process.env.GOOGLE_SEARCH_ENGINE_ID,
      ),
      search: searchWeb,
    },
  ];

  const selected = providers.filter(
    (provider) =>
      provider.enabled && (source === "all" || source === provider.key),
  );

  const requestedProvider = providers.find((provider) => provider.key === source);
  if (source !== "all" && requestedProvider && !requestedProvider.enabled) {
    return NextResponse.json({
      items: [],
      notice: `${requestedProvider.label} chưa được kết nối. Quản trị viên cần thêm thông tin API trong Vercel.`,
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
  const optionalMissing = providers
    .filter(
      (provider) =>
        !provider.enabled &&
        provider.key !== "youtube" &&
        (source === "all" || source === provider.key),
    )
    .map((provider) => provider.label);

  return NextResponse.json({
    items: successful.flatMap((result) => result.items),
    activeSources: successful.map((result) => result.label),
    notice: [
      youtubeMissing
        ? "YouTube cần YOUTUBE_API_KEY; các nguồn công khai khác vẫn đang hoạt động."
        : "",
      optionalMissing.length
        ? `Chưa kết nối: ${optionalMissing.join(", ")}.`
        : "",
      failedCount > 0
        ? `${failedCount} nguồn tạm thời không phản hồi; kết quả từ các nguồn còn lại vẫn được hiển thị.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  });
}
