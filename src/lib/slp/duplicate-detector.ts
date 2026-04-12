/**
 * SLP企業名簿の重複検出ロジック
 *
 * 検出基準（いずれか1つでも一致したら重複候補）:
 *   1. 企業名: 会社種別語を除いた本体部分で 3文字以上の共通文字列
 *   2. 電話番号: ハイフン・空白・括弧を除去した数字のみで一致
 *   3. 住所: 正規化後（都道府県・記号除去）に短い方が長い方の部分文字列に含まれる
 *
 * LINE担当者の一致は重複ではない（同じ人が複数企業を担当することは正常）
 */

import { prisma } from "@/lib/prisma";

// ============================================
// 正規化ユーティリティ
// ============================================

/**
 * 全角→半角変換
 */
function toHalfWidth(s: string): string {
  return s
    .replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    .replace(/[a-z]/gi, (c) => c)
    .replace(/[ァ-ヶ]/g, (c) => c) // カタカナはそのまま
    .replace(/　/g, " ");
}

/**
 * 会社種別語を除去（企業名の本体部分を取り出すため）
 */
const COMPANY_SUFFIX_PATTERNS = [
  "株式会社",
  "有限会社",
  "合同会社",
  "合資会社",
  "合名会社",
  "一般社団法人",
  "一般財団法人",
  "公益社団法人",
  "公益財団法人",
  "特定非営利活動法人",
  "ＮＰＯ法人",
  "NPO法人",
  "学校法人",
  "医療法人",
  "宗教法人",
  "社会福祉法人",
  "(株)",
  "(有)",
  "(合)",
  "㈱",
  "㈲",
];

/**
 * 企業名を正規化: 会社種別語と空白・記号を除去
 */
export function normalizeCompanyName(name: string | null | undefined): string {
  if (!name) return "";
  let s = toHalfWidth(name).trim();
  // 会社種別語を除去
  for (const suffix of COMPANY_SUFFIX_PATTERNS) {
    s = s.replace(new RegExp(suffix, "g"), "");
  }
  // 空白・記号を除去
  s = s.replace(/[\s\u3000\.\-_,'"`!?()（）「」『』【】]/g, "");
  return s.toLowerCase();
}

/**
 * 電話番号を正規化: 数字のみに
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return toHalfWidth(phone).replace(/\D/g, "");
}

/**
 * 住所を正規化:
 * 1. 全角→半角
 * 2. 「丁目」「番地」「番」「号」「－」「─」「ー」 → ハイフンに統一
 * 3. 都道府県を除去
 * 4. 連続するハイフン・空白・記号を1つに
 * 5. 末尾のビル名・建物名以前で切る（数字+ハイフンの後の文字列）は残す
 */
const PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
];

export function normalizeAddress(
  address: string | null | undefined
): string {
  if (!address) return "";
  let s = toHalfWidth(address).trim();
  // 都道府県を除去
  for (const pref of PREFECTURES) {
    s = s.replace(new RegExp("^" + pref), "");
  }
  // 「丁目」「番地」「番」「号」を「-」に
  s = s.replace(/丁目/g, "-");
  s = s.replace(/番地?/g, "-");
  s = s.replace(/号/g, "-");
  // 全角ハイフン類 → 半角ハイフン
  s = s.replace(/[ー―－─]/g, "-");
  // 連続するハイフンを1つに
  s = s.replace(/-+/g, "-");
  // 空白・記号を除去
  s = s.replace(/[\s\u3000,\.\(\)（）]/g, "");
  return s.toLowerCase();
}

// ============================================
// 一致判定
// ============================================

/**
 * 企業名の重複判定
 * 正規化後、3文字以上の共通文字列があるかチェック
 */
export function isCompanyNameMatch(a: string, b: string): boolean {
  const na = normalizeCompanyName(a);
  const nb = normalizeCompanyName(b);
  if (!na || !nb) return false;
  if (na.length < 3 || nb.length < 3) return false;

  // 完全一致
  if (na === nb) return true;

  // 短い方が3文字以上で、長い方に含まれているか
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 3 && longer.includes(shorter)) {
    return true;
  }

  // 3文字以上の共通連続文字列を探す
  for (let len = Math.min(na.length, nb.length); len >= 3; len--) {
    for (let i = 0; i <= na.length - len; i++) {
      const sub = na.substring(i, i + len);
      if (nb.includes(sub)) return true;
    }
  }

  return false;
}

