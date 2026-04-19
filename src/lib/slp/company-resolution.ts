/**
 * SLP企業の AS担当・紹介者・代理店 の自動解決ロジック
 *
 * 共通のチェーン辿りロジックで以下を解決する：
 * - **AS担当**: 担当者本人のLINE → free1 → free1 → … → SlpAs登録者に到達するまで（自社チェック不要）
 *               担当者ごとに自動解決値を返す。手動上書きがあればそれを優先（元値も併せて返す）
 * - **紹介者**: 担当者本人のLINE → free1 → free1 → … → 自社の担当者でないLineFriendに到達するまで
 *               「{番号} {LINE名}」形式で表示
 * - **代理店**: free1から開始（担当者本人は対象外）→ 各段階で 1次代理店（parentId IS NULL）の
 *               担当者として登録されているか調べ、見つかったすべてを列挙
 *
 * 集約結果は「解決値ごと → 由来となった担当者リスト」というMap形式にして、
 * 一覧/詳細での表示に共通利用できるようにする。
 */

import { prisma } from "@/lib/prisma";

const MAX_DEPTH = 30;

// ============================================
// 入力型
// ============================================

export type ContactForResolution = {
  id: number;
  name: string | null;
  lineFriendId: number | null;
  manualAsId: number | null;
  manualAsReason: string | null;
  manualAsChangedAt: Date | null;
  manualAsChangedByName: string | null;
  manualAs: { id: number; name: string } | null;
  lineFriend: {
    id: number;
    uid: string;
    snsname: string | null;
    free1: string | null;
  } | null;
};

// ============================================
// 解決結果型
// ============================================

export type AsResolutionForContact = {
  contactId: number;
  contactName: string;
  contactDisplay: string; // "{contactId} {contactName}"
  // 自動解決値
  autoAsId: number | null;
  autoAsName: string | null;
  // 手動上書き値
  manualAsId: number | null;
  manualAsName: string | null;
  manualAsReason: string | null;
  manualAsChangedAt: Date | null;
  manualAsChangedByName: string | null;
  // 表示用の最終値（手動があれば手動、なければ自動）
  effectiveAsId: number | null;
  effectiveAsName: string | null;
  isManual: boolean;
};

export type ReferrerForContact = {
  contactId: number;
  contactName: string;
  contactDisplay: string;
  referrers: Array<{
    lineFriendId: number;
    label: string; // "{lineFriendId} {snsname}"
  }>;
};

export type AgencyForContact = {
  contactId: number;
  contactName: string;
  contactDisplay: string;
  agencies: Array<{
    agencyId: number;
    agencyName: string;
    label: string; // "{agencyId} {agencyName}"
  }>;
};

export type CompanyResolution = {
  perContact: {
    as: AsResolutionForContact[];
    referrer: ReferrerForContact[];
    agency: AgencyForContact[];
  };
  // 企業単位での集約（重複排除し、由来担当者リスト付き）
  aggregated: {
    // AS担当: AS名 → 由来担当者表示リスト（手動上書きがある場合は「(手動)」付き）
    as: Array<{
      label: string; // "AS名" or "AS名(手動)"
      asId: number | null;
      asName: string | null;
      isManual: boolean;
      manualAsReason: string | null;
      autoAsName: string | null; // 手動の場合の元のAS
      contacts: string[]; // ["1 担当者名", ...]
    }>;
    referrer: Array<{
      label: string; // "{番号} {LINE名}"
      lineFriendId: number;
      contacts: string[];
    }>;
    agency: Array<{
      label: string; // "{代理店ID} {代理店名}"
      agencyId: number;
      agencyName: string;
      contacts: string[];
    }>;
    // 1人の担当者から複数の1次代理店が見つかった場合の警告
    multipleAgencyWarnings: Array<{
      contactDisplay: string;
      agencyLabels: string[];
    }>;
  };
};

// ============================================
// 解決ロジック本体
// ============================================

