import { prisma } from "@/lib/prisma";
import {
  ZOOM_OAUTH_BASE,
  ZOOM_SCOPES,
  getZoomClientId,
  getZoomClientSecret,
  getZoomRedirectUri,
  ACCESS_TOKEN_REFRESH_MARGIN_SEC,
} from "./constants";
import { encryptString, decryptString } from "@/lib/crypto-encryption";

// Zoom OAuth認可URL（認可画面へリダイレクト）
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getZoomClientId(),
    redirect_uri: getZoomRedirectUri(),
    scope: ZOOM_SCOPES,
    state,
  });
  return `${ZOOM_OAUTH_BASE}/authorize?${params.toString()}`;
}

type ZoomTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  // API変動対応
  [k: string]: unknown;
};

async function postTokenEndpoint(
  body: URLSearchParams
): Promise<ZoomTokenResponse> {
  const auth = Buffer.from(
    `${getZoomClientId()}:${getZoomClientSecret()}`
  ).toString("base64");
  const res = await fetch(`${ZOOM_OAUTH_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "<no body>");
    throw new Error(`Zoom OAuth token endpoint失敗: ${res.status} ${text}`);
  }
  return (await res.json()) as ZoomTokenResponse;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<ZoomTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getZoomRedirectUri(),
  });
  return postTokenEndpoint(body);
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<ZoomTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return postTokenEndpoint(body);
}

// Zoom /users/me (認可ユーザー情報取得) - 初回連携時にexternalUserId等を埋める
export async function fetchZoomUserMe(accessToken: string): Promise<{
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}> {
  const res = await fetch(`https://api.zoom.us/v2/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Zoom /users/me 失敗: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    id: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    display_name?: string;
  };
  return {
    id: json.id,
    email: json.email ?? null,
    first_name: json.first_name ?? null,
    last_name: json.last_name ?? null,
    display_name: json.display_name ?? null,
  };
}

// OAuthコールバックでトークン交換 + /users/me取得 + DB保存まで一気通貫
export async function completeZoomConnectionForStaff(params: {
  staffId: number;
  code: string;
}): Promise<{ integrationId: number; externalEmail: string | null }> {
  const token = await exchangeCodeForTokens(params.code);
  const me = await fetchZoomUserMe(token.access_token);

  const refreshTokenEnc = encryptString(token.refresh_token);
  const accessTokenEnc = encryptString(token.access_token);
  const accessTokenExpiresAt = new Date(
    Date.now() + token.expires_in * 1000
  );

  // 既存（disconnected含む）を upsert で上書き
  const existing = await prisma.staffMeetingIntegration.findUnique({
    where: {
      staffId_provider: { staffId: params.staffId, provider: "zoom" },
    },
  });

  let row;
  if (existing) {
    row = await prisma.staffMeetingIntegration.update({
      where: { id: existing.id },
      data: {
        externalUserId: me.id,
        externalEmail: me.email,
        externalDisplayName:
          me.display_name ??
          ([me.first_name, me.last_name].filter(Boolean).join(" ") || null),
        refreshTokenEnc,
        accessTokenEnc,
        accessTokenExpiresAt,
        scope: token.scope ?? null,
        connectedAt: new Date(),
        lastRefreshedAt: new Date(),
        disconnectedAt: null,
        disconnectedByStaffId: null,
      },
    });
  } else {
    row = await prisma.staffMeetingIntegration.create({
      data: {
        staffId: params.staffId,
        provider: "zoom",
        externalUserId: me.id,
        externalEmail: me.email,
        externalDisplayName:
          me.display_name ??
          ([me.first_name, me.last_name].filter(Boolean).join(" ") || null),
        refreshTokenEnc,
        accessTokenEnc,
        accessTokenExpiresAt,
        scope: token.scope ?? null,
      },
    });
  }

  return { integrationId: row.id, externalEmail: row.externalEmail };
}

/**
 * 指定スタッフの有効な Zoom access_token を取得する。期限切れ間際ならrefresh実行。
 * 連携未済 or 切断済みの場合は null を返す。
 */
export async function getValidZoomAccessTokenForStaff(
  staffId: number
): Promise<{
  accessToken: string;
  integrationId: number;
  externalUserId: string;
} | null> {
  const row = await prisma.staffMeetingIntegration.findUnique({
    where: {
      staffId_provider: { staffId, provider: "zoom" },
    },
  });
  if (!row || row.disconnectedAt) return null;

  const nowMs = Date.now();
  const expMs = row.accessTokenExpiresAt?.getTime() ?? 0;
  const needsRefresh =
    !row.accessTokenEnc ||
    expMs - nowMs < ACCESS_TOKEN_REFRESH_MARGIN_SEC * 1000;

  if (!needsRefresh && row.accessTokenEnc) {
    return {
      accessToken: decryptString(row.accessTokenEnc),
      integrationId: row.id,
      externalUserId: row.externalUserId,
    };
  }

  // リフレッシュ実行
  const refreshToken = decryptString(row.refreshTokenEnc);
  let refreshed: ZoomTokenResponse;
  try {
    refreshed = await refreshAccessToken(refreshToken);
  } catch (err) {
    throw new Error(
      `Zoom access_token リフレッシュ失敗（staffId=${staffId}）: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // Zoomは refresh 時に新しい refresh_token を返すことがある（要更新）
  const newRefreshEnc = refreshed.refresh_token
    ? encryptString(refreshed.refresh_token)
    : row.refreshTokenEnc;
  const newAccessEnc = encryptString(refreshed.access_token);
  const newExpiresAt = new Date(nowMs + refreshed.expires_in * 1000);

  await prisma.staffMeetingIntegration.update({
    where: { id: row.id },
    data: {
      refreshTokenEnc: newRefreshEnc,
      accessTokenEnc: newAccessEnc,
      accessTokenExpiresAt: newExpiresAt,
      lastRefreshedAt: new Date(),
      scope: refreshed.scope ?? row.scope,
    },
  });

  return {
    accessToken: refreshed.access_token,
    integrationId: row.id,
    externalUserId: row.externalUserId,
  };
}

/**
 * スタッフのZoom連携を解除する（DBレコードは残し、disconnectedAtを立てる）。
 * Zoom側のトークン revoke も試みる（ベストエフォート・失敗してもDB更新は行う）。
 */
export async function disconnectZoomForStaff(params: {
  staffId: number;
  actingStaffId: number;
}): Promise<void> {
  const row = await prisma.staffMeetingIntegration.findUnique({
    where: {
      staffId_provider: { staffId: params.staffId, provider: "zoom" },
    },
  });
  if (!row || row.disconnectedAt) return;

  // Zoom側revoke（best effort）
  try {
    const refreshToken = decryptString(row.refreshTokenEnc);
    const auth = Buffer.from(
      `${getZoomClientId()}:${getZoomClientSecret()}`
    ).toString("base64");
    await fetch(`${ZOOM_OAUTH_BASE}/revoke`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token: refreshToken }).toString(),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // best effort; ignore
  }

  await prisma.staffMeetingIntegration.update({
    where: { id: row.id },
    data: {
      disconnectedAt: new Date(),
      disconnectedByStaffId: params.actingStaffId,
      accessTokenEnc: null,
      accessTokenExpiresAt: null,
    },
  });
}
