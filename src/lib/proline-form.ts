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

const FORM4_BASE_URL = "https://zcr5z7pk.autosns.app/fm/HnUSeKL5O9";
const FORM5_BASE_URL = "https://zcr5z7pk.autosns.app/fm/UrXFSkd82v";
const FORM6_BASE_URL = "https://zcr5z7pk.autosns.app/fm/R1eZuaU0hb"; // 概要案内予約
const FORM7_BASE_URL = "https://zcr5z7pk.autosns.app/fm/B6EuRmzFs9"; // 概要案内予約変更
const FORM9_BASE_URL = "https://zcr5z7pk.autosns.app/fm/MmAiXC8uOh"; // 概要案内キャンセル
const FORM10_BASE_URL = "https://zcr5z7pk.autosns.app/fm/IAsRa82wNF"; // 概要案内完了
const FORM11_BASE_URL = "https://zcr5z7pk.autosns.app/fm/YjNCxOyln8"; // 概要案内完了メッセ
const FORM12_BASE_URL = "https://zcr5z7pk.autosns.app/fm/WCBa6uIxM2"; // 契約書リマインド
const FORM13_BASE_URL = "https://zcr5z7pk.autosns.app/fm/MFnuRLpZce"; // 導入希望商談完了お礼メッセ

// 中継URL方式: 予約フォーム自動送信用（hidden で企業名・トークンを送る）
const FORM3_BASE_URL = "https://zcr5z7pk.autosns.app/fm/K2Lb87ZxrQ"; // 概要案内予約フォーム本体
const FORM14_BASE_URL = "https://zcr5z7pk.autosns.app/fm/QQInxpd1l6"; // 導入希望商談予約フォーム本体

const TAG_BRIEFING_COMPLETE_ADD_URL = "https://autosns.jp/api/call-beacon/pWp2FUaCif"; // 概要案内完了タグ付与
const TAG_BRIEFING_COMPLETE_REMOVE_URL = "https://autosns.jp/api/call-beacon/R0I3t5ARZq"; // 概要案内完了タグ削除
const TAG_CONSULTATION_COMPLETE_ADD_URL = "https://autosns.jp/api/call-beacon/mODdQkrvzF"; // 導入希望商談完了タグ付与
const TAG_CONSULTATION_COMPLETE_REMOVE_URL = "https://autosns.jp/api/call-beacon/JFar5gqPeV"; // 導入希望商談完了タグ削除

/**
 * Form4: 友だち追加通知（紹介者に「○○様がLINEに追加されました」と通知）
 */
export async function submitForm4FriendNotification(
  referrerUid: string,
  snsname: string
): Promise<void> {
  const url = `${FORM4_BASE_URL}?uid=${encodeURIComponent(referrerUid)}`;
  const body = { dataType: "json", "form4-1": snsname };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`ProLine Form4 API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== "200" && result.status !== 200) {
    throw new Error(`ProLine Form4 API returned error: ${JSON.stringify(result)}`);
  }
}

/**
 * Form5: 契約締結通知（紹介者に「○○様が組合員になりました」と通知）
 */
export async function submitForm5ContractNotification(
  referrerUid: string,
  lineName: string,
  name: string
): Promise<void> {
  const url = `${FORM5_BASE_URL}?uid=${encodeURIComponent(referrerUid)}`;
  const body = { dataType: "json", "form5-1": lineName, "form5-2": name };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`ProLine Form5 API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== "200" && result.status !== 200) {
    throw new Error(`ProLine Form5 API returned error: ${JSON.stringify(result)}`);
  }
}

/**
 * Form6: 概要案内予約通知（紹介者に「○○様が概要案内を予約しました」と通知）
 */
export async function submitForm6BriefingReservation(
  referrerUid: string,
  snsname: string,
  briefingDate: string
): Promise<void> {
  const url = `${FORM6_BASE_URL}?uid=${encodeURIComponent(referrerUid)}`;
  const body = { dataType: "json", "form6-1": snsname, "form6-2": briefingDate };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`ProLine Form6 API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== "200" && result.status !== 200) {
    throw new Error(`ProLine Form6 API returned error: ${JSON.stringify(result)}`);
  }
}

/**
 * Form7: 概要案内予約変更通知（紹介者に「○○様が概要案内を変更しました」と通知）
 */
export async function submitForm7BriefingChange(
  referrerUid: string,
  snsname: string,
  newBriefingDate: string
): Promise<void> {
  const url = `${FORM7_BASE_URL}?uid=${encodeURIComponent(referrerUid)}`;
  const body = { dataType: "json", "form7-1": snsname, "form7-2": newBriefingDate };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`ProLine Form7 API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== "200" && result.status !== 200) {
    throw new Error(`ProLine Form7 API returned error: ${JSON.stringify(result)}`);
  }
}

