// robots.txt。公開 URL は直接共有できるが、検索エンジンの巡回は許可しない
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