type ResolverContext = {
  // uid → SlpLineFriend (free1, snsname, id) のマップ
  uidToFriend: Map<
    string,
    { id: number; snsname: string | null; free1: string | null }
  >;
  // uid → SlpAs (登録者)
  uidToAs: Map<string, { id: number; name: string }>;
  // uid → 1次代理店（複数可能性があるが基本1つ）
  uidToParentAgencies: Map<
    string,
    Array<{ agencyId: number; agencyName: string }>
  >;
  // この企業の担当者LINE friend ID set（自社判定用）
  ownContactLineFriendIds: Set<number>;
};

/**
 * 解決に必要な参照データを一括取得してコンテキストを構築
 */
async function buildResolverContext(
  ownContactLineFriendIds: Set<number>
): Promise<ResolverContext> {
  const [allFriends, asRecords, parentAgencyContacts] = await Promise.all([
    prisma.slpLineFriend.findMany({
      where: { deletedAt: null },
      select: { id: true, uid: true, snsname: true, free1: true },
    }),
    prisma.slpAs.findMany({
      include: {
        lineFriend: { select: { uid: true } },
      },
    }),
    // 1次代理店の担当者（parentId IS NULL かつ deletedAt IS NULL の代理店配下）
    prisma.slpAgencyContact.findMany({
      where: {
        agency: { parentId: null, deletedAt: null },
        lineFriend: { is: { uid: { not: undefined } } },
      },
      include: {
        agency: { select: { id: true, name: true } },
        lineFriend: { select: { uid: true } },
      },
    }),
  ]);

  const uidToFriend = new Map<
    string,
    { id: number; snsname: string | null; free1: string | null }
  >();
  for (const f of allFriends) {
    uidToFriend.set(f.uid, {
      id: f.id,
      snsname: f.snsname,
      free1: f.free1,
    });
  }

  const uidToAs = new Map<string, { id: number; name: string }>();
  for (const as of asRecords) {
    if (as.lineFriend?.uid) {
      uidToAs.set(as.lineFriend.uid, { id: as.id, name: as.name });
    }
  }

  // 同じuidに複数の1次代理店が紐づくケースに備えて配列で持つ
  const uidToParentAgencies = new Map<
    string,
    Array<{ agencyId: number; agencyName: string }>
  >();
  for (const c of parentAgencyContacts) {
    if (!c.lineFriend?.uid) continue;
    const list = uidToParentAgencies.get(c.lineFriend.uid) ?? [];
    // 同じ代理店が複数の担当者として紐づいているケースを排除
    if (!list.some((a) => a.agencyId === c.agency.id)) {
      list.push({ agencyId: c.agency.id, agencyName: c.agency.name });
    }
    uidToParentAgencies.set(c.lineFriend.uid, list);
  }

  return { uidToFriend, uidToAs, uidToParentAgencies, ownContactLineFriendIds };
}

/**
 * 1担当者についてAS自動解決：free1チェーンを辿ってSlpAs登録者を発見するまで
 * 担当者本人もチェック対象に含める
 */
function resolveAsForContact(
  contact: ContactForResolution,
  ctx: ResolverContext
): { asId: number | null; asName: string | null } {
  if (!contact.lineFriend) return { asId: null, asName: null };

  // 担当者本人のuidがASに登録されているかチェック
  let currentUid: string | null = contact.lineFriend.uid;
  const visited = new Set<string>();

  for (let depth = 0; depth < MAX_DEPTH && currentUid; depth++) {
    if (visited.has(currentUid)) break;
    visited.add(currentUid);

    const as = ctx.uidToAs.get(currentUid);
    if (as) return { asId: as.id, asName: as.name };

    const friend = ctx.uidToFriend.get(currentUid);
    currentUid = friend?.free1 ?? null;
  }

  return { asId: null, asName: null };
}

/**
 * 1担当者について紹介者解決：自社担当者を飛ばして自社外のLineFriendに到達するまで
 * 開始は担当者のfree1から（担当者本人は紹介者ではない）
 * 自社担当者のチェーンを辿った先で複数の自社外ユーザーに到達した場合は全列挙
 */
