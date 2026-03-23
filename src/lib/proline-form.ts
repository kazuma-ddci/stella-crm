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
