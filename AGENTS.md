# AGENTS.md

> このプロジェクトでコードを書く**すべての AI エージェント（Codex / Cursor / Claude Code など）共通の作業規約**。作業前に読むこと。Claude Code は `CLAUDE.md` 経由で読み込む。

## ドキュメントの役割
- **README.md**（直下・人間向け）：概要・フォルダ構成・使い方。AI 専用手順は書かない。
- **AGENTS.md**（このファイル）：作業規約・コマンド・検証ループ・ドキュメント同期規約。
- **CLAUDE.md**（直下）：Claude Code 固有の補足のみ（このファイルを読み込む薄いラッパ）。
- **docs/**：`spec.md`（仕様・受け入れ条件＝合格ライン）、`README.md`（索引）、`data-model.md`、`ui.md`。

作業前に：概要は README.md、実装する機能と受け入れ条件は `docs/spec.md`、データ構造は `docs/data-model.md`、画面遷移は `docs/ui.md` を読む。

## Tech Stack
| レイヤー | 技術 |
|---|---|
| フロントエンド/バックエンド | Next.js（App Router, TypeScript） |
| DB・認証 | Supabase（Postgres + Auth、無料枠） |
| デプロイ | Vercel（無料枠） |
| UIベース | Tailwind CSS + shadcn/ui |
| 基本アニメーション | Framer Motion（カード反転・画面遷移・数値カウントアップ等） |
| 複雑な演出 | GSAP（スロットのリール同期など複数要素のタイムライン制御） |
| アニメ素材 | Lottie（lottie-react）（トランプ・スロット等の既成アニメーション） |
| 当選演出 | canvas-confetti |
| 効果音 | Howler.js |

> 導入済みは Next.js・TypeScript・Tailwind CSS・Vitest のみ。shadcn/ui・Framer Motion・GSAP・Lottie・canvas-confetti・Howler.js・`@supabase/supabase-js` は未導入（演出は CSS keyframes と WebAudio、Supabase は PostgREST を `fetch` で直接呼ぶ `src/lib/db/supabase.ts`）。必要になった時点で相談して追加する。
> Supabase CLI 2.119.0はDB管理用の開発依存として導入済み。Next.jsとeslint-config-nextは16.3.8に合わせている。
>
> テーマは表画面「爆裂」（`docs/mockup/` のモック v2 が出典）と裏画面（カジノ）「古い賭博端末」で完全に切り替える。トークンは `docs/DESIGN.festival.md`（表）と `docs/DESIGN.underground.md`（裏）に固定済み。UI を触るときは先にこれを読み、表画面はモックの CSS を正として独自のアレンジを加えない。
>
> データアクセスは必ず `src/lib/db/repository.ts` のインターフェース越しに行う（`getRepository()`）。環境変数が無ければメモリ実装、あれば Supabase 実装に切り替わる。
>
> 例外は**出場競技表**（誰がどの競技の何人目か）。速度優先で DB を通さず、`data/学籍番号別出場競技.csv` を `scripts/generate-entries.mjs` が `src/lib/festival/entries.data.ts`（自動生成・編集禁止）に変換して同梱する。参照は `src/lib/festival/entries.ts` 経由。CSV は頻繁に差し替わるので、生成物を手で直さず必ず `npm run entries` で作り直すこと。

## Commands
```bash
npm install     # 依存
npm run dev     # 起動
npm test        # テスト
npm run lint    # Lint・型（next typegen → eslint → tsc --noEmit）
npm run build   # ビルド
npm run entries # 出場競技表（data/学籍番号別出場競技.csv）から静的データを生成。dev・build・test・lint の前に自動実行
npm run db:login # Supabase CLIのブラウザ認証（初回のみ）
npm run db:check # 接続先DBの準備確認（読み取りのみ）
npm run db:sql -- supabase/casino-status.sql # SQLファイル実行
npm run db:apply-casino # 原子的保存SQL→空DBの当日設定→準備確認
```

> package.json に実装済み。アプリ用6コマンドとCLI認証・接続・SQL実行・カジノSQL適用を確認済み。CLIは開発依存、接続先は `.env.local` から取得する。スクリプトを変えたらここも直し、動くコマンドだけを残すこと。動かないコマンドを書くと未検証のまま完了宣言される。
> テストは Vitest（`src/**/*.test.ts`、設定は `vitest.config.ts`。`@/` エイリアスが使え、`DB_PERSIST=0` でメモリ DB をファイルに書かない）。Next.js は 16 系で API が変わっているため、コードを書く前に `node_modules/next/dist/docs/` の該当ガイドを読むこと（末尾の nextjs-agent-rules は `next dev` が自動で追記する）。
>
> 画面の目視確認は Chrome 拡張が無くてもできる: `chrome.exe --headless=new --remote-debugging-port` を起動し、DevTools Protocol で `Emulation.setDeviceMetricsOverride`（390px 幅）と `Network.setCookie`（`casino_session` / `admin_session`）を使って撮影する。`--window-size` だけでは Chrome の最小幅で狭幅の確認ができない。

## Verification Loop（検証ループ）
**機能を実装したら、完了宣言の前に必ず回す。** 最重要の規約。

1. 実装する
2. 検証する：`npm test` / `npm run lint` / `npm run build`（受け入れ条件に対応するもの）
3. `docs/spec.md` の該当機能の**受け入れ条件**を1つずつ照合
4. 1つでも失敗・未達なら原因を直して 2 に戻る
5. すべて green かつ全受け入れ条件 ○ で初めて「完了」

ルール：テスト/Lint/型/ビルドにエラーがある状態で「完了」と言わない。仕様の不備で満たせないときは `docs/spec.md` の「未決定事項」に追記して相談。手動確認は何をどう確認したか一言報告。テストの無い受け入れ条件は可能なら先にテストを書く。特にポイント計算（オッズ・配当・利子）はロジックが複雑なので単体テストを必ず書く。

## ドキュメント同期規約
コードだけ進んで docs が古くなると土台が嘘になる。だから：
- **仕様や挙動を変えたら、対応するドキュメントを同じ変更（コミット）で更新する**：機能・受け入れ条件・タスク→`docs/spec.md`、データの形→`docs/data-model.md`、画面→`docs/ui.md`、使い方・セットアップ→`README.md`。
- **docs を増減したら `docs/README.md` の索引も直す。**
- 今すぐ直せないズレは `docs/spec.md` の「未決定事項」に残して放置しない。

## コーディング規約
- `any` 禁止（型を明示する）
- コメントは日本語
- ポイント・オッズ・利子などお金に関わる計算は `src/lib/` に集約し、UI コンポーネントに計算ロジックを書かない

## Do NOT
- 依存を勝手に追加しない
- `.env.local` や Supabase の秘密鍵をコミットしない
- README.md に AI 向け手順を書かない（人間向けに保つ）
- 仕様を変えたのに docs を直さず「完了」と言わない
- ポイント残高・借金の増減はすべてサーバー側（Supabase の RPC/Route Handler）で計算する。クライアント側で計算した値をそのまま信用してDBに書き込まない（生徒同士の不正なポイント操作を防ぐため）

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## GitHubへ含めないデータ
個人別CSV・`entries.data.ts`・原資料・ローカルDB・秘密情報は追跡禁止。CSVなしなら空データを生成する。test/lintも生成から実行する。新しい個人データはdata/または.private/へ保存し、公開コードに転記しない。