function resolveReferrerForContact(
  contact: ContactForResolution,
  ctx: ResolverContext
): Array<{ lineFriendId: number; label: string }> {
  if (!contact.lineFriend) return [];

  const found = new Map<number, { lineFriendId: number; label: string }>();
  const visited = new Set<string>();

  // BFSで辿る：自社担当者なら次のfree1も追跡、自社外ならそこで終了
  const queue: string[] = [];
  if (contact.lineFriend.free1) queue.push(contact.lineFriend.free1);

  while (queue.length > 0) {
    const uid = queue.shift()!;
    if (visited.has(uid)) continue;
    visited.add(uid);
    if (visited.size > MAX_DEPTH) break;

    const friend = ctx.uidToFriend.get(uid);
    if (!friend) continue; // システム内に存在しないuidはスキップ

    if (ctx.ownContactLineFriendIds.has(friend.id)) {
      // 自社担当者 → さらに辿る
      if (friend.free1) queue.push(friend.free1);
    } else {
      // 自社外 → ここが紹介者
      if (!found.has(friend.id)) {
        found.set(friend.id, {
          lineFriendId: friend.id,
          label: `${friend.id} ${friend.snsname ?? ""}`.trim(),
        });
      }
    }
  }

  return Array.from(found.values());
}

/**
 * 1担当者について代理店解決：free1から開始してチェーン上で1次代理店の担当者を全列挙
 * 担当者本人は対象外
 */
function resolveAgencyForContact(
  contact: ContactForResolution,
  ctx: ResolverContext
): Array<{ agencyId: number; agencyName: string; label: string }> {
  if (!contact.lineFriend) return [];

  const found = new Map<
    number,
    { agencyId: number; agencyName: string; label: string }
  >();
  const visited = new Set<string>();

  let currentUid: string | null = contact.lineFriend.free1;
  for (let depth = 0; depth < MAX_DEPTH && currentUid; depth++) {
    if (visited.has(currentUid)) break;
    visited.add(currentUid);

    const agencies = ctx.uidToParentAgencies.get(currentUid);
    if (agencies) {
      for (const a of agencies) {
        if (!found.has(a.agencyId)) {
          found.set(a.agencyId, {
            agencyId: a.agencyId,
            agencyName: a.agencyName,
            label: `${a.agencyId} ${a.agencyName}`,
          });
        }
      }
    }

    const friend = ctx.uidToFriend.get(currentUid);
    currentUid = friend?.free1 ?? null;
  }

  return Array.from(found.values());
}

/**
 * 企業1社の担当者リストから AS担当・紹介者・代理店 を解決する
 */
export async function resolveCompanyData(
  contacts: ContactForResolution[]
): Promise<CompanyResolution> {
  const ownIds = new Set<number>(
    contacts
      .map((c) => c.lineFriendId)
      .filter((v): v is number => v !== null)
  );
  const ctx = await buildResolverContext(ownIds);
  return resolveCompanyDataWithContext(contacts, ctx);
}

/**
 * 複数企業を一括解決するためのバッチ版（一覧ページ用、N+1回避）
 */
