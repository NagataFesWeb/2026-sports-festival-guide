"use server";

// 管理画面（/admin）の Server Action。
// proxy.ts は粗い門番なので、どの Action でも必ず requireAdmin() で再検証する
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/admin/action-state";
import { toEventCategory, toEventKind, toFormationType } from "@/components/admin/labels";
import { formatDateTime } from "@/lib/admin/datetime";
import { checked, fileText, intListFromCsv, text, textList } from "@/lib/admin/form";
import {
  closeMarketNow,
  confirmEventResult,
  createCustomMarket,
  createEventMarket,
  createOverallMarket,
  importInvites,
  importRoster,
  publishScores,
  removeEvent,
  removeEventResult,
  reopenMarket,
  resetSchedule,
  runFinalSettlement,
  saveEvent,
  saveTeam,
  settleCustomMarket,
  settleOverallMarket,
  shiftSchedule,
  unpublishScores,
  updateMarketDeadline,
  type AdminResult,
  type EventResultInput,
  type SettleSummary,
} from "@/lib/admin/service";
import { endSession, requireAdmin } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import type { EventEntry, Heat } from "@/lib/festival/types";

const NEED_CONFIRM: ActionState = { ok: false, message: "「確認しました」にチェックを入れてから実行してください" };

/** 種目・進行・結果・得点公開を変えたら表側（トップとマイページ）も作り直す */
const FESTIVAL_PATHS: readonly string[] = ["/", "/me"];

/** AdminResult を画面表示用の状態に変換し、成功時はページを再生成する */
function toState<T>(result: AdminResult<T>, success: (value: T) => string, extraPaths: readonly string[] = []): ActionState {
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/admin");
  for (const path of extraPaths) revalidatePath(path);
  return { ok: true, message: success(result.value) };
}

/** Market 精算の結果メッセージ */
function settleMessage(prefix: string, summary: SettleSummary): string {
  if (!summary.settled) return `${prefix}しました（Market の精算はありません）`;
  return `${prefix}し、Market を精算しました（配当 ${summary.payoutTotal}pt / 利子 ${summary.interestApplied}口座）`;
}

/**
 * 着順の select を上から順に取り出す。
 * 途中の空欄を飛ばして入力されている場合は null（得点の対応がずれるため受け付けない）
 */
function orderFromForm(formData: FormData): string[] | null {
  const values = textList(formData, "order");
  const filled = values.filter((v) => v !== "");
  for (let i = 0; i < filled.length; i++) {
    if (values[i] === "") return null;
  }
  return filled;
}

/** 手入力の得点を着順に対応させる。数値でない欄があれば null */
function overrideFromForm(formData: FormData, order: readonly string[]): Record<string, number> | null {
  const values = textList(formData, "points");
  const points: Record<string, number> = {};
  for (let i = 0; i < order.length; i++) {
    const v = values[i] ?? "";
    if (!/^\d+$/.test(v)) return null;
    points[order[i]] = Number(v);
  }
  return points;
}

/**
 * 得点直接入力（順位点が無い種目）の得点表。
 * scoreTeam[i] と scorePoints[i] が対になっている。空欄の行は未入力として捨てる
 */
function scoresFromForm(formData: FormData): Record<string, number> | null {
  const teamIds = textList(formData, "scoreTeam");
  const values = textList(formData, "scorePoints");
  const points: Record<string, number> = {};
  for (let i = 0; i < teamIds.length; i++) {
    const teamId = teamIds[i];
    const value = values[i] ?? "";
    if (teamId === "" || value === "") continue;
    if (!/^\d+$/.test(value)) return null;
    points[teamId] = Number(value);
  }
  return points;
}

// ---- ログアウト ----

export async function logoutAction(): Promise<void> {
  await requireAdmin();
  await endSession("admin");
  // redirect は例外を投げるため最後に呼ぶ
  redirect("/admin/login");
}

// ---- チーム ----

export async function saveTeamAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const result = await saveTeam(getRepository(), {
    id: text(formData, "id") || undefined,
    num: text(formData, "num"),
    name: text(formData, "name"),
    color: text(formData, "color"),
  });
  return toState(result, (team) => `${team.name} を保存しました`, FESTIVAL_PATHS);
}

// ---- 種目 ----

/** ヒート編集行（ID と名前の対）を取り出す。両方空の行は service 側で捨てられる */
function heatsFromForm(formData: FormData): Heat[] {
  const ids = textList(formData, "heatId");
  const labels = textList(formData, "heatLabel");
  const count = Math.max(ids.length, labels.length);
  return Array.from({ length: count }, (_, i) => ({ id: ids[i] ?? "", label: labels[i] ?? "" }));
}

