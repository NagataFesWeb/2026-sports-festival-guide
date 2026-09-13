// robots.txt。カジノ・管理画面・API は検索エンジンに載せない（隠し入口の趣旨を守る）
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/casino", "/api", "/admin"] }],
  };
}
