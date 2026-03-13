/**
 * CloudSign Web API クライアント
 *
 * トークン管理（1時間有効、運営法人ごとにキャッシュ）とAPI呼び出しを提供
 *
 * CloudSign APIフロー:
 * 1. POST /documents (template_id指定) → ドラフト書類作成、レスポンスにwidgets/files/participants含む
 * 2. PUT /documents/{id}/participants/{participantId} → 宛先のメール・名前設定
 * 3. PUT /documents/{id}/files/{fileId}/widgets/{widgetId} → 入力項目の値設定
 * 4. POST /documents/{id} → 送信
 *
 * widget_type: 0=署名(stamp), 1=フリーテキスト(text), 2=チェックボックス(checkbox)
 */

const CLOUDSIGN_API_BASE = "https://api.cloudsign.jp";

// ============================================
// Types (実際のAPIレスポンス構造に合わせた型)
// ============================================

export type CloudSignWidget = {
  id: string;
  widget_type: number; // 0=署名(stamp), 1=フリーテキスト(text), 2=チェックボックス(checkbox)
  participant_id: string;
  file_id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  status: number; // 0=未入力, 1=入力完了
  label: string;
  required?: boolean;
};

export type CloudSignDocumentFile = {
  id: string;
  name: string;
  order: number;
  total_pages: number;
  widgets: CloudSignWidget[];
};

export type CloudSignParticipant = {
  id: string;
  email: string;
  name: string;
  organization: string;
  order: number; // 0=送信元, 1以降=送信先
  // 0=アクセス不可, 2=下書き, 3=配送待ち, 4=確認待ち, 6=送信済み,
  // 7=確認済み, 8=捺印/入力完了, 9=却下, 10=取消, 12=署名中
  status: number;
  language_code: string;
};

export type CloudSignDocument = {
  id: string;
  title: string;
  // 0=下書き, 1=先方確認中, 2=締結完了, 3=取消/却下, 4=テンプレート, 13=インポート書類
  status: number;
  note: string;
  message: string;
  participants: CloudSignParticipant[];
  files: CloudSignDocumentFile[];
  created_at: string;
  updated_at: string;
};

// ============================================
// Token Cache
// ============================================

type CachedToken = {
  token: string;
  expiresAt: number;
};

const tokenCache = new Map<string, CachedToken>();
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

// ============================================
// Internal helpers
// ============================================

async function apiRequestForm<T>(
  token: string,
  method: string,
  path: string,
  params: Record<string, string>
): Promise<T> {
  const url = `${CLOUDSIGN_API_BASE}${path}`;
  const body = new URLSearchParams(params);

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.error(`[CloudSign API] ${method} ${path} → ${res.status}: ${errorText}`);
    throw new Error(
      `クラウドサインAPIエラー（${res.status}）: ${errorText || res.statusText}`
    );
  }

  if (res.status === 204) {
    return null as T;
  }

  return res.json();
}