export async function saveEventAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const category = toEventCategory(text(formData, "category"));
  if (category === null) return { ok: false, message: "種目の区分を選んでください" };
  const kind = toEventKind(text(formData, "kind"));
  if (kind === null) return { ok: false, message: "表示区分を選んでください" };
  const formation = toFormationType(text(formData, "formation"));
  if (formation === null) return { ok: false, message: "招集隊形図の種類を選んでください" };

  const rankPoints = intListFromCsv(text(formData, "rankPoints"));
  if (rankPoints === null) {
    return { ok: false, message: "順位点はカンマ区切りの 0 以上の整数で入力してください（例: 10,8,6,5,4,3,2,1）" };
  }

  // 組み合わせは「枠名 + チーム」の行。チーム未選択の行は捨てられる
  const slots = textList(formData, "slot");
  const teamIds = textList(formData, "entryTeam");
  const entries: EventEntry[] = teamIds.map((teamId, i) => ({
    slot: slots[i] || `${i + 1}枠`,
    teamId,
  }));

  const result = await saveEvent(getRepository(), {
    id: text(formData, "id") || undefined,
    no: text(formData, "no"),
    name: text(formData, "name"),
    en: text(formData, "en"),
    kind,
    category,
    startTime: text(formData, "startTime") || null,
    location: text(formData, "location"),
    entries,
    rankPoints,
    heats: heatsFromForm(formData),
    participants: text(formData, "participants"),
    gatherStart: text(formData, "gatherStart"),
    gatherPlace: text(formData, "gatherPlace"),
    belongings: text(formData, "belongings"),
    formation,
    formationNote: text(formData, "formationNote"),
    description: text(formData, "description"),
  });
  return toState(result, (event) => `${event.no} ${event.name} を保存しました`, FESTIVAL_PATHS);
}

export async function removeEventAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!checked(formData, "confirm")) return NEED_CONFIRM;
  const result = await removeEvent(getRepository(), text(formData, "eventId"));
  return toState(result, (v) => `種目を削除しました（Market ${v.removedMarkets} 件も削除）`, FESTIVAL_PATHS);
}

// ---- 進行（遅延・前倒し） ----

/**
 * 進行の遅延を動かす。行ごとの小さなフォームから呼ぶため useActionState は使わず、
 * 送信後は /admin と表側を作り直して新しい時刻を表示する
 */
export async function shiftScheduleAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const delta = Number(text(formData, "delta"));
  if (!Number.isSafeInteger(delta) || delta === 0) return;
  // eventId が空なら全種目（「全体 ±1分」ボタン）
  const eventId = text(formData, "eventId") || null;

  const result = await shiftSchedule(getRepository(), eventId, delta);
  if (!result.ok) return;
  revalidatePath("/admin");
  for (const path of FESTIVAL_PATHS) revalidatePath(path);
}

/** 全種目を定刻に戻す */
export async function resetScheduleAction(): Promise<void> {
  await requireAdmin();
  const result = await resetSchedule(getRepository());
  if (!result.ok) return;
  revalidatePath("/admin");
  for (const path of FESTIVAL_PATHS) revalidatePath(path);
}

// ---- 得点の公開 ----

export async function publishScoresAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!checked(formData, "confirm")) return NEED_CONFIRM;
  const result = await publishScores(getRepository());
  return toState(
    result,
    (v) => `得点・順位を公開しました（${formatDateTime(v.scoresPublishedAt)}）`,
    [...FESTIVAL_PATHS, "/ranking"],
  );
}

export async function unpublishScoresAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!checked(formData, "confirm")) return NEED_CONFIRM;
  const result = await unpublishScores(getRepository());
  return toState(result, () => "得点・順位を非公開に戻しました", [...FESTIVAL_PATHS, "/ranking"]);
}

// ---- Market ----

export async function createEventMarketAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const result = await createEventMarket(
    getRepository(),
    text(formData, "eventId"),
    text(formData, "heatId"),
    text(formData, "deadline"),
  );
  return toState(result, (m) => `${m.title} の Market を作成しました（締切 ${formatDateTime(m.deadline)}）`);
}

export async function createOverallMarketAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const result = await createOverallMarket(getRepository(), text(formData, "deadline"));
  return toState(result, (m) => `全体優勝の Market を作成しました（締切 ${formatDateTime(m.deadline)}）`);
}

export async function createCustomMarketAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const result = await createCustomMarket(getRepository(), {
    title: text(formData, "title"),
    en: text(formData, "en"),
    optionA: text(formData, "optionA"),
    optionB: text(formData, "optionB"),
    deadlineIso: text(formData, "deadline"),
  });
  return toState(result, (m) => `${m.title} の Market を作成しました`);
}

