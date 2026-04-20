const PROLINE_FORM_URL = "https://zcr5z7pk.autosns.app/fm/AVJSqEbK0G";

export interface ProlineFormData {
  memberCategory: string; // form2-1: 入会者区分
  name: string; // form2-2: お名前
  position: string; // form2-3: 役職
  email: string; // form2-4: メールアドレス
  phone: string; // form2-5: 電話番号
  company: string | null; // form2-6: 法人情報
  address: string; // form2-7: 住所
  note: string | null; // form2-8: 備考
}

export async function submitProlineForm(
  uid: string,
  data: ProlineFormData
): Promise<void> {
  const url = `${PROLINE_FORM_URL}?uid=${encodeURIComponent(uid)}`;

  const body = {
    dataType: "json",
    "form2-1": data.memberCategory,
    "form2-2": data.name,
    "form2-3": data.position,
    "form2-4": data.email,
    "form2-5": data.phone,
    "form2-6": data.company ?? "",
    "form2-7": data.address,
    "form2-8": data.note ?? "",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `ProLine API error: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();
  if (result.status !== "200" && result.status !== 200) {
    throw new Error(
      `ProLine API returned error: ${JSON.stringify(result)}`
    );
  }
}

// Form4/Form5/Form6/Form7/Form9/Form10 は Form18 (紹介者通知統合フォーム)へ統合済み、削除
// Form12 (契約書リマインド) は 2026-04-20 に Form15 (組合員向け契約書通知統合フォーム)へ統合済み、削除
const FORM11_BASE_URL = "https://zcr5z7pk.autosns.app/fm/YjNCxOyln8"; // 概要案内完了メッセ
const FORM13_BASE_URL = "https://zcr5z7pk.autosns.app/fm/MFnuRLpZce"; // 導入希望商談完了お礼メッセ

// 中継URL方式: 予約フォーム自動送信用（hidden で企業名・トークンを送る）
const FORM3_BASE_URL = "https://zcr5z7pk.autosns.app/fm/K2Lb87ZxrQ"; // 概要案内予約フォーム本体
const FORM14_BASE_URL = "https://zcr5z7pk.autosns.app/fm/QQInxpd1l6"; // 導入希望商談予約フォーム本体

// リッチメニュー操作
const RICH_MENU_OPEN_URL = "https://autosns.jp/api/call-beacon/nplh91JwjE"; // リッチメニュー開放 + 解除メッセージ送信

// Form4 (友だち追加通知) / Form5 (契約締結通知) は 2026-04-20 に Form18 に統合、
// src/lib/slp/slp-referral-notification.ts の sendReferralNotification 経由で送信するように移行。
// submitForm6BriefingReservation / submitForm7BriefingChange / submitForm9BriefingCancel /
// submitForm10BriefingComplete は Form18 (submitForm18ReferrerNotification) に統合、Phase 1c で削除済み。

/**
 * Form11: 概要案内完了お礼メッセージ（受講者本人にフリーテキストメッセージを送信）
 */
export async function submitForm11BriefingThankYou(
  attendeeUid: string,
  freeText: string
): Promise<void> {
  const url = `${FORM11_BASE_URL}?uid=${encodeURIComponent(attendeeUid)}`;
  const body = { dataType: "json", "form11-1": freeText };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`ProLine Form11 API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== "200" && result.status !== 200) {
    throw new Error(`ProLine Form11 API returned error: ${JSON.stringify(result)}`);
  }
}

/**
 * Form13: 導入希望商談完了お礼メッセージ（受講者本人にフリーテキストメッセージを送信）
 */