async function apiGet<T>(token: string, path: string): Promise<T> {
  const url = `${CLOUDSIGN_API_BASE}${path}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.error(`[CloudSign API] GET ${path} → ${res.status}: ${errorText}`);
    throw new Error(
      `クラウドサインAPIエラー（${res.status}）: ${errorText || res.statusText}`
    );
  }

  return res.json();
}

// ============================================
// Widget type helpers
// ============================================

/** widget_type → 表示用の種別名 */
export function getWidgetTypeName(widgetType: number): string {
  switch (widgetType) {
    case 0: return "署名";
    case 1: return "フリーテキスト";
    case 2: return "チェックボックス";
    default: return "不明";
  }
}

// ============================================
// API Client
// ============================================

export const cloudsignClient = {
  /**
   * アクセストークンを取得（キャッシュ管理付き）
   */
  async getToken(clientId: string): Promise<string> {
    const cached = tokenCache.get(clientId);
    if (cached) {
      if (cached.expiresAt > Date.now() + TOKEN_EXPIRY_MARGIN_MS) {
        return cached.token;
      }
      // 期限切れキャッシュを削除
      tokenCache.delete(clientId);
    }

    const params = new URLSearchParams();
    params.set("client_id", clientId);

    const res = await fetch(`${CLOUDSIGN_API_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `クラウドサインのトークン取得に失敗しました（${res.status}）: ${errorText}`
      );
    }

    const data = await res.json();
    const token = data.access_token;

    tokenCache.set(clientId, {
      token,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    return token;
  },

  /**
   * テンプレートから書類を作成（ドラフト）
   * レスポンスに files[].widgets と participants が含まれる
   */
  async createDocument(
    token: string,
    templateId: string,
    title: string
  ): Promise<CloudSignDocument> {
    return apiRequestForm<CloudSignDocument>(token, "POST", "/documents", {
      template_id: templateId,
      title,
    });
  },

  /**
   * 宛先（participant）のメール・名前を設定
   * order: 0=送信元, 1以降=送信先
   */
  async updateParticipant(
    token: string,
    documentId: string,
    participantId: string,
    data: { email: string; name?: string; organization?: string }
  ): Promise<void> {
    // CloudSign APIはnameが必須。未設定時はemailのローカル部分をフォールバック
    const name = data.name?.trim() || data.email.split("@")[0];
    const params: Record<string, string> = { email: data.email, name };
    if (data.organization) params.organization = data.organization;
    await apiRequestForm<unknown>(
      token,
      "PUT",
      `/documents/${documentId}/participants/${participantId}`,
      params
    );
  },

  /**
   * フリーテキスト（widget_type=1）の値を設定
   */
  async updateWidgetText(
    token: string,
    documentId: string,
    fileId: string,
    widgetId: string,
    text: string
  ): Promise<void> {
    await apiRequestForm<unknown>(
      token,
      "PUT",
      `/documents/${documentId}/files/${fileId}/widgets/${widgetId}`,
      { text }
    );
  },

  /**
   * チェックボックス（widget_type=2）の値を設定
   * value: "1"=チェック済み, "0"=未チェック
   */
  async updateWidgetCheckbox(
    token: string,
    documentId: string,
    fileId: string,
    widgetId: string,
    checked: boolean
  ): Promise<void> {
    await apiRequestForm<unknown>(
      token,
      "PUT",
      `/documents/${documentId}/files/${fileId}/widgets/${widgetId}`,
      { text: checked ? "1" : "0" }
    );
  },

  /**
   * 書類に新規participantを追加（同意のみ等）
   */
  async addParticipant(
    token: string,
    documentId: string,
    data: { email: string; name: string; organization?: string }
  ): Promise<CloudSignParticipant> {
    const params: Record<string, string> = {
      email: data.email,
      name: data.name,
    };
    if (data.organization) params.organization = data.organization;
    return apiRequestForm<CloudSignParticipant>(
      token,
      "POST",
      `/documents/${documentId}/participants`,
      params
    );
  },

  /**
   * 書類を送信
   * CloudSign APIでは POST /documents/{documentID} が送信エンドポイント
   */
  async sendDocument(token: string, documentId: string): Promise<void> {
    await apiRequestForm<unknown>(token, "POST", `/documents/${documentId}`, {});
  },

  /**
   * 送信済み書類のリマインドを送信
   * CloudSign APIでは送信済み書類に対する POST /documents/{documentID} がリマインドとして機能
   * 現在確認作業を行っている相手にリマインドメールが送られる
   */
  async remindDocument(token: string, documentId: string): Promise<void> {
    await apiRequestForm<unknown>(token, "POST", `/documents/${documentId}`, {});
  },

  /**
   * ドラフト書類を削除
   */
  async deleteDocument(token: string, documentId: string): Promise<void> {
    const url = `${CLOUDSIGN_API_BASE}/documents/${documentId}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`ドラフト削除に失敗しました（${res.status}）`);
    }
  },

  /**
   * 書類の最新情報を取得
   */
  async getDocument(
    token: string,
    documentId: string
  ): Promise<CloudSignDocument> {
    return apiGet<CloudSignDocument>(token, `/documents/${documentId}`);
  },

  /**
   * 締結済みPDFをダウンロード（個別ファイルID指定）
   *
   * CloudSign API: GET /documents/{documentId}/files/{fileId}
   * ※ /files（fileId無し）は403になるため、必ずfileIdを指定すること
   */
  async getDocumentFile(
    token: string,
    documentId: string,
    fileId: string
  ): Promise<Buffer> {
    const url = `${CLOUDSIGN_API_BASE}/documents/${documentId}/files/${fileId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(
        `[CloudSign API] GET /documents/${documentId}/files/${fileId} → ${res.status}: ${errorText}`
      );
      throw new Error(
        `締結済みPDFの取得に失敗しました（${res.status}）`
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },
};
