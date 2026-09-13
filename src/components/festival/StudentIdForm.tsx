"use client";

// /login の入力欄。認証ではなく検索キーの入力なので、形式だけを確かめて /me へ送る
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { normalizeStudentId } from "@/lib/festival/student-id";

const ERROR_TEXT = "学籍番号は数字で入力してください（1〜8桁）";
const ERROR_ID = "student-id-error";
const INPUT_ID = "student-id";

export function StudentIdForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [sending, setSending] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const studentId = normalizeStudentId(value);
    if (studentId === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setSending(true);
    router.push(`/me?id=${encodeURIComponent(studentId)}`);
  }

  return (
    // ブラウザ既定の検証バブルではなく、下の文字でエラーを出す
    <form noValidate onSubmit={submit} className="mt-5">
      <label htmlFor={INPUT_ID} className="block text-[10px] font-black tracking-[0.24em] text-om-gray-3">
        学籍番号
      </label>
      {/* 16px 未満にすると iOS で自動拡大される */}
      <input
        id={INPUT_ID}
        name="id"
        type="text"
        inputMode="numeric"
        pattern="[0-9０-９]*"
        maxLength={8}
        autoComplete="off"
        autoFocus
        value={value}
        aria-invalid={invalid}
        aria-describedby={invalid ? ERROR_ID : undefined}
        onChange={(event) => {
          setValue(event.target.value);
          setInvalid(false);
        }}
        className={`mt-2 h-12 w-full border-2 bg-white px-3 font-display text-[16px] tracking-[0.14em] text-om-ink ${
          invalid ? "border-om-pink" : "border-om-ink"
        }`}
      />
      {invalid ? (
        <p id={ERROR_ID} role="alert" className="mt-2 text-[12.5px] font-black text-om-pink">
          {ERROR_TEXT}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={sending}
        className="mt-5 h-12 w-full cursor-pointer border-2 border-om-ink bg-om-yellow px-6 font-display text-[15px] tracking-[0.14em] text-om-ink shadow-[6px_6px_0_#111] disabled:opacity-50 sm:w-auto"
      >
        {sending ? "CHECKING..." : "CHECK IT OUT →"}
      </button>
    </form>
  );
}