export async function submitForm13ConsultationThankYou(
  attendeeUid: string,
  freeText: string
): Promise<void> {
  const url = `${FORM13_BASE_URL}?uid=${encodeURIComponent(attendeeUid)}`;
  const body = { dataType: "json", "form13-1": freeText };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`ProLine Form13 API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== "200" && result.status !== 200) {
    throw new Error(`ProLine Form13 API returned error: ${JSON.stringify(result)}`);
  }
}

// タグ機能 (briefing-complete / consultation-complete) は 2026-04-17 に全削除

/**
 * Form3: 概要案内予約フォームへの事前データ送信（CRM中継URL方式）
 *
 * CRM中継ページでユーザーが企業を選択した瞬間に、プロライン側のフォームへ
 * 「企業名」と「CRMトークン」を hidden で送り込む。
 * その後ユーザーがプロラインの予約カレンダーから予約を確定すると、これらの値が
 * 予約 webhook 経由で CRM に戻ってきて、CRM 側で正しい企業に紐付けられる。
 *
 * フォーム項目:
 *   form3-1: 企業名 (CRMが事前送信、ユーザーは編集可能だが「変更しないでください」と注記)
 *   form3-2: 年間人件費（役員様分）  ← ユーザーが手動入力
 *   form3-3: 年間人件費（従業員様分） ← ユーザーが手動入力
 *   form3-4: 従業員数               ← ユーザーが手動入力
 *   form3-5: CRMトークン (hidden、CRMが事前送信)
 */
export async function submitForm3PreFillBriefingReservation(
  uid: string,
  companyName: string,
  crmToken: string
): Promise<void> {
  const url = `${FORM3_BASE_URL}?uid=${encodeURIComponent(uid)}`;
  const body = {
    dataType: "json",
    "form3-1": companyName,
    "form3-5": crmToken,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `ProLine Form3 PreFill API error: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();
  if (result.status !== "200" && result.status !== 200) {
    throw new Error(
      `ProLine Form3 PreFill API returned error: ${JSON.stringify(result)}`
    );
  }
}

/**
 * Form14: 導入希望商談予約フォームへの事前データ送信（CRM中継URL方式）
 *
 * 概要案内と同じ要領で、企業名とトークンをhiddenで送る。
 * 導入希望商談はform14で、項目は2つだけ（企業名 + トークン）。
 *
 * フォーム項目:
 *   form14-1: 企業名 (編集可能、「変更しないでください」と注記)
 *   form14-2: CRMトークン (hidden)
 */