/**
 * 電話番号の重複判定
 * 正規化後の数字のみで完全一致
 */
export function isPhoneMatch(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * 住所の重複判定
 * 正規化後、短い方が長い方の部分文字列に含まれているか
 * （都道府県の有無、丁目表記、ビル名の有無を吸収）
 */
export function isAddressMatch(a: string, b: string): boolean {
  const na = normalizeAddress(a);
  const nb = normalizeAddress(b);
  if (!na || !nb) return false;

  // 短すぎる住所は判定しない（誤判定防止）
  if (na.length < 4 || nb.length < 4) return false;

  // 完全一致
  if (na === nb) return true;

  // 短い方が長い方の部分文字列に含まれているか
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  return longer.includes(shorter);
}

// ============================================
// レコード単位の重複検出 + キャッシュ更新
// ============================================

type CompanyForDetection = {
  id: number;
  companyName: string | null;
  companyPhone: string | null;
  address: string | null;
  prefecture: string | null;
  corporateNumber: string | null;
  representativeName: string | null;
  businessType: string | null;
};

/**
 * 2レコードを比較して、一致した理由のリストを返す（一致しなければ空配列）
 */
export function detectDuplicateReasons(
  a: CompanyForDetection,
  b: CompanyForDetection
): string[] {
  const reasons: string[] = [];

  // 法人番号一致（最優先・確定判定）
  if (a.corporateNumber && b.corporateNumber) {
    const na = a.corporateNumber.replace(/\D/g, "");
    const nb = b.corporateNumber.replace(/\D/g, "");
    if (na.length === 13 && na === nb) {
      reasons.push("法人番号");
      return reasons; // 法人番号一致は確定なので他の判定を待たず即return
    }
  }

  if (a.companyName && b.companyName) {
    if (isCompanyNameMatch(a.companyName, b.companyName)) {
      reasons.push("企業名");
    }
  }

  if (a.companyPhone && b.companyPhone) {
    if (isPhoneMatch(a.companyPhone, b.companyPhone)) {
      reasons.push("電話番号");
    }
  }

  // 住所は prefecture + address を結合して比較
  const addrA = [a.prefecture ?? "", a.address ?? ""].filter(Boolean).join("");
  const addrB = [b.prefecture ?? "", b.address ?? ""].filter(Boolean).join("");
  if (addrA && addrB) {
    if (isAddressMatch(addrA, addrB)) {
      reasons.push("住所");
    }
  }

  // 個人事業主: 代表者名 + 事業用電話番号の組み合わせ一致
  if (
    (a.businessType === "sole_proprietor" || b.businessType === "sole_proprietor") &&
    a.representativeName && b.representativeName &&
    a.companyPhone && b.companyPhone
  ) {
    const nameA = a.representativeName.trim();
    const nameB = b.representativeName.trim();
    const phoneA = a.companyPhone.replace(/\D/g, "");
    const phoneB = b.companyPhone.replace(/\D/g, "");
    if (nameA === nameB && phoneA === phoneB && phoneA.length >= 10) {
      reasons.push("代表者名+電話番号");
    }
  }

  return reasons;
}

/**
 * 1レコードについて、他の全レコードとの重複候補を再計算してキャッシュテーブルに保存
 *
 * 動作:
 *   1. このレコードに関する既存の候補レコードを全削除
 *   2. 他の全企業との比較で一致した理由がある組み合わせを候補テーブルに INSERT
 *   3. 「重複でない」マークがあるペアはスキップ
 */
export async function recomputeDuplicateCandidatesForRecord(
  recordId: number
): Promise<{ added: number }> {
  const target = await prisma.slpCompanyRecord.findFirst({
    where: { id: recordId, deletedAt: null },
    select: {
      id: true,
      companyName: true,
      companyPhone: true,
      address: true,
      prefecture: true,
      corporateNumber: true,
      representativeName: true,
      businessType: true,
    },
  });

  if (!target) {
    // 削除済み or 存在しない → このレコードに関する全候補を削除
    await prisma.slpCompanyDuplicateCandidate.deleteMany({
      where: {
        OR: [{ recordIdA: recordId }, { recordIdB: recordId }],
      },
    });
    return { added: 0 };
  }

  // この企業に関連する除外ペアを取得
  const exclusions = await prisma.slpCompanyDuplicateExclusion.findMany({
    where: {
      OR: [{ recordIdA: recordId }, { recordIdB: recordId }],
    },
    select: { recordIdA: true, recordIdB: true },
  });
  const excludedIds = new Set<number>();
  for (const ex of exclusions) {
    excludedIds.add(ex.recordIdA === recordId ? ex.recordIdB : ex.recordIdA);
  }

  // 他の全企業を取得（削除済み・自分自身を除く）
  const others = await prisma.slpCompanyRecord.findMany({
    where: {
      deletedAt: null,
      id: { not: recordId },
    },
    select: {
      id: true,
      companyName: true,
      companyPhone: true,
      address: true,
      prefecture: true,
      corporateNumber: true,
      representativeName: true,
      businessType: true,
    },
  });

  // 既存の候補を全削除
  await prisma.slpCompanyDuplicateCandidate.deleteMany({
    where: {
      OR: [{ recordIdA: recordId }, { recordIdB: recordId }],
    },
  });

  // 一致するペアを検出して INSERT
  let added = 0;
  for (const other of others) {
    if (excludedIds.has(other.id)) continue;

    const reasons = detectDuplicateReasons(target, other);
    if (reasons.length === 0) continue;

    const recordIdA = Math.min(target.id, other.id);
    const recordIdB = Math.max(target.id, other.id);

    try {
      await prisma.slpCompanyDuplicateCandidate.create({
        data: {
          recordIdA,
          recordIdB,
          reasons,
        },
      });
      added++;
    } catch {
      // 既に存在する場合（unique 制約違反）はスキップ
    }
  }

  return { added };
}

/**
 * 全レコードに対して重複検出を再計算する（管理用ユーティリティ）
 * パフォーマンスのため、cron や手動実行で使う想定
 */
export async function recomputeAllDuplicateCandidates(): Promise<{
  totalRecords: number;
  totalCandidates: number;
}> {
  // 既存の候補を全削除
  await prisma.slpCompanyDuplicateCandidate.deleteMany();

  const records = await prisma.slpCompanyRecord.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      companyName: true,
      companyPhone: true,
      address: true,
      prefecture: true,
      corporateNumber: true,
      representativeName: true,
      businessType: true,
    },
    orderBy: { id: "asc" },
  });

  // 除外ペアを取得
  const exclusions = await prisma.slpCompanyDuplicateExclusion.findMany({
    select: { recordIdA: true, recordIdB: true },
  });
  const excludedSet = new Set<string>();
  for (const ex of exclusions) {
    excludedSet.add(`${ex.recordIdA}-${ex.recordIdB}`);
  }

  let totalCandidates = 0;
  // O(N²) の比較
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      const recordIdA = Math.min(a.id, b.id);
      const recordIdB = Math.max(a.id, b.id);

      if (excludedSet.has(`${recordIdA}-${recordIdB}`)) continue;

      const reasons = detectDuplicateReasons(a, b);
      if (reasons.length === 0) continue;

      try {
        await prisma.slpCompanyDuplicateCandidate.create({
          data: { recordIdA, recordIdB, reasons },
        });
        totalCandidates++;
      } catch {
        // 既存の場合はスキップ
      }
    }
  }

  return { totalRecords: records.length, totalCandidates };
}