/**
 * Form9: 概要案内キャンセル通知（紹介者に「○○様が概要案内をキャンセルしました」と通知）
 */
export async function submitForm9BriefingCancel(
  referrerUid: string,
  snsname: string
): Promise<void> {
  const url = `${FORM9_BASE_URL}?uid=${encodeURIComponent(referrerUid)}`;
  const body = { dataType: "json", "form9-1": snsname };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`ProLine Form9 API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== "200" && result.status !== 200) {
    throw new Error(`ProLine Form9 API returned error: ${JSON.stringify(result)}`);
  }
}

/**
 * Form10: 概要案内完了通知（紹介者に「○○様が概要案内を完了しました」と通知）
 * snsnameは複数の場合カンマ区切り（例: "snsnameA, snsnameB"）
 */
export async function submitForm10BriefingComplete(
  referrerUid: string,
  snsname: string
): Promise<void> {
  const url = `${FORM10_BASE_URL}?uid=${encodeURIComponent(referrerUid)}`;
  const body = { dataType: "json", "form10-1": snsname };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`ProLine Form10 API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== "200" && result.status !== 200) {
    throw new Error(`ProLine Form10 API returned error: ${JSON.stringify(result)}`);
  }
}

/**
 * 概要案内完了タグを付与する（プロライン側のタグ）
 * 成功判定: レスポンスJSONの status === 0
 */
export async function addBriefingCompleteTag(uid: string): Promise<void> {
  const url = `${TAG_BRIEFING_COMPLETE_ADD_URL}/${encodeURIComponent(uid)}`;
  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`タグ付与API HTTP error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== 0) {
    throw new Error(`タグ付与APIエラー: ${JSON.stringify(result)}`);
  }
}

/**
 * 概要案内完了タグを削除する
 * 成功判定: レスポンスJSONの status === 0
 */
export async function removeBriefingCompleteTag(uid: string): Promise<void> {
  const url = `${TAG_BRIEFING_COMPLETE_REMOVE_URL}/${encodeURIComponent(uid)}`;
  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`タグ削除API HTTP error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== 0) {
    throw new Error(`タグ削除APIエラー: ${JSON.stringify(result)}`);
  }
}

/**
 * Form12: 契約書リマインド通知（組合員本人に契約書未締結のお知らせを送信）
 *
 * @param memberUid 組合員のLINE UID
 * @param sentDate 送付日（例: "2026年4月1日"）
 * @param email クラウドサインを送付したメールアドレス
 */
export async function submitForm12ContractReminder(
  memberUid: string,
  sentDate: string,
  email: string
): Promise<void> {
  const url = `${FORM12_BASE_URL}?uid=${encodeURIComponent(memberUid)}`;
  const body = {
    dataType: "json",
    "form12-1": sentDate,
    "form12-2": email,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`ProLine Form12 API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== "200" && result.status !== 200) {
    throw new Error(`ProLine Form12 API returned error: ${JSON.stringify(result)}`);
  }
}

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

/**
 * 導入希望商談完了タグを付与する
 * 成功判定: レスポンスJSONの status === 0
 */
export async function addConsultationCompleteTag(uid: string): Promise<void> {
  const url = `${TAG_CONSULTATION_COMPLETE_ADD_URL}/${encodeURIComponent(uid)}`;
  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`導入希望商談タグ付与API HTTP error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== 0) {
    throw new Error(`導入希望商談タグ付与APIエラー: ${JSON.stringify(result)}`);
  }
}

/**
 * 導入希望商談完了タグを削除する
 * 成功判定: レスポンスJSONの status === 0
 */
export async function removeConsultationCompleteTag(uid: string): Promise<void> {
  const url = `${TAG_CONSULTATION_COMPLETE_REMOVE_URL}/${encodeURIComponent(uid)}`;
  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`導入希望商談タグ削除API HTTP error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== 0) {
    throw new Error(`導入希望商談タグ削除APIエラー: ${JSON.stringify(result)}`);
  }
}

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
