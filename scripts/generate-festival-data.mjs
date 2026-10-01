// 表画面はDBへ接続しない。ビルド時の管理用取得だけで表示データを固定する。
import "./typescript-loader.mjs";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const envFile = fileURLToPath(new URL(".env.local", root));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const { SEED_EVENTS, SEED_TEAMS } = await import("../src/lib/casino/fixtures.ts");
let snapshot = {
  teams: SEED_TEAMS, events: SEED_EVENTS, results: [], invites: [],
  overall: [], studentCount: 960,
  settings: { finalSettledAt: null, scoresPublishedAt: null }, ranking: [],
};
const sync = process.argv.includes("--sync");
const configured = process.env.NEXT_PUBLIC_SUPABASE_URL &&
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
if (sync && configured) {
  const { getRepository } = await import("../src/lib/db/index.ts");
  const { rankAccounts } = await import("../src/lib/casino/settlement.ts");
  const repo = getRepository();
  const [teams, events, results, invites, studentCount, settings, markets] = await Promise.all([
    repo.listTeams(), repo.listEvents(), repo.listEventResults(), repo.listInvites(),
    repo.countStudents(), repo.getSettings(), repo.listMarkets(),
  ]);
  // 非公開順位・口座ハッシュ・生徒氏名は生成物へ含めない。
  const overall = settings.scoresPublishedAt ? markets.filter(m => m.type === "overall") : [];
  const ranking = settings.finalSettledAt ? rankAccounts(await repo.listAccounts()) : [];
  snapshot = { teams, events, results, invites, studentCount, settings, overall, ranking };
}
const output = fileURLToPath(new URL("src/lib/festival/snapshot.data.ts", root));
writeFileSync(output, `// 自動生成・編集禁止。個人別案内を含むためGit非追跡。\nimport type { FestivalSnapshot } from "./snapshot";\nexport const festivalSnapshot: FestivalSnapshot = ${JSON.stringify(snapshot)};\n`);
console.log(`[festival-data] ${sync && configured ? "管理用DB取得" : "台帳の固定データ"}: ${snapshot.events.length}種目・${snapshot.teams.length}チーム（表示時のDBアクセスなし）`);
