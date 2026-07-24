import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") || incoming.get("host") || "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;

  return {
    title: "ClipHunt — Tìm video theo từ khóa",
    description: "Tìm video công khai, thumbnail và link gốc từ nhiều nguồn.",
    openGraph: {
      title: "ClipHunt",
      description: "Tìm đúng khoảnh khắc. Trong vài giây.",
      images: [{ url: image, width: 1536, height: 901 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ClipHunt",
      description: "Tìm đúng khoảnh khắc. Trong vài giây.",
      images: [image],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
