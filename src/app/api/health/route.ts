import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cloudsignClient } from "@/lib/cloudsign";
import { ImapFlow } from "imapflow";
import fs from "fs/promises";
import path from "path";

type CheckStatus = "ok" | "warn" | "error";

type CheckResult = {
  name: string;
  status: CheckStatus;
  message?: string;
  durationMs: number;
};

type HealthResponse = {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  checks: CheckResult[];
};

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
  "NEXT_PUBLIC_APP_URL",
  "CRON_SECRET",
];

const CRON_ENDPOINTS = [
  "/api/cron/check-inbound-invoices",
  "/api/cron/sync-cloudsign-status",
  "/api/cron/fetch-usdt-rate",
];

async function runCheck(
  name: string,
  fn: () => Promise<{ status: CheckStatus; message?: string }>
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      name,
      status: result.status,
      message: result.message,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name,
      status: "error",
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

// 1. 環境変数チェック
async function checkEnvVars(): Promise<{
  status: CheckStatus;
  message?: string;
}> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    return {
      status: "error",
      message: `未設定の環境変数: ${missing.join(", ")}`,
    };
  }
  return { status: "ok" };
}

// 2. DB接続チェック
async function checkDatabase(): Promise<{
  status: CheckStatus;
  message?: string;
}> {
  await prisma.$queryRaw`SELECT 1`;
  return { status: "ok" };
}

// 3. IMAPチェック
async function checkImap(): Promise<{
  status: CheckStatus;
  message?: string;
}> {
  const accounts = await prisma.operatingCompanyEmail.findMany({
    where: {
      enableInbound: true,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      imapHost: true,
      imapPort: true,
      imapUser: true,
      imapPass: true,
    },
  });

  if (accounts.length === 0) {
    return { status: "ok", message: "IMAP対象アカウントなし" };
  }

  const errors: string[] = [];

  for (const account of accounts) {
    if (!account.imapHost || !account.imapUser || !account.imapPass) {
      errors.push(`${account.email}: IMAP設定が不完全`);
      continue;
    }

    const client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort || 993,
      secure: true,
      auth: {
        user: account.imapUser,
        pass: account.imapPass,
      },
      logger: false,
    });

    try {
      // 5秒タイムアウト
      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("タイムアウト(5秒)")), 5000)
        ),
      ]);
      await client.logout();
    } catch (err) {
      errors.push(
        `${account.email}: ${err instanceof Error ? err.message : String(err)}`
      );
      // 接続が残っている場合に備えてクリーンアップ
      try {
        await client.logout();
      } catch {
        // ignore
      }
    }
  }

  if (errors.length > 0) {
    return {
      status: "error",
      message: errors.join("; "),
    };
  }
  return { status: "ok", message: `${accounts.length}アカウント接続成功` };
}

// 4. ファイルシステムチェック
async function checkFilesystem(): Promise<{
  status: CheckStatus;
  message?: string;
}> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");

  try {
    await fs.access(uploadsDir, fs.constants.W_OK);
  } catch {
    return {
      status: "error",
      message: `${uploadsDir} が存在しないか書き込み不可`,
    };
  }

  return { status: "ok" };
}

// 5. CloudSign APIチェック
async function checkCloudSign(): Promise<{
  status: CheckStatus;
  message?: string;
}> {
  const companies = await prisma.operatingCompany.findMany({
    where: {
      isActive: true,
      cloudsignClientId: { not: null },
    },
    select: {
      id: true,
      companyName: true,
      cloudsignClientId: true,
    },
  });

  if (companies.length === 0) {
    return { status: "ok", message: "CloudSign連携設定なし" };
  }

  const errors: string[] = [];

  for (const company of companies) {
    try {
      // 5秒タイムアウト
      await Promise.race([
        cloudsignClient.getToken(company.cloudsignClientId!),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("タイムアウト(5秒)")), 5000)
        ),
      ]);
    } catch (err) {
      errors.push(
        `${company.companyName}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (errors.length > 0) {
    return {
      status: "error",
      message: errors.join("; "),
    };
  }
  return { status: "ok", message: `${companies.length}社トークン取得成功` };
}

// 6. Cronエンドポイント到達性チェック
async function checkCronEndpoints(): Promise<{
  status: CheckStatus;
  message?: string;
}> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return { status: "warn", message: "CRON_SECRETが未設定" };
  }

  const errors: string[] = [];

  for (const endpoint of CRON_ENDPOINTS) {
    try {
      const res = await Promise.race([
        fetch(`http://localhost:3000${endpoint}`, {
          headers: { Authorization: `Bearer ${cronSecret}` },
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("タイムアウト(5秒)")), 5000)
        ),
      ]);
      if (!res.ok) {
        errors.push(`${endpoint}: HTTP ${res.status}`);
      }
    } catch (err) {
      errors.push(
        `${endpoint}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (errors.length > 0) {
    // 起動直後は自分自身にアクセスできない場合があるためwarn扱い
    return {
      status: "warn",
      message: errors.join("; "),
    };
  }
  return {
    status: "ok",
    message: `${CRON_ENDPOINTS.length}エンドポイント到達OK`,
  };
}

export async function GET(request: Request) {
  // CRON_SECRET認証
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Health] CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 全チェックを並列実行
  const checks = await Promise.all([
    runCheck("環境変数", checkEnvVars),
    runCheck("データベース接続", checkDatabase),
    runCheck("IMAP接続", checkImap),
    runCheck("ファイルシステム", checkFilesystem),
    runCheck("CloudSign API", checkCloudSign),
    runCheck("Cronエンドポイント到達性", checkCronEndpoints),
  ]);

  // 全体ステータスを判定
  const hasError = checks.some((c) => c.status === "error");
  const hasWarn = checks.some((c) => c.status === "warn");

  let status: "ok" | "degraded" | "error";
  if (hasError) {
    status = "error";
  } else if (hasWarn) {
    status = "degraded";
  } else {
    status = "ok";
  }

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    checks,
  };

  return NextResponse.json(response, {
    status: status === "error" ? 503 : 200,
  });
}
