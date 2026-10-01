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
  resetConfirmedMarket,
  runFinalSettlement,
  saveEvent,
  saveTeam,
  settleCustomMarket,
  settleOverallMarket,
  shiftSchedule,
  unpublishScores,
  updateMarketDeadline,
  type AdminResult,
  type SettleSummary,
} from "@/lib/admin/service";
import { endSession, requireAdmin } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import type { EventEntry, Heat } from "@/lib/festival/types";

const NEED_CONFIRM: ActionState = { ok: false, message: "「確認しました」にチェックを入れてから実行してください" };

/** 種目・進行・結果・総合順位公開を変えたら表側（トップとマイページ）も作り直す */
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
 * 並べ替えた全組の順位を上から順に取り出す。
 * 途中の空欄を飛ばして入力されている場合は null（順位の欠落は受け付けない）
 */
function orderFromForm(formData: FormData): string[] | null {
  const values = textList(formData, "order");
  const filled = values.filter((v) => v !== "");
  for (let i = 0; i < filled.length; i++) {
    if (values[i] === "") return null;
  }
  return filled;
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

// ---- 総合順位の公開 ----

export async function publishScoresAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!checked(formData, "confirm")) return NEED_CONFIRM;
  const result = await publishScores(getRepository());
  return toState(
    result,
    (v) => `総合順位を公開しました（${formatDateTime(v.scoresPublishedAt)}）`,
    [...FESTIVAL_PATHS, "/ranking"],
  );
}

export async function unpublishScoresAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!checked(formData, "confirm")) return NEED_CONFIRM;
  const result = await unpublishScores(getRepository());
  return toState(result, () => "総合順位を非公開に戻しました", [...FESTIVAL_PATHS, "/ranking"]);
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
  const order = orderFromForm(formData);
  if (order === null) return { ok: false, message: "すべての組を順位順に並べてください" };
  const result = await confirmEventResult(getRepository(), eventId, heatId, { order });
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

  const order = orderFromForm(formData);
  if (order === null) return { ok: false, message: "すべての組を順位順に並べてください" };
  const result = await settleOverallMarket(getRepository(), order);
  return toState(result, (summary) => settleMessage("総合順位を確定", summary), FESTIVAL_PATHS);
}

export async function settleCustomAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!checked(formData, "confirm")) return NEED_CONFIRM;
  const result = await settleCustomMarket(getRepository(), text(formData, "marketId"), text(formData, "winner"));
  return toState(result, (summary) => settleMessage("勝者を確定", summary));
}

export async function resetConfirmedMarketAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!checked(formData, "confirm")) return NEED_CONFIRM;
  return toState(await resetConfirmedMarket(getRepository(), text(formData, "marketId")),
    () => "この競技の確定・配当・利子を確定前に戻しました。再入力できます。締切時刻は保持しています。", ["/", "/me", "/casino", "/ranking"]);
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
