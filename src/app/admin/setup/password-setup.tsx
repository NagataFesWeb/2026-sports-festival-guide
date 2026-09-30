"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { setupTokenFromHash } from "@/lib/admin/setup-link";

export function PasswordSetup() {
  const [accessToken, setAccessToken] = useState("");
  const [state, setState] = useState<"checking" | "ready" | "saving" | "done" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Supabase の招待・再設定リンクは URL フラグメントに短命なトークンを付ける。
    // 読み取ったら履歴から直ちに消し、ページ遷移時に残さない。
    const token = setupTokenFromHash(window.location.hash);
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      window.history.replaceState(null, "", "/admin/setup");
      if (token) {
        setAccessToken(token);
        setState("ready");
      } else {
        setState("invalid");
      }
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("パスワードは12文字以上で入力してください。");
      return;
    }
    if (password !== confirmation) {
      setError("確認用パスワードが一致しません。");
      return;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key || !accessToken) {
      setError("認証の設定を確認できません。管理者に連絡してください。");
      return;
    }

    setState("saving");
    try {
      const response = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/user`, {
        method: "PUT",
        headers: {
          apikey: key,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "リンクの有効期限が切れています。新しいメールの送信を管理者に依頼してください。"
            : "パスワードを設定できませんでした。別のパスワードをお試しください。",
        );
        setState("ready");
        return;
      }
      setPassword("");
      setConfirmation("");
      setAccessToken("");
      setState("done");
    } catch {
      setError("通信に失敗しました。接続を確認して、もう一度お試しください。");
      setState("ready");
    }
  }

  if (state === "checking") return <p className="adm-card">招待リンクを確認しています…</p>;
  if (state === "invalid") {
    return (
      <div className="adm-card">
        <p>有効な招待・再設定リンクがありません。届いたメールのリンクから開いてください。</p>
        <Link className="mt-4 inline-block underline" href="/admin/login">実行委員ログインへ</Link>
      </div>
    );
  }
  if (state === "done") {
    return (
      <div className="adm-card">
        <p>パスワードを設定しました。</p>
        <Link className="mt-4 inline-block underline" href="/admin/login">実行委員ログインへ</Link>
      </div>
    );
  }

  return (
    <form className="adm-card" onSubmit={submit}>
      <p className="mb-5">招待された実行委員アカウントのパスワードを設定してください。</p>
      <div className="grid gap-3">
        <label className="adm-field">
          <span>新しいパスワード（12文字以上）</span>
          <input className="adm-input" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="adm-field">
          <span>確認用パスワード</span>
          <input className="adm-input" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </label>
      </div>
      {error && <p className="mt-4" role="alert">{error}</p>}
      <button className="adm-btn mt-5" type="submit" disabled={state === "saving"}>
        {state === "saving" ? "設定中…" : "パスワードを設定"}
      </button>
    </form>
  );
}