export async function resolveCompaniesData(
  companies: Array<{ id: number; contacts: ContactForResolution[] }>
): Promise<Map<number, CompanyResolution>> {
  // すべての企業の担当者LINE friend idを集約してcontextを構築
  // ※自社判定は企業ごとに異なるため、contextは共有しつつ ownIds は企業ごとに渡す
  const [allFriends, asRecords, parentAgencyContacts] = await Promise.all([
    prisma.slpLineFriend.findMany({
      where: { deletedAt: null },
      select: { id: true, uid: true, snsname: true, free1: true },
    }),
    prisma.slpAs.findMany({
      include: { lineFriend: { select: { uid: true } } },
    }),
    prisma.slpAgencyContact.findMany({
      where: {
        agency: { parentId: null, deletedAt: null },
      },
      include: {
        agency: { select: { id: true, name: true } },
        lineFriend: { select: { uid: true } },
      },
    }),
  ]);

  const uidToFriend = new Map<
    string,
    { id: number; snsname: string | null; free1: string | null }
  >();
  for (const f of allFriends) {
    uidToFriend.set(f.uid, {
      id: f.id,
      snsname: f.snsname,
      free1: f.free1,
    });
  }

  const uidToAs = new Map<string, { id: number; name: string }>();
  for (const as of asRecords) {
    if (as.lineFriend?.uid) {
      uidToAs.set(as.lineFriend.uid, { id: as.id, name: as.name });
    }
  }

  const uidToParentAgencies = new Map<
    string,
    Array<{ agencyId: number; agencyName: string }>
  >();
  for (const c of parentAgencyContacts) {
    if (!c.lineFriend?.uid) continue;
    const list = uidToParentAgencies.get(c.lineFriend.uid) ?? [];
    if (!list.some((a) => a.agencyId === c.agency.id)) {
      list.push({ agencyId: c.agency.id, agencyName: c.agency.name });
    }
    uidToParentAgencies.set(c.lineFriend.uid, list);
  }

  const result = new Map<number, CompanyResolution>();
  for (const company of companies) {
    const ownIds = new Set<number>(
      company.contacts
        .map((c) => c.lineFriendId)
        .filter((v): v is number => v !== null)
    );
    const ctx: ResolverContext = {
      uidToFriend,
      uidToAs,
      uidToParentAgencies,
      ownContactLineFriendIds: ownIds,
    };
    result.set(company.id, resolveCompanyDataWithContext(company.contacts, ctx));
  }

  return result;
}

