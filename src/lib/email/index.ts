import nodemailer from "nodemailer";

// SMTPトランスポートの設定
const transporter =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false, // TLS
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    : null;

const FROM_EMAIL_ADDRESS = process.env.EMAIL_FROM || "noreply@example.com";
const FROM_EMAIL = `Stella株式会社 <${FROM_EMAIL_ADDRESS}>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// メール送信が無効な場合のフォールバック処理
function isEmailEnabled(): boolean {
  return !!transporter;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

/**
 * メール認証用のメールを送信
 */
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<EmailResult> {
  const verifyUrl = `${APP_URL}/verify-email/${token}`;

  if (!isEmailEnabled()) {
    console.log(`[DEV] Verification email would be sent to: ${to}`);
    console.log(`[DEV] Verification URL: ${verifyUrl}`);
    return { success: true };
  }

  try {
    await transporter!.sendMail({
      from: FROM_EMAIL,
      to,
      subject: "【CRM】メールアドレスの確認",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>メールアドレスの確認</h2>
          <p>${name} 様</p>
          <p>CRMシステムへのご登録ありがとうございます。</p>
          <p>以下のボタンをクリックして、メールアドレスの認証を完了してください。</p>
          <div style="margin: 30px 0;">
            <a href="${verifyUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              メールアドレスを認証する
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            このリンクは24時間有効です。<br>
            ボタンがクリックできない場合は、以下のURLをコピーしてブラウザに貼り付けてください。<br>
            <a href="${verifyUrl}">${verifyUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">
            このメールに心当たりがない場合は、無視していただいて構いません。
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "メール送信に失敗しました",
    };
  }
}

/**
 * 承認完了通知メールを送信
 */
export async function sendApprovalNotificationEmail(
  to: string,
  name: string
): Promise<EmailResult> {
  const loginUrl = `${APP_URL}/login`;

  if (!isEmailEnabled()) {
    console.log(`[DEV] Approval notification email would be sent to: ${to}`);
    console.log(`[DEV] Login URL: ${loginUrl}`);
    return { success: true };
  }

  try {
    await transporter!.sendMail({
      from: FROM_EMAIL,
      to,
      subject: "【CRM】アカウントが承認されました",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>アカウント承認完了</h2>
          <p>${name} 様</p>
          <p>CRMシステムのアカウントが承認されました。</p>
          <p>以下のボタンからログインしてご利用を開始できます。</p>
          <div style="margin: 30px 0;">
            <a href="${loginUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              ログインする
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">
            ご不明な点がございましたら、管理者までお問い合わせください。
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send approval notification email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "メール送信に失敗しました",
    };
  }
}

/**
 * パスワードリセットメールを送信
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<EmailResult> {
  const resetUrl = `${APP_URL}/reset-password/${token}`;

  if (!isEmailEnabled()) {
    console.log(`[DEV] Password reset email would be sent to: ${to}`);
    console.log(`[DEV] Reset URL: ${resetUrl}`);
    return { success: true };
  }

  try {
    await transporter!.sendMail({
      from: FROM_EMAIL,
      to,
      subject: "【CRM】パスワードリセット",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>パスワードリセット</h2>
          <p>${name} 様</p>
          <p>パスワードリセットのリクエストを受け付けました。</p>
          <p>以下のボタンをクリックして、新しいパスワードを設定してください。</p>
          <div style="margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              パスワードをリセットする
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            このリンクは1時間有効です。<br>
            ボタンがクリックできない場合は、以下のURLをコピーしてブラウザに貼り付けてください。<br>
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">
            このリクエストに心当たりがない場合は、無視していただいて構いません。
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "メール送信に失敗しました",
    };
  }
}

/**
 * 登録招待メールを送信
 */
export async function sendRegistrationInviteEmail(
  to: string,
  companyName: string,
  token: string
): Promise<EmailResult> {
  const registerUrl = `${APP_URL}/register/${token}`;

  if (!isEmailEnabled()) {
    console.log(`[DEV] Registration invite email would be sent to: ${to}`);
    console.log(`[DEV] Register URL: ${registerUrl}`);
    return { success: true };
  }

  try {
    await transporter!.sendMail({
      from: FROM_EMAIL,
      to,
      subject: "【CRM】ユーザー登録のご招待",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>CRMシステム ユーザー登録のご招待</h2>
          <p>${companyName} ご担当者様</p>
          <p>CRMシステムへの登録招待をお送りします。</p>
          <p>以下のボタンをクリックして、アカウント登録を行ってください。</p>
          <div style="margin: 30px 0;">
            <a href="${registerUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              アカウントを登録する
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            ボタンがクリックできない場合は、以下のURLをコピーしてブラウザに貼り付けてください。<br>
            <a href="${registerUrl}">${registerUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">
            この招待に心当たりがない場合は、無視していただいて構いません。
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send registration invite email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "メール送信に失敗しました",
    };
  }
}

/**
 * スタッフ招待メールを送信
 */
export async function sendStaffInviteEmail(
  to: string,
  name: string,
  token: string
): Promise<EmailResult> {
  const setupUrl = `${APP_URL}/staff/setup/${token}`;

  if (!isEmailEnabled()) {
    console.log(`[DEV] Staff invite email would be sent to: ${to}`);
    console.log(`[DEV] Setup URL: ${setupUrl}`);
    return { success: true };
  }

  try {
    await transporter!.sendMail({
      from: FROM_EMAIL,
      to,
      subject: "【社内管理システム】アカウント設定のご案内",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>社内管理システム アカウント設定</h2>
          <p>${name} 様</p>
          <p>社内管理システムのアカウントが作成されました。</p>
          <p>以下のボタンをクリックして、パスワードを設定してください。</p>
          <div style="margin: 30px 0;">
            <a href="${setupUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              パスワードを設定する
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            このリンクは24時間有効です。<br>
            ボタンがクリックできない場合は、以下のURLをコピーしてブラウザに貼り付けてください。<br>
            <a href="${setupUrl}">${setupUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">
            このメールに心当たりがない場合は、管理者までお問い合わせください。
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send staff invite email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "メール送信に失敗しました",
    };
  }
}
