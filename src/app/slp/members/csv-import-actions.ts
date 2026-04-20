"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { normalizeEmail } from "@/lib/slp-link-recovery";
import { parseReservationDate } from "@/lib/slp/parse-reservation-date";

export type MemberImportSummary = {
  total: number;
  imported: number;
  skipped: { row: number; email: string; reason: string }[];
  errors: { row: number; reason: string }[];
};

const VALID_STATUSES = new Set([
  "契約書未送付",
  "契約書送付済",
  "組合員契約書締結",
  "契約破棄",
  "送付エラー",
  "無効データ",
]);

const VALID_MEMBER_CATEGORIES = new Set([
  "個人（法人代表・役員・従業員）",
  "法人担当者",
  "代理店",
]);

function cleanCell(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseDateCell(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const halfWidth = s
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\./g, "/");
  const date = parseReservationDate(halfWidth);
  if (!date) return null;
  const yr = date.getFullYear();
  if (yr < 1900 || yr > 2100) return null;
  return date;
}

function parseIntCell(raw: string): number | null {
  const s = raw.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function importMembersFromCsv(
  csvText: string
): Promise<ActionResult<MemberImportSummary>> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

  try {
    // BOM を除去
    let text = csvText;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    // 致命的な解析エラー（Delimiter・Quotes）は全体停止。
    // FieldMismatch 等の行単位の問題は後段で個別にハンドル。
    const fatal = parsed.errors.find(
      (e) => e.type === "Delimiter" || e.type === "Quotes"
    );
    if (fatal) {
      return err(`CSVの解析に失敗しました: ${fatal.message}`);
    }

    const rows = parsed.data;
    if (rows.length === 0) {
      return err("CSVにデータ行がありません");
    }

    // 必須列「氏名」がヘッダーにあるか確認
    const headers = Object.keys(rows[0] ?? {});
    if (!headers.includes("氏名")) {
      return err(
        "ヘッダー行に「氏名」列が見つかりません。テンプレートを再ダウンロードしてください"
      );
    }
    const summary: MemberImportSummary = {
      total: rows.length,
      imported: 0,
      skipped: [],
      errors: [],
    };

    // 既存の全メールを一度だけ取得（大文字小文字を無視して比較）
    const existing = await prisma.slpMember.findMany({
      where: { email: { not: null } },
      select: { email: true },
    });
    const existingEmails = new Set(
      existing
        .map((m) => (m.email ? normalizeEmail(m.email) : null))
        .filter((v): v is string => !!v)
    );

    // CSV内の重複も検出するため、このインポート内で処理したメールを記録
    const seenInCsv = new Set<string>();

    const importTimestamp = Date.now();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // ヘッダー行を1行目と数える

      const name = cleanCell(row["氏名"]);
      if (!name) {
        summary.errors.push({ row: rowNum, reason: "氏名が空欄です" });
        continue;
      }

      const emailRaw = cleanCell(row["メールアドレス"]);
      const emailNorm = emailRaw ? normalizeEmail(emailRaw) : "";

      // メール重複チェック
      if (emailNorm) {
        if (existingEmails.has(emailNorm)) {
          summary.skipped.push({
            row: rowNum,
            email: emailRaw,
            reason: "既存組合員と重複",
          });
          continue;
        }
        if (seenInCsv.has(emailNorm)) {
          summary.skipped.push({
            row: rowNum,
            email: emailRaw,
            reason: "CSV内で重複",
          });
          continue;
        }
      }

      const statusRaw = cleanCell(row["ステータス"]);
      const status = statusRaw && VALID_STATUSES.has(statusRaw) ? statusRaw : null;
      if (statusRaw && !status) {
        summary.errors.push({
          row: rowNum,
          reason: `ステータス「${statusRaw}」は無効です`,
        });
        continue;
      }

      const categoryRaw = cleanCell(row["入会者区分"]);
      const memberCategory =
        categoryRaw && VALID_MEMBER_CATEGORIES.has(categoryRaw) ? categoryRaw : null;
      if (categoryRaw && !memberCategory) {
        summary.errors.push({
          row: rowNum,
          reason: `入会者区分「${categoryRaw}」は無効です`,
        });
        continue;
      }

      const contractSentRaw = cleanCell(row["契約書送付日"]);
      const contractSignedRaw = cleanCell(row["契約締結日"]);
      const contractSentDate = contractSentRaw ? parseDateCell(contractSentRaw) : null;
      const contractSignedDate = contractSignedRaw ? parseDateCell(contractSignedRaw) : null;
      if (contractSentRaw && !contractSentDate) {
        summary.errors.push({
          row: rowNum,
          reason: `契約書送付日「${contractSentRaw}」の形式が不正です（例: 2026/3/25 または 2026/3/25 19:23）`,
        });
        continue;
      }
      if (contractSignedRaw && !contractSignedDate) {
        summary.errors.push({
          row: rowNum,
          reason: `契約締結日「${contractSignedRaw}」の形式が不正です（例: 2026/3/25 または 2026/3/25 19:23）`,
        });
        continue;
      }

      const reminderRaw = cleanCell(row["リマインド回数"]);
      const reminderCount = reminderRaw ? parseIntCell(reminderRaw) : null;
      if (reminderRaw && reminderCount == null) {
        summary.errors.push({
          row: rowNum,
          reason: `リマインド回数「${reminderRaw}」は数値ではありません`,
        });
        continue;
      }

      // 仮UID生成（LINE紐付け前の一時ID。後追い紐付けフローで本UIDに置換される）
      const tempUid = `csv-import-${importTimestamp}-${i + 1}`;

      try {
        await prisma.slpMember.create({
          data: {
            name,
            email: emailRaw || null,
            status,
            contractSentDate,
            contractSignedDate,
            position: cleanCell(row["役職"]) || null,
            company: cleanCell(row["会社"]) || null,
            memberCategory,
            uid: tempUid,
            phone: cleanCell(row["電話番号"]) || null,
            address: cleanCell(row["住所"]) || null,
            note: cleanCell(row["備考"]) || null,
            memo: cleanCell(row["メモ"]) || null,
            documentId: cleanCell(row["documentID"]) || null,
            cloudsignUrl: cleanCell(row["クラウドサインURL"]) || null,
            reminderCount: reminderCount ?? 0,
          },
        });
        if (emailNorm) seenInCsv.add(emailNorm);
        summary.imported++;
      } catch (e) {
        summary.errors.push({
          row: rowNum,
          reason: e instanceof Error ? e.message : "登録に失敗しました",
        });
      }
    }

    revalidatePath("/slp/members");
    return ok(summary);
  } catch (e) {
    console.error("[importMembersFromCsv] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