function resolveCompanyDataWithContext(
  contacts: ContactForResolution[],
  ctx: ResolverContext
): CompanyResolution {
  const asPerContact: AsResolutionForContact[] = [];
  const referrerPerContact: ReferrerForContact[] = [];
  const agencyPerContact: AgencyForContact[] = [];

  for (const contact of contacts) {
    const contactName = contact.name ?? "(名前未設定)";
    const contactDisplay = `${contact.id} ${contactName}`;

    // AS自動解決
    const autoAs = resolveAsForContact(contact, ctx);
    const isManual = contact.manualAsId !== null && contact.manualAs !== null;

    asPerContact.push({
      contactId: contact.id,
      contactName,
      contactDisplay,
      autoAsId: autoAs.asId,
      autoAsName: autoAs.asName,
      manualAsId: contact.manualAsId,
      manualAsName: contact.manualAs?.name ?? null,
      manualAsReason: contact.manualAsReason,
      manualAsChangedAt: contact.manualAsChangedAt,
      manualAsChangedByName: contact.manualAsChangedByName,
      effectiveAsId: isManual ? contact.manualAs!.id : autoAs.asId,
      effectiveAsName: isManual ? contact.manualAs!.name : autoAs.asName,
      isManual,
    });

    // 紹介者
    referrerPerContact.push({
      contactId: contact.id,
      contactName,
      contactDisplay,
      referrers: resolveReferrerForContact(contact, ctx),
    });

    // 代理店
    agencyPerContact.push({
      contactId: contact.id,
      contactName,
      contactDisplay,
      agencies: resolveAgencyForContact(contact, ctx),
    });
  }

  // ============================================
  // 集約: 解決値ごとに由来担当者リストを構築
  // ============================================

  // AS担当の集約
  const asKey = (
    a: AsResolutionForContact
  ): string => {
    if (!a.effectiveAsId && !a.effectiveAsName) return "__none__";
    return `${a.isManual ? "M" : "A"}:${a.effectiveAsId ?? a.effectiveAsName}`;
  };
  const asMap = new Map<
    string,
    {
      label: string;
      asId: number | null;
      asName: string | null;
      isManual: boolean;
      manualAsReason: string | null;
      autoAsName: string | null;
      contacts: string[];
    }
  >();
  for (const a of asPerContact) {
    if (!a.effectiveAsName) continue;
    const key = asKey(a);
    const existing = asMap.get(key);
    if (existing) {
      existing.contacts.push(a.contactDisplay);
    } else {
      asMap.set(key, {
        label: a.isManual
          ? `${a.effectiveAsName}(手動)`
          : a.effectiveAsName,
        asId: a.effectiveAsId,
        asName: a.effectiveAsName,
        isManual: a.isManual,
        manualAsReason: a.manualAsReason,
        autoAsName: a.isManual ? a.autoAsName : null,
        contacts: [a.contactDisplay],
      });
    }
  }

  // 紹介者の集約
  const referrerMap = new Map<
    number,
    { label: string; lineFriendId: number; contacts: string[] }
  >();
  for (const r of referrerPerContact) {
    for (const ref of r.referrers) {
      const existing = referrerMap.get(ref.lineFriendId);
      if (existing) {
        if (!existing.contacts.includes(r.contactDisplay)) {
          existing.contacts.push(r.contactDisplay);
        }
      } else {
        referrerMap.set(ref.lineFriendId, {
          label: ref.label,
          lineFriendId: ref.lineFriendId,
          contacts: [r.contactDisplay],
        });
      }
    }
  }

  // 代理店の集約
  const agencyMap = new Map<
    number,
    {
      label: string;
      agencyId: number;
      agencyName: string;
      contacts: string[];
    }
  >();
  for (const ag of agencyPerContact) {
    for (const a of ag.agencies) {
      const existing = agencyMap.get(a.agencyId);
      if (existing) {
        if (!existing.contacts.includes(ag.contactDisplay)) {
          existing.contacts.push(ag.contactDisplay);
        }
      } else {
        agencyMap.set(a.agencyId, {
          label: a.label,
          agencyId: a.agencyId,
          agencyName: a.agencyName,
          contacts: [ag.contactDisplay],
        });
      }
    }
  }

  // 1人の担当者から複数の1次代理店が見つかった場合の警告
  const multipleAgencyWarnings: Array<{
    contactDisplay: string;
    agencyLabels: string[];
  }> = [];
  for (const ag of agencyPerContact) {
    if (ag.agencies.length > 1) {
      multipleAgencyWarnings.push({
        contactDisplay: ag.contactDisplay,
        agencyLabels: ag.agencies.map((a) => a.label),
      });
    }
  }

  return {
    perContact: {
      as: asPerContact,
      referrer: referrerPerContact,
      agency: agencyPerContact,
    },
    aggregated: {
      as: Array.from(asMap.values()),
      referrer: Array.from(referrerMap.values()),
      agency: Array.from(agencyMap.values()),
      multipleAgencyWarnings,
    },
  };
}

// ============================================
// 公開ヘルパー: 1事業者の紹介者LINE友達一覧を取得
// （紹介者通知UIなど、紹介者だけ欲しい用途向けの軽量版）
// ============================================

export type ReferrerForCompanyOption = {
  lineFriendId: number;
  uid: string;
  snsname: string | null;
  /** "{lineFriendId} {snsname}" 形式の表示用ラベル */
  label: string;
};

/**
 * 事業者単位で紹介者を一覧化して返す。
 * 仕組みは事業者名簿の「紹介者」列と同じ：
 *   担当者ごとに free1 チェーンを辿り、自社外の LineFriend に到達した人を
 *   重複排除して全列挙する。
 *
 * 紹介者通知モーダル（手動セット/予約中昇格/飛び）でチェックリスト表示するために使用。
 */
