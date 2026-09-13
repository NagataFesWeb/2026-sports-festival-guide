// 裏画面（UNDERGROUND）。表画面のヘッダー・ナビ・フッターは引き継がない
import type { Metadata } from "next";
import { SoundProvider } from "@/components/underground/sound";
import { DeveloperPanel } from "@/components/underground/DeveloperPanel";

export const metadata: Metadata = {
  title: "NAGATA UNDERGROUND",
  robots: { index: false, follow: false },
};

export default function CasinoLayout({ children }: LayoutProps<"/casino">) {
  return <SoundProvider>{children}{process.env.NODE_ENV === "development" && <DeveloperPanel sharedSound />}</SoundProvider>;
}
