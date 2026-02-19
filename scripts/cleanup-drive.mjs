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

// サービスアカウントが所有するファイルを一覧
console.log("=== サービスアカウントのファイル一覧 ===");
const res = await drive.files.list({
  q: "'me' in owners",
  fields: "files(id, name, mimeType, size, createdTime)",
  pageSize: 100,
});

if (res.data.files && res.data.files.length > 0) {
  for (const f of res.data.files) {
    console.log(`${f.name} | ${f.mimeType} | ${f.size || "N/A"} bytes | ${f.createdTime}`);
  }
  console.log(`\n合計: ${res.data.files.length} ファイル`);
} else {
  console.log("ファイルなし");
}

// ストレージ使用量
const about = await drive.about.get({ fields: "storageQuota" });
console.log("\n=== ストレージ使用状況 ===");
console.log(JSON.stringify(about.data.storageQuota, null, 2));

// 古いテストファイルを削除
if (process.argv.includes("--delete") && res.data.files) {
  console.log("\n=== 古いファイルを削除 ===");
  for (const f of res.data.files) {
    if (f.name?.includes("提案資料") || f.name?.includes("テスト")) {
      console.log(`削除: ${f.name} (${f.id})`);
      await drive.files.delete({ fileId: f.id });
    }
  }
  console.log("削除完了");
}