export async function resolveReferrersForCompany(
  companyRecordId: number
): Promise<ReferrerForCompanyOption[]> {
  // 担当者と LINE 友達情報を取得
  const contacts = await prisma.slpCompanyContact.findMany({
    where: { companyRecordId },
    include: {
      lineFriend: {
        select: { id: true, uid: true, snsname: true, free1: true },
      },
    },
  });

  const ownContactLineFriendIds = new Set<number>(
    contacts
      .map((c) => c.lineFriendId)
      .filter((v): v is number => v !== null)
  );
  const ctx = await buildResolverContext(ownContactLineFriendIds);

  // 全担当者から紹介者解決を実行して LineFriendId で重複排除
  const found = new Map<number, ReferrerForCompanyOption>();
  for (const c of contacts) {
    const contactInput: ContactForResolution = {
      id: c.id,
      name: c.name,
      lineFriendId: c.lineFriendId,
      manualAsId: null,
      manualAsReason: null,
      manualAsChangedAt: null,
      manualAsChangedByName: null,
      manualAs: null,
      lineFriend: c.lineFriend,
    };
    const referrers = resolveReferrerForContact(contactInput, ctx);
    for (const r of referrers) {
      if (found.has(r.lineFriendId)) continue;
      const friendInfo = Array.from(ctx.uidToFriend.entries()).find(
        ([, f]) => f.id === r.lineFriendId
      );
      if (!friendInfo) continue;
      const [uid, friend] = friendInfo;
      found.set(r.lineFriendId, {
        lineFriendId: r.lineFriendId,
        uid,
        snsname: friend.snsname,
        label: r.label,
      });
    }
  }

  return Array.from(found.values()).sort(
    (a, b) => a.lineFriendId - b.lineFriendId
  );
}

// ============================================
// LINE友達単位の代理店階層解決（公式LINE友達情報ページ用）
// ============================================

export type AgencyTreeNode = {
  id: number;
  name: string;
  isHit: boolean;
  children: AgencyTreeNode[];
};

export type LineFriendAgencyResolution = {
  primaryAgencies: Array<{ id: number; name: string }>;
  trees: AgencyTreeNode[];
  hasDeepHierarchy: boolean;
  hasMultiplePrimaries: boolean;
};

/**
 * LINE友達ごとの代理店階層解決（バッチ）
 * 既存の resolveAgencyForContact との違い:
 *   - 1次代理店フィルタを外し、free1チェーン上で全段の代理店ヒットを検出
 *   - ヒット代理店から parentId を辿って 1次代理店までのツリーを構築
 *
 * 用途: /slp/line-friends ページの「ユーザー情報」タブで
 *       1次代理店表示 + 2次以降があれば階層モーダル表示
 */
