import { getValidZoomAccessTokenForStaff } from "./oauth";
import { ZOOM_API_BASE } from "./constants";

export class ZoomApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`Zoom API error ${status}: ${body.slice(0, 500)}`);
    this.status = status;
    this.body = body;
  }
}

export type StaffZoomContext = {
  accessToken: string;
  integrationId: number;
  externalUserId: string;
};

export async function requireStaffZoomContext(
  staffId: number
): Promise<StaffZoomContext> {
  const ctx = await getValidZoomAccessTokenForStaff(staffId);
  if (!ctx) {
    throw new Error(
      `担当者スタッフ(ID=${staffId})のZoom連携が未完了または切断されています。スタッフ設定から連携してください。`
    );
  }
  return ctx;
}

export async function zoomFetch(
  accessToken: string,
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = 20000, ...rest } = init ?? {};
  const url = path.startsWith("http") ? path : `${ZOOM_API_BASE}${path}`;
  const res = await fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res;
}

export async function zoomFetchJson<T>(
  accessToken: string,
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const res = await zoomFetch(accessToken, path, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ZoomApiError(res.status, body);
  }
  if (res.status === 204) {
    return undefined as unknown as T;
  }
  return (await res.json()) as T;
}
