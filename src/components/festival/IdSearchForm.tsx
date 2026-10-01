// 学籍番号で招集案内を探すフォーム。NextのFormでページ全体を読み直さずに移動する。
import Form from "next/form";
interface IdSearchFormProps {
  /** cta = トップのピンク帯の中、page = クリーム地のセクション内 */
  tone: "cta" | "page";
  buttonLabel: string;
  defaultValue?: string;
  inputId?: string;
  /** 静的な案内版など、検索先のサーバーが無いときに操作を止める */
  disabled?: boolean;
}

export function IdSearchForm({
  tone,
  buttonLabel,
  defaultValue,
  inputId = "invite-student-id",
  disabled = false,
}: IdSearchFormProps) {
  const cta = tone === "cta";
  return (
    <Form action="/me" className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 basis-40">
        <label
          htmlFor={inputId}
          className={`block text-[10px] font-black tracking-[0.24em] ${cta ? "text-white/80" : "text-om-gray-3"}`}
        >
          学籍番号
        </label>
        {/* 全角入力も受け付ける（サーバー側で半角に正規化する）。16px 未満にすると iOS で拡大される */}
        <input
          id={inputId}
          name="id"
          type="text"
          inputMode="numeric"
          pattern="[0-9０-９]*"
          maxLength={8}
          autoComplete="off"
          defaultValue={defaultValue}
          disabled={disabled}
          className="mt-2 h-12 w-full border-2 border-om-ink bg-white px-3 text-[16px] text-om-ink"
        />
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="h-12 cursor-pointer border-2 border-om-ink bg-om-yellow px-6 font-display text-[clamp(13px,2.4vw,16px)] tracking-[0.14em] text-om-ink shadow-[6px_6px_0_#111]"
      >
        {disabled ? "STATIC PREVIEW" : buttonLabel}
      </button>
    </Form>
  );
}
