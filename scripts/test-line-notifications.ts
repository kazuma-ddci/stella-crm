/**
 * 通知機能の手動テストスクリプト。
 *
 * 使用方法（Docker内から実行）:
 *   docker compose exec app npx tsx scripts/test-line-notifications.ts <test-name>
 *
 * test-name:
 *   - contract_reminder : 契約書リマインド (Form15, 組合員向け)
 *   - contract_bounced  : メール不達通知 (Form15, 組合員向け)
 *   - friend_added      : 友達追加通知 (Form18, 紹介者向け)
 *   - contract_signed   : 契約締結通知 (Form18, 紹介者向け)
 *
 * 注意:
 *   - 実際にプロラインAPI経由で LINE メッセージが送信される
 *   - ProLine の本番URLを使用するため、uid が実在するアカウントに届く
 */

import { sendMemberNotification } from "../src/lib/slp/slp-member-notification";
import { sendReferralNotification } from "../src/lib/slp/slp-referral-notification";

const TEST_USER_UID = "rbqpdj";

async function runTest(testName: string) {
  console.log(`\n=== テスト実行: ${testName} ===\n`);

  switch (testName) {
    case "contract_reminder": {
      console.log("[組合員向け] 契約書リマインドを送信...");
      console.log(`送信先 uid: ${TEST_USER_UID}`);
      const r = await sendMemberNotification({
        trigger: "contract_reminder",
        memberUid: TEST_USER_UID,
        context: {
          memberName: "塩澤 一馬",
          contractSentDate: "2026年4月15日",
          contractSentEmail: "test-sample@example.com",
        },
      });
      console.log("\n結果:", JSON.stringify(r, null, 2));
      if (r.bodyText) {
        console.log("\n送信された本文:\n---\n" + r.bodyText + "\n---");
      }
      break;
    }

    case "contract_bounced": {
      console.log("[組合員向け] メール不達通知を送信...");
      console.log(`送信先 uid: ${TEST_USER_UID}`);
      const r = await sendMemberNotification({
        trigger: "contract_bounced",
        memberUid: TEST_USER_UID,
        context: {
          memberName: "塩澤 一馬",
          contractSentEmail: "bad-invalid-email@example.com",
        },
      });
      console.log("\n結果:", JSON.stringify(r, null, 2));
      if (r.bodyText) {
        console.log("\n送信された本文:\n---\n" + r.bodyText + "\n---");
      }
      break;
    }

    case "friend_added": {
      console.log("[紹介者向け] 友達追加通知を送信...（あなたが紹介者役）");
      console.log(`送信先 uid (紹介者): ${TEST_USER_UID}`);
      const r = await sendReferralNotification({
        trigger: "friend_added",
        referrerUid: TEST_USER_UID,
        context: {
          addedFriendLineName: "テスト太郎",
        },
      });
      console.log("\n結果:", JSON.stringify(r, null, 2));
      if (r.bodyText) {
        console.log("\n送信された本文:\n---\n" + r.bodyText + "\n---");
      }
      break;
    }

    case "contract_signed": {
      console.log("[紹介者向け] 契約締結通知を送信...（あなたが紹介者役）");
      console.log(`送信先 uid (紹介者): ${TEST_USER_UID}`);
      const r = await sendReferralNotification({
        trigger: "contract_signed",
        referrerUid: TEST_USER_UID,
        context: {
          memberName: "契約者 花子",
          memberLineName: "はなちゃん",
        },
      });
      console.log("\n結果:", JSON.stringify(r, null, 2));
      if (r.bodyText) {
        console.log("\n送信された本文:\n---\n" + r.bodyText + "\n---");
      }
      break;
    }

    default:
      console.error(`不明なテスト名: ${testName}`);
      console.error(
        "利用可能なテスト: contract_reminder / contract_bounced / friend_added / contract_signed"
      );
      process.exit(1);
  }

  console.log("\n=== 完了 ===");
}

const testName = process.argv[2];
if (!testName) {
  console.error("使用: npx tsx scripts/test-line-notifications.ts <test-name>");
  console.error(
    "テスト名: contract_reminder / contract_bounced / friend_added / contract_signed"
  );
  process.exit(1);
}

runTest(testName)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\nエラー:", e);
    process.exit(1);
  });
