// ============================================
// MoneyForward API クライアント
// OAuth トークン管理 + API呼び出し
// ============================================
//
// 必要な環境変数:
//   MONEYFORWARD_CLIENT_ID     - MFアプリのクライアントID
//   MONEYFORWARD_CLIENT_SECRET - MFアプリのクライアントシークレット
//   MONEYFORWARD_REDIRECT_URI  - OAuthコールバックURL
// ============================================

import { prisma } from "@/lib/prisma";
import type {
  MFAccountListResponse,
  MFTokenResponse,
  MFTransactionListResponse,
} from "./types";

const MF_BASE_URL = "https://moneyforward.com/api/v1";
const MF_AUTH_URL = "https://moneyforward.com/oauth/authorize";
const MF_TOKEN_URL = "https://moneyforward.com/oauth/token";

function getClientId(): string {
  const id = process.env.MONEYFORWARD_CLIENT_ID;
  if (!id) throw new Error("MONEYFORWARD_CLIENT_ID が設定されていません");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.MONEYFORWARD_CLIENT_SECRET;
  if (!secret)
    throw new Error("MONEYFORWARD_CLIENT_SECRET が設定されていません");
  return secret;
}

function getRedirectUri(): string {
  const uri = process.env.MONEYFORWARD_REDIRECT_URI;
  if (!uri) throw new Error("MONEYFORWARD_REDIRECT_URI が設定されていません");
  return uri;
}

// ============================================
// OAuth ヘルパー（クラス外で使用可能）
// ============================================

/** OAuth認可URLを生成 */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "manage_transactions manage_accounts",
    state,
  });
  return `${MF_AUTH_URL}?${params.toString()}`;
}

/** 認可コードをトークンに交換 */
export async function exchangeCode(code: string): Promise<MFTokenResponse> {
  const res = await fetch(MF_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      client_id: getClientId(),
      client_secret: getClientSecret(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MF トークン交換失敗 (${res.status}): ${text}`);
  }

  return res.json() as Promise<MFTokenResponse>;
}

// ============================================
// API クライアント（DB上の接続情報を使用）
// ============================================

export class MoneyForwardClient {
  private connectionId: number;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(connectionId: number) {
    this.connectionId = connectionId;
  }

  /** DB から接続情報を読み込み */
  private async loadConnection() {
    const conn = await prisma.moneyForwardConnection.findUnique({
      where: { id: this.connectionId },
    });
    if (!conn) {
      throw new Error(
        `MoneyForwardConnection id=${this.connectionId} が見つかりません`
      );
    }
    if (!conn.isActive) {
      throw new Error(
        `MoneyForwardConnection id=${this.connectionId} は無効です`
      );
    }
    this.accessToken = conn.accessToken;
    this.tokenExpiresAt = conn.tokenExpiresAt;
    return conn;
  }

  /** トークンをリフレッシュしてDBに保存 */
  async refreshAccessToken(): Promise<void> {
    const conn = await prisma.moneyForwardConnection.findUnique({
      where: { id: this.connectionId },
    });
    if (!conn) {
      throw new Error(
        `MoneyForwardConnection id=${this.connectionId} が見つかりません`
      );
    }

    const res = await fetch(MF_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: conn.refreshToken,
        client_id: getClientId(),
        client_secret: getClientSecret(),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      // リフレッシュ失敗時は接続を無効化
      await prisma.moneyForwardConnection.update({
        where: { id: this.connectionId },
        data: { isActive: false },
      });
      throw new Error(`MF トークンリフレッシュ失敗 (${res.status}): ${text}`);
    }

    const tokens = (await res.json()) as MFTokenResponse;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.moneyForwardConnection.update({
      where: { id: this.connectionId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
      },
    });

    this.accessToken = tokens.access_token;
    this.tokenExpiresAt = expiresAt;
  }

  /** トークンが有効か確認し、期限切れならリフレッシュ */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiresAt) {
      await this.loadConnection();
    }

    // 有効期限の5分前にリフレッシュ（余裕を持つ）
    const bufferMs = 5 * 60 * 1000;
    if (this.tokenExpiresAt && this.tokenExpiresAt.getTime() - bufferMs < Date.now()) {
      await this.refreshAccessToken();
    }
  }

  /** 認証付きAPIリクエスト */
  private async apiRequest<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    await this.ensureValidToken();

    const url = new URL(`${MF_BASE_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/json",
      },
    });

    if (res.status === 401) {
      // 一度だけリフレッシュしてリトライ
      await this.refreshAccessToken();
      const retryRes = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: "application/json",
        },
      });
      if (!retryRes.ok) {
        const text = await retryRes.text();
        throw new Error(`MF API エラー (${retryRes.status}): ${text}`);
      }
      return retryRes.json() as Promise<T>;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MF API エラー (${res.status}): ${text}`);
    }

    return res.json() as Promise<T>;
  }

  /** 取引一覧を取得 */
  async getTransactions(params: {
    fromDate: string;
    toDate?: string;
    offset?: number;
    limit?: number;
  }): Promise<MFTransactionListResponse> {
    const queryParams: Record<string, string> = {
      from_date: params.fromDate,
    };
    if (params.toDate) queryParams.to_date = params.toDate;
    if (params.offset !== undefined)
      queryParams.offset = String(params.offset);
    if (params.limit !== undefined) queryParams.limit = String(params.limit);

    return this.apiRequest<MFTransactionListResponse>(
      "/transactions",
      queryParams
    );
  }

  /** 口座一覧を取得 */
  async getAccounts(): Promise<MFAccountListResponse> {
    return this.apiRequest<MFAccountListResponse>("/accounts");
  }
}
