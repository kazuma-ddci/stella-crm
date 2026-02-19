/**
 * サービスアカウントがアクセスできる共有ドライブを一覧表示
 * 共有ドライブ作成後に実行して、ドライブIDを確認する
 */
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const KEY_PATH = path.join(process.cwd(), "credentials/google-service-account.json");
const keyFile = JSON.parse(fs.readFileSync(KEY_PATH, "utf-8"));

const auth = new google.auth.GoogleAuth({
  credentials: { client_email: keyFile.client_email, private_key: keyFile.private_key },
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const authClient = await auth.getClient();
const drive = google.drive({ version: "v3", auth: authClient });

console.log("=== 共有ドライブ一覧 ===");
const res = await drive.drives.list({
  pageSize: 50,
});

if (res.data.drives && res.data.drives.length > 0) {
  for (const d of res.data.drives) {
    console.log(`名前: ${d.name}`);
    console.log(`  ID: ${d.id}`);
    console.log(`  → .env に設定: GOOGLE_DRIVE_OUTPUT_FOLDER_ID="${d.id}"`);
    console.log("");
  }
} else {
  console.log("アクセス可能な共有ドライブが見つかりません。");
  console.log("");
  console.log("以下を確認してください:");
  console.log("1. Google Driveで共有ドライブを作成済みか");
  console.log("2. サービスアカウントをメンバーに追加済みか");
  console.log(`   → ${keyFile.client_email}`);
}