export async function resolveLineFriendAgencyHierarchies(
  lineFriendIds: number[]
): Promise<Map<number, LineFriendAgencyResolution>> {
  const [allAgencies, allContacts, allFriends] = await Promise.all([
    prisma.slpAgency.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, parentId: true },
    }),
    prisma.slpAgencyContact.findMany({
      where: { agency: { deletedAt: null } },
      select: {
        agency: { select: { id: true, name: true, parentId: true } },
        lineFriend: { select: { uid: true } },
      },
    }),
    prisma.slpLineFriend.findMany({
      where: { deletedAt: null },
      select: { id: true, uid: true, free1: true },
    }),
  ]);

  const agencyById = new Map<
    number,
    { id: number; name: string; parentId: number | null }
  >();
  for (const a of allAgencies) {
    agencyById.set(a.id, { id: a.id, name: a.name, parentId: a.parentId });
  }

  // uid → そのLINE友達が担当者になっている代理店の配列（全段対応）
  const uidToAgencies = new Map<
    string,
    Array<{ agencyId: number; agencyName: string; parentId: number | null }>
  >();
  for (const c of allContacts) {
    if (!c.lineFriend?.uid) continue;
    const list = uidToAgencies.get(c.lineFriend.uid) ?? [];
    if (!list.some((a) => a.agencyId === c.agency.id)) {
      list.push({
        agencyId: c.agency.id,
        agencyName: c.agency.name,
        parentId: c.agency.parentId,
      });
    }
    uidToAgencies.set(c.lineFriend.uid, list);
  }

  const uidToFriend = new Map<string, { id: number; free1: string | null }>();
  const idToFriend = new Map<number, { uid: string; free1: string | null }>();
  for (const f of allFriends) {
    uidToFriend.set(f.uid, { id: f.id, free1: f.free1 });
    idToFriend.set(f.id, { uid: f.uid, free1: f.free1 });
  }

  // 代理店IDから祖先チェーンを取得（root → ... → 自分）
  function getAncestorChain(
    agencyId: number
  ): Array<{ id: number; name: string }> {
    const chain: Array<{ id: number; name: string }> = [];
    const seen = new Set<number>();
    let current: number | null = agencyId;
    while (current !== null && !seen.has(current)) {
      seen.add(current);
      const ag = agencyById.get(current);
      if (!ag) break;
      chain.push({ id: ag.id, name: ag.name });
      current = ag.parentId;
    }
    return chain.reverse();
  }

  const result = new Map<number, LineFriendAgencyResolution>();

  for (const lineFriendId of lineFriendIds) {
    const startFriend = idToFriend.get(lineFriendId);
    if (!startFriend) {
      result.set(lineFriendId, {
        primaryAgencies: [],
        trees: [],
        hasDeepHierarchy: false,
        hasMultiplePrimaries: false,
      });
      continue;
    }

    // free1から開始（本人は対象外）
    let currentUid: string | null = startFriend.free1;
    const visited = new Set<string>();
    const hits = new Map<
      number,
      { agencyId: number; agencyName: string; parentId: number | null }
    >();

    for (let depth = 0; depth < MAX_DEPTH && currentUid; depth++) {
      if (visited.has(currentUid)) break;
      visited.add(currentUid);

      const agencies = uidToAgencies.get(currentUid);
      if (agencies) {
        for (const a of agencies) {
          if (!hits.has(a.agencyId)) {
            hits.set(a.agencyId, a);
          }
        }
      }

      const friend = uidToFriend.get(currentUid);
      currentUid = friend?.free1 ?? null;
    }

    if (hits.size === 0) {
      result.set(lineFriendId, {
        primaryAgencies: [],
        trees: [],
        hasDeepHierarchy: false,
        hasMultiplePrimaries: false,
      });
      continue;
    }

    // 各ヒットの祖先チェーンを構築
    const chainsByHit = new Map<
      number,
      Array<{ id: number; name: string }>
    >();
    const rootIds = new Set<number>();
    let hasDeepHierarchy = false;

    for (const hit of hits.values()) {
      const chain = getAncestorChain(hit.agencyId);
      chainsByHit.set(hit.agencyId, chain);
      if (chain.length > 0) rootIds.add(chain[0].id);
      if (hit.parentId !== null) hasDeepHierarchy = true;
    }

    const primaryAgencies = Array.from(rootIds)
      .map((rid) => {
        const ag = agencyById.get(rid);
        return ag ? { id: ag.id, name: ag.name } : null;
      })
      .filter((v): v is { id: number; name: string } => v !== null);

    // 1次代理店ごとにツリー構築（ヒット系統のみ含む）
    const trees: AgencyTreeNode[] = [];
    for (const rootId of rootIds) {
      const root = agencyById.get(rootId);
      if (!root) continue;
      const nodes = new Map<number, AgencyTreeNode>();
      const rootNode: AgencyTreeNode = {
        id: root.id,
        name: root.name,
        isHit: hits.has(root.id),
        children: [],
      };
      nodes.set(rootId, rootNode);

      for (const chain of chainsByHit.values()) {
        if (chain.length === 0 || chain[0].id !== rootId) continue;
        for (let i = 1; i < chain.length; i++) {
          const cur = chain[i];
          if (!nodes.has(cur.id)) {
            const newNode: AgencyTreeNode = {
              id: cur.id,
              name: cur.name,
              isHit: hits.has(cur.id),
              children: [],
            };
            nodes.set(cur.id, newNode);
            const parent = nodes.get(chain[i - 1].id);
            parent?.children.push(newNode);
          }
        }
      }

      trees.push(rootNode);
    }

    result.set(lineFriendId, {
      primaryAgencies,
      trees,
      hasDeepHierarchy,
      hasMultiplePrimaries: rootIds.size > 1,
    });
  }

  return result;
}
