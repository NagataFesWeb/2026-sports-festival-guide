// data/学籍番号別出場競技.csv から src/lib/festival/entries.data.ts を生成する。
// 出場競技は表画面の「自分の出場競技」で使うが、速度のため DB を通さず静的データとして配る。
// CSV は頻繁に差し替わるので、npm run build（prebuild）で毎回生成し直す。
// 依存を増やさないため Node 標準モジュールだけで書く（AGENTS.md「依存を勝手に追加しない」）。
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readEntriesSource } from "./entries-source.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "data", "学籍番号別出場競技.csv");
const OUTPUT = join(root, "src", "lib", "festival", "entries.data.ts");
if (existsSync(join(root, ".env.local"))) process.loadEnvFile(join(root, ".env.local"));

/** CSV の 1 セル内で複数の出場競技を区切る文字（全角の縦棒 U+FF5C。ASCII の | ではない） */
const SEPARATOR = "｜";

/** 生成を中断する。CSV の差し替えミスをビルド時に気づけるよう、必ず止める */
function fail(message) {
  console.error(`[generate-entries] ${message}`);
  process.exit(1);
}

/**
 * CSV を「学籍番号, 出場競技」の 2 列として読む。
 * この CSV は引用符を含まない前提なので単純に最初のカンマで割る。
 * 引用符が現れたら前提が崩れているので落とす（src/lib/festival/entries.test.ts が
 * 本物の parseCsv と突き合わせて検証する）
 */
function readRows(text) {
  const body = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (body.includes('"')) fail("引用符つきの CSV には未対応です（値にカンマを含めないでください）");

  const lines = body.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) fail("CSV が空です");

  const header = lines[0].split(",").map((cell) => cell.trim());
  if (header[0] !== "学籍番号" || header[1] !== "出場競技") {
    fail(`見出し行が不正です（期待: 学籍番号,出場競技 / 実際: ${lines[0]}）`);
  }

  return lines.slice(1).map((line, index) => {
    const comma = line.indexOf(",");
    if (comma === -1) fail(`行${index + 2}: カンマがありません（${line}）`);
    return { line: index + 2, studentId: line.slice(0, comma).trim(), events: line.slice(comma + 1).trim() };
  });
}

const { text, source } = await readEntriesSource(existsSync(SOURCE) ? readFileSync(SOURCE, "utf8") : null, process.env);
console.log(`[generate-entries] 取得元：${source}`);
const rows = readRows(text);

/** 出場枠の文字列 → 辞書の添字。CSV に出てきた順に採番する */
const labelIndex = new Map();
/** 学籍番号 → 辞書の添字の配列 */
const students = new Map();

for (const row of rows) {
  if (!/^\d{1,8}$/.test(row.studentId)) fail(`行${row.line}: 学籍番号が不正です（${row.studentId}）`);
  if (students.has(row.studentId)) fail(`行${row.line}: 学籍番号が重複しています（${row.studentId}）`);
  if (row.events === "") fail(`行${row.line}: 出場競技が空です（${row.studentId}）`);

  // 表計算ソフトや IME を変えると区切りが半角の "|" になることがある。
  // そのまま通すと 1 件の長い競技名として取り込まれて誰も気づかないので、ここで止める
  if (row.events.includes("|")) {
    fail(`行${row.line}: 区切りが半角の "|" になっています。全角の "${SEPARATOR}" に直してください（${row.studentId}）`);
  }

  const indexes = [];
  for (const raw of row.events.split(SEPARATOR)) {
    const label = raw.trim();
    if (label === "") fail(`行${row.line}: 空の出場競技が含まれています（${row.studentId}）`);
    // "競技名（枠）" の形が崩れると枠が出せない。直せる形なので止めずに知らせるだけにする
    if (!/^[^（）]+（[^（）]*）$/.test(label)) {
      console.warn(`[generate-entries] 行${row.line}: 「競技名（枠）」の形ではありません（${label}）。枠は空欄で表示されます`);
    }
    let index = labelIndex.get(label);
    if (index === undefined) {
      index = labelIndex.size;
      labelIndex.set(label, index);
    }
    indexes.push(index);
  }
  students.set(row.studentId, indexes);
}

/** TypeScript の文字列リテラルとして安全に書き出す */
function quote(value) {
  return JSON.stringify(value);
}

const version = createHash("sha256").update(text, "utf8").digest("hex").slice(0, 8);
const labelLines = [...labelIndex.keys()].map((label) => `  ${quote(label)},`).join("\n");
const studentLines = [...students].map(([id, indexes]) => `  ${quote(id)}: [${indexes.join(",")}],`).join("\n");

const output = `// 自動生成ファイル。直接編集しない。
// 生成元: ローカルCSVまたは非公開Supabase Storage（scripts/entries-source.mjs）
// 生成コマンド: npm run entries（npm run build でも prebuild で自動実行される）

/** 出場枠の辞書。CSV の "${SEPARATOR}" 区切り 1 件分をそのまま持つ（例: "大縄跳び 前半（16人目）"） */
export const ENTRY_LABELS: readonly string[] = [
${labelLines}
];

/** 学籍番号 → ENTRY_LABELS の添字。並び順は CSV のまま */
export const STUDENT_ENTRIES: Readonly<Record<string, readonly number[]>> = {
${studentLines}
};

/** 生成元 CSV の版（SHA-256 の先頭 8 桁）。差し替え忘れの切り分け用 */
export const ENTRY_DATA_VERSION = ${quote(version)};
`;

writeFileSync(OUTPUT, output, "utf8");
console.log(
  `[generate-entries] ${students.size}人 / 出場枠${labelIndex.size}種 / version ${version} → ${OUTPUT}`,
);
