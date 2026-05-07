/**
 * 入出金履歴 CSV の重複検知ハッシュ生成。
 *
 * 設計:
 *  - dedup hash の入力は (date, description, incoming, outgoing, balance) のみ。
 *  - 同一ファイル内で同 key が N 回出現する場合は CSV 出現順に occurrence index を付与し、
 *    "${key}|occ:${index}" を sha256 する。
 *  - rowOrder（並び順保持用のインデックス）は hash には含めない。
 *    → 同一ファイルを再アップロードしても、上に新規行が挿入されてキー位置がズレても、
 *      key が同じ取引は同じ occurrence index を取得し、unique 制約で確実に重複排除される。
 */

import crypto from "crypto";
import type { ParsedStatementEntry } from "./types";

function buildKey(e: {
  transactionDate: string;
  description: string;
  incomingAmount: number | null;
  outgoingAmount: number | null;
  balance: number | null;
}): string {
  return [
    e.transactionDate,
    e.description,
    e.incomingAmount ?? "",
    e.outgoingAmount ?? "",
    e.balance ?? "",
  ].join("|");
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf-8").digest("hex");
}

/**
 * パース済みエントリ配列に dedupHash を付与した拡張配列を返す。
 * 同じ key の出現回数を CSV 上の出現順に数えて occurrence index にする。
 */
export function attachDedupHashes(
  entries: ParsedStatementEntry[]
): (ParsedStatementEntry & { dedupHash: string })[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    const key = buildKey(e);
    const occ = seen.get(key) ?? 0;
    seen.set(key, occ + 1);
    return {
      ...e,
      dedupHash: sha256(`${key}|occ:${occ}`),
    };
  });
}