export async function submitForm14PreFillConsultationReservation(
  uid: string,
  companyName: string,
  crmToken: string
): Promise<void> {
  const url = `${FORM14_BASE_URL}?uid=${encodeURIComponent(uid)}`;
  const body = {
    dataType: "json",
    "form14-1": companyName,
    "form14-2": crmToken,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `ProLine Form14 PreFill API error: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();
  if (result.status !== "200" && result.status !== 200) {
    throw new Error(
      `ProLine Form14 PreFill API returned error: ${JSON.stringify(result)}`
    );
  }
}

// ============================================
// Form15: 組合員向け契約書通知統合フォーム
// 2026-04-20 に Form12 (契約書リマインド) を Form15 に統合。
// バウンス通知も含め、組合員本人向けの契約書関連通知を
// すべてこのフォーム経由で送信するテンプレベース運用に移行。
// 呼び出し側は src/lib/slp/slp-member-notification.ts の sendMemberNotification を使うこと。
// ============================================

const FORM15_BASE_URL = "https://zcr5z7pk.autosns.app/fm/q4KYTVil9N";

/**
 * Form15 に自由テキスト本文を送信する汎用関数。
 * テンプレートレンダリング後の完成文面を bodyText に渡す。
 * submitForm18ReferrerNotification と同型の戻り値 (ProlineZoomFormResult)。
 */
export async function submitForm15Message(
  uid: string,
  bodyText: string
): Promise<ProlineZoomFormResult> {
  const url = `${FORM15_BASE_URL}?uid=${encodeURIComponent(uid)}`;
  const body: Record<string, string> = {
    dataType: "json",
    "form15-1": bodyText,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    return { ok: false, httpStatus: res.status, responseJson: json };
  }
  const statusField = (json as { status?: string | number } | null)?.status;
  const ok = statusField === "200" || statusField === 200;
  return { ok, httpStatus: res.status, responseJson: json };
}

// メタ情報（ログ記録時などに参照）
export const MEMBER_CONTRACT_FORM = {
  formUrl: FORM15_BASE_URL,
  fieldKey: "form15-1",
  formId: "form15" as const,
};

/**
 * リッチメニューを開放する（call-beacon経由）
 * 成功判定: レスポンスJSONの status === 0
 */
export async function openRichMenuForFriend(uid: string): Promise<void> {
  const url = `${RICH_MENU_OPEN_URL}/${encodeURIComponent(uid)}`;
  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `リッチメニュー開放API HTTP error: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();
  if (result.status !== 0) {
    throw new Error(`リッチメニュー開放APIエラー: ${JSON.stringify(result)}`);
  }
}

// ============================================
// Zoom連携: 予約確定/変更/リマインドメッセージ送信
// プロライン側で「form16の送信完了メッセージ = {{form16-1}}」と設定しておき、
// CRMは form16-1 に完成文をPOSTすることでLINE送信させる。
// ============================================

const FORM16_ZOOM_GUIDE_URL = "https://zcr5z7pk.autosns.app/fm/Qn2rbXgZp7"; // 概要案内Zoom URL通知
const FORM17_ZOOM_CONSULT_URL = "https://zcr5z7pk.autosns.app/fm/lcCZb3zdDW"; // 導入希望商談Zoom URL通知

export type ProlineZoomFormResult = {
  ok: boolean;
  httpStatus: number;
  responseJson: unknown;
};

async function submitZoomMessageForm(params: {
  formUrl: string;
  fieldKey: string; // "form16-1" or "form17-1"
  uid: string;
  bodyText: string;
}): Promise<ProlineZoomFormResult> {
  const url = `${params.formUrl}?uid=${encodeURIComponent(params.uid)}`;
  const body: Record<string, string> = {
    dataType: "json",
    [params.fieldKey]: params.bodyText,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    return { ok: false, httpStatus: res.status, responseJson: json };
  }
  const statusField =
    (json as { status?: string | number } | null)?.status;
  const ok = statusField === "200" || statusField === 200;
  return { ok, httpStatus: res.status, responseJson: json };
}

/**
 * 概要案内のZoom URL案内メッセージをプロライン経由でLINE送信する。
 * bodyTextに完成した文面を渡すと form16-1 に入れてフォーム代理回答 → LINE送信発火。
 */
export async function submitZoomGuideMessage(
  uid: string,
  bodyText: string
): Promise<ProlineZoomFormResult> {
  return submitZoomMessageForm({
    formUrl: FORM16_ZOOM_GUIDE_URL,
    fieldKey: "form16-1",
    uid,
    bodyText,
  });
}

/**
 * 導入希望商談のZoom URL案内メッセージをプロライン経由でLINE送信する。
 */
export async function submitZoomConsultMessage(
  uid: string,
  bodyText: string
): Promise<ProlineZoomFormResult> {
  return submitZoomMessageForm({
    formUrl: FORM17_ZOOM_CONSULT_URL,
    fieldKey: "form17-1",
    uid,
    bodyText,
  });
}

// メタ情報（他所で使う時に参照）
export const ZOOM_GUIDE_FORM = {
  formUrl: FORM16_ZOOM_GUIDE_URL,
  fieldKey: "form16-1",
  category: "briefing" as const,
};

export const ZOOM_CONSULT_FORM = {
  formUrl: FORM17_ZOOM_CONSULT_URL,
  fieldKey: "form17-1",
  category: "consultation" as const,
};

// ============================================
// Form18: 概要案内_紹介者通知用（統合フォーム）
// 旧 Form6/7/9/10 を Form18 に統合。予約確定/変更/キャンセル/完了の全トリガーで
// この1つのフォームを使い、本文テンプレート（SlpNotificationTemplate管理）を切り替える。
// プロライン側で「form18の送信完了メッセージ = {{form18-1}}」と設定しておく。
// ============================================

const FORM18_BRIEFING_REFERRER_URL = "https://zcr5z7pk.autosns.app/fm/K4v2Yh7knG";

/**
 * Form18: 紹介者通知（概要案内 予約確定/変更/キャンセル/完了 の全トリガー統合）
 *
 * 本文テンプレートは SlpNotificationTemplate でトリガー毎に管理し、
 * レンダリング済みの完成文を bodyText に渡す。
 */
export async function submitForm18ReferrerNotification(
  referrerUid: string,
  bodyText: string
): Promise<ProlineZoomFormResult> {
  const url = `${FORM18_BRIEFING_REFERRER_URL}?uid=${encodeURIComponent(referrerUid)}`;
  const body: Record<string, string> = {
    dataType: "json",
    "form18-1": bodyText,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    return { ok: false, httpStatus: res.status, responseJson: json };
  }
  const statusField =
    (json as { status?: string | number } | null)?.status;
  const ok = statusField === "200" || statusField === 200;
  return { ok, httpStatus: res.status, responseJson: json };
}

export const REFERRER_NOTIFICATION_FORM = {
  formUrl: FORM18_BRIEFING_REFERRER_URL,
  fieldKey: "form18-1",
  formId: "form18" as const,
};
