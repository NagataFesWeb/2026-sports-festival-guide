import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "長田すぎて滅！青春爆裂愛してる",
  description: "長田高校 第79回 体育祭（GitHub Pages 暫定公開版）",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" data-motion="full">
      <body>{children}</body>
    </html>
  );
}
