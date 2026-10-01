"use client";

// スマホでは種目選択を1行に収め、入力欄までのスクロールを減らす。
import { useRouter } from "next/navigation";

interface Props { selected: string; options: { id: string; label: string }[] }
export function ResultEventSelect({ selected, options }: Props) {
  const router = useRouter();
  return <label className="adm-field sm:hidden">
    <span>結果入力する種目</span>
    <select className="adm-input" value={selected} onChange={event => router.push(`/admin?tab=results&event=${encodeURIComponent(event.target.value)}`)}>
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </label>;
}