export async function updateMarketDeadlineAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const result = await updateMarketDeadline(getRepository(), text(formData, "marketId"), text(formData, "deadline"));
  return toState(result, (m) => `締切を ${formatDateTime(m.deadline)} に変更しました`);
}

export async function closeMarketAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const result = await closeMarketNow(getRepository(), text(formData, "marketId"));
  return toState(result, (m) => `${m.title} を締め切りました`);
}

export async function reopenMarketAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const result = await reopenMarket(getRepository(), text(formData, "marketId"));
  return toState(result, (m) => `${m.title} を再開しました`);
}

// ---- 結果確定 ----

export async function confirmEventResultAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!checked(formData, "confirm")) return NEED_CONFIRM;

  const eventId = text(formData, "eventId");
  const heatId = text(formData, "heatId");
  let input: EventResultInput;

  if (text(formData, "mode") === "score") {
    // 順位点が無い種目（玉入れ・棒引きなど）は得点を直接入力する。着順は service 側で得点順に導く
    const points = scoresFromForm(formData);
    if (points === null) return { ok: false, message: "得点は 0 以上の整数で入力してください" };
    input = { points };
  } else {
    const order = orderFromForm(formData);
    if (order === null) return { ok: false, message: "着順は 1 位から順に入力してください（途中の空欄は不可）" };

    input = { order };
    if (checked(formData, "override")) {
      const parsed = overrideFromForm(formData, order);
      if (parsed === null) return { ok: false, message: "得点は 0 以上の整数で入力してください" };
      input = { order, points: parsed };
    }
  }

  const result = await confirmEventResult(getRepository(), eventId, heatId, input);
  return toState(result, (summary) => settleMessage("結果を確定", summary), FESTIVAL_PATHS);
}

export async function removeEventResultAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!checked(formData, "confirm")) return NEED_CONFIRM;
  const result = await removeEventResult(getRepository(), text(formData, "eventId"), text(formData, "heatId"));
  return toState(result, () => "確定した結果を取り消しました。もう一度入力できます", FESTIVAL_PATHS);
}

export async function settleOverallAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!checked(formData, "confirm")) return NEED_CONFIRM;

  const winner = text(formData, "winner");
  if (!winner) return { ok: false, message: "優勝チームを選んでください" };

  const result = await settleOverallMarket(getRepository(), [winner]);
  return toState(result, (summary) => settleMessage("全体優勝を確定", summary), FESTIVAL_PATHS);
}

export async function settleCustomAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!checked(formData, "confirm")) return NEED_CONFIRM;
  const result = await settleCustomMarket(getRepository(), text(formData, "marketId"), text(formData, "winner"));
  return toState(result, (summary) => settleMessage("勝者を確定", summary));
}

// ---- CSV 取り込み ----

/** ファイルとテキストエリアの両方に対応する（ファイルがあれば優先） */
async function csvFromForm(formData: FormData): Promise<string | null> {
  const uploaded = await fileText(formData, "file");
  if (uploaded !== null) return uploaded;
  const pasted = text(formData, "csv");
  return pasted === "" ? null : pasted;
}

export async function importInvitesAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const csv = await csvFromForm(formData);
  if (csv === null) return { ok: false, message: "CSV ファイルを選ぶか、内容を貼り付けてください" };

  const result = await importInvites(getRepository(), csv);
  return toState(
    result,
    (v) => {
      const errors = v.errors.length > 0 ? `／スキップ ${v.errors.length} 行: ${v.errors.join(" / ")}` : "";
      return `招集案内を ${v.count} 件に差し替えました${errors}`;
    },
    FESTIVAL_PATHS,
  );
}

export async function importRosterAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const csv = await csvFromForm(formData);
  if (csv === null) return { ok: false, message: "CSV ファイルを選ぶか、内容を貼り付けてください" };

  const result = await importRoster(getRepository(), csv);
  return toState(
    result,
    (v) => {
      const errors = v.errors.length > 0 ? `／スキップ ${v.errors.length} 行: ${v.errors.join(" / ")}` : "";
      return `生徒名簿を ${v.count} 件に差し替えました${errors}`;
    },
    FESTIVAL_PATHS,
  );
}

// ---- 最終精算 ----

export async function runFinalSettlementAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!checked(formData, "confirm")) return NEED_CONFIRM;

  const result = await runFinalSettlement(getRepository());
  return toState(
    result,
    (v) =>
      v.alreadySettled
        ? `既に精算済みです（${formatDateTime(v.finalSettledAt)}）`
        : `${v.accounts} 口座を精算しました（${formatDateTime(v.finalSettledAt)}）`,
    ["/ranking"],
  );
}
