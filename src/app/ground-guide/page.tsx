import type { Metadata } from "next";
import { GroundGuide } from "@/components/ground-guide/GroundGuide";

export const metadata: Metadata = { title: "3D集合案内 | 長田高校 体育祭", robots: { index: false, follow: false } };

/** 出場競技の既存画面から独立した、DB不要の案内入口。 */
export default async function GroundGuidePage({ searchParams }: { searchParams: Promise<{ id?: string; event?: string }> }) {
  const params = await searchParams;
  return <GroundGuide initialStudentId={typeof params.id==="string"?params.id:""} initialEvent={typeof params.event==="string"?params.event:""}/>;
}
