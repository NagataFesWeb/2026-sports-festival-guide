import type { Metadata } from "next";
import { Anton, Noto_Sans_JP, Share_Tech_Mono, Shippori_Mincho_B1 } from "next/font/google";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
// 表画面の日本語大見出し（モック v2「爆裂」）。日本語フォントは preload しない
const shipporiMincho = Shippori_Mincho_B1({
  weight: ["600", "800"],
  subsets: ["latin"],
  variable: "--font-shippori-mincho",
  display: "swap",
  preload: false,
});
const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-share-tech-mono",
  display: "swap",
});
const notoSansJp = Noto_Sans_JP({
  weight: ["400", "700", "900"],
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "長田すぎて滅！青春爆裂愛してる",
  description: "長田高校 第79回 体育祭",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${anton.variable} ${shareTechMono.variable} ${notoSansJp.variable} ${shipporiMincho.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
