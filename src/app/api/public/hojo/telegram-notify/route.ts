import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ruleUuid = searchParams.get("rule");

  if (!ruleUuid) {
    return NextResponse.json({ status: "error", message: "rule parameter is required" }, { status: 400 });
  }

  try {
    // ルール取得
    const rule = await prisma.hojoTelegramNotificationRule.findUnique({
      where: { uuid: ruleUuid },
      include: {
        bot: true,
        topicMappings: true,
      },
    });

    if (!rule || !rule.isActive || !rule.bot.isActive) {
      return NextResponse.json({ status: "error", message: "Rule not found or inactive" }, { status: 404 });
    }

    // パラメータ収集
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== "rule") params[key] = value;
    });

    // 重複チェック用ハッシュ生成
    const hashSource = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
    const requestHash = crypto.createHash("md5").update(hashSource).digest("hex");

    // 重複チェック
    const lockCutoff = new Date(Date.now() - rule.duplicateLockSeconds * 1000);
    const existingLog = await prisma.hojoTelegramNotificationLog.findFirst({
      where: {
        ruleId: rule.id,
        requestHash,
        status: "sent",
        createdAt: { gte: lockCutoff },
      },
    });

    if (existingLog) {
      return NextResponse.json({ status: "duplicate_prevented", message: "同じリクエストが既に処理中です" });
    }

    // CRM友達情報からデータ取得
    const uid = params["uid"] || "";
    let lineNumber = "データなし";
    let introducer = "データなし";

    if (uid && rule.lineAccountType) {
      try {
        if (rule.lineAccountType === "security-cloud") {
          const friend = await prisma.hojoLineFriendSecurityCloud.findUnique({ where: { uid } });
          if (friend) {
            lineNumber = friend.snsname || "データなし";
            // セキュリティクラウドの紹介者はfree1等のフィールドから取得
            introducer = friend.free1 || "データなし";
          }
        } else if (rule.lineAccountType === "josei-support") {
          const friend = await prisma.hojoLineFriendJoseiSupport.findUnique({
            where: { uid },
            include: { vendors: { take: 1, orderBy: { id: "asc" } } },
          });
          if (friend) {
            lineNumber = friend.snsname || "データなし";
            // 助成金申請サポートの紹介者 = 紹介元ベンダー名
            introducer = friend.vendors[0]?.name || friend.free1 || "データなし";
          }
        }
      } catch {
        // 友達情報取得失敗時はフォールバック
      }
    }

    // スタッフ名からトピックIDとメンションを解決
    const prefix = rule.bookingPrefix || "";
    const staffKey = prefix ? `${prefix}-booking-staff` : "";
    const staffName = staffKey ? (params[staffKey] || "") : "";

    let topicId: string | null = null;
    let mentionStr = "";

    if (rule.topicStrategy === "staff_mapped" && staffName) {
      const mapping = rule.topicMappings.find((m) => m.staffName === staffName) ||
        rule.topicMappings.find((m) => m.isDefault);
      if (mapping) {
        topicId = mapping.topicId;
        mentionStr = mapping.telegramMention
          ? `${staffName}(${mapping.telegramMention})`
          : staffName;
      }
    } else if (rule.topicStrategy === "fixed") {
      topicId = rule.fixedTopicId;
    }
    // group_direct: topicId = null → グループ直接投稿

    // 複数トピック送信の準備（staff_mappedで全トピックに送る場合もある）
    // 基本は1つのトピックに送信、担当者マッピングに従う
    const targetTopics: { topicId: string | null; mention: string }[] = [];

    if (rule.topicStrategy === "staff_mapped") {
      if (staffName) {
        const mapping = rule.topicMappings.find((m) => m.staffName === staffName) ||
          rule.topicMappings.find((m) => m.isDefault);
        if (mapping) {
          targetTopics.push({
            topicId: mapping.topicId,
            mention: mapping.telegramMention ? `${staffName}(${mapping.telegramMention})` : staffName,
          });
        }
      }
      // デフォルトが設定されていてスタッフ名がない場合
      if (targetTopics.length === 0) {
        const defaultMapping = rule.topicMappings.find((m) => m.isDefault);
        if (defaultMapping) {
          targetTopics.push({
            topicId: defaultMapping.topicId,
            mention: "",
          });
        }
      }
    } else if (rule.topicStrategy === "fixed") {
      targetTopics.push({ topicId: rule.fixedTopicId, mention: mentionStr });
    } else {
      // group_direct
      targetTopics.push({ topicId: null, mention: mentionStr });
    }

    // メッセージテンプレートのプレースホルダー置換
    const bookingDatetimeKey = prefix ? `${prefix}-booking-start` : "";
    const replacements: Record<string, string> = {
      "{{linename}}": params["linename"] || "",
      "{{uid}}": uid,
      "{{line_number}}": lineNumber,
      "{{introducer}}": introducer,
      "{{booking_datetime}}": bookingDatetimeKey ? (params[bookingDatetimeKey] || "") : "",
      "{{staff_name}}": staffName,
      "{{as_member_mention}}": mentionStr,
      "{{followed}}": params["followed"] || "",
    };

    // 予約関連の追加プレースホルダー
    if (prefix) {
      replacements[`{{booking_id}}`] = params[`${prefix}-booking-id`] || "";
      replacements[`{{booking_create}}`] = params[`${prefix}-booking-create`] || "";
      replacements[`{{booking_start}}`] = params[`${prefix}-booking-start`] || "";
      replacements[`{{booking_start_date}}`] = params[`${prefix}-booking-start-date`] || "";
      replacements[`{{booking_start_time}}`] = params[`${prefix}-booking-start-time`] || "";
      replacements[`{{booking_end}}`] = params[`${prefix}-booking-end`] || "";
      replacements[`{{booking_end_date}}`] = params[`${prefix}-booking-end-date`] || "";
      replacements[`{{booking_end_time}}`] = params[`${prefix}-booking-end-time`] || "";
      replacements[`{{booking_duration}}`] = params[`${prefix}-booking-duration`] || "";
      replacements[`{{booking_menu}}`] = params[`${prefix}-booking-menu`] || "";
      replacements[`{{booking_staff}}`] = params[`${prefix}-booking-staff`] || "";
      replacements[`{{booking_num}}`] = params[`${prefix}-booking-num`] || "";
      replacements[`{{booking_active_num}}`] = params[`${prefix}-booking-active-num`] || "";
      replacements[`{{booking_finish_num}}`] = params[`${prefix}-booking-finish-num`] || "";
      replacements[`{{booking_reschedule_num}}`] = params[`${prefix}-booking-reschedule-num`] || "";
      replacements[`{{booking_cancel_num}}`] = params[`${prefix}-booking-cancel-num`] || "";
    }

    // 共通変数
    replacements["{{booking_history_url}}"] = params["booking"] || "";
    replacements["{{booking_before}}"] = params["booking-before"] || "";
    replacements["{{all_booking_active_num}}"] = params["booking-active-num"] || "";
    replacements["{{all_booking_finish_num}}"] = params["booking-finish-num"] || "";

    // フォームフィールド
    const formFields = (rule.includeFormFields as string[] | null) || [];
    for (const field of formFields) {
      const value = params[field] || "";
      replacements[`{{form:${field}}}`] = value;
    }

    // カスタムパラメータ
    const customParamsDef = (rule.customParams as Array<{ key: string; label: string }> | null) || [];
    for (const cp of customParamsDef) {
      replacements[`{{custom:${cp.key}}}`] = params[cp.key] || "";
    }

    let messageText = rule.messageTemplate;
    for (const [placeholder, value] of Object.entries(replacements)) {
      messageText = messageText.replaceAll(placeholder, value);
    }

    // 4096文字制限対応
    if (messageText.length > 4000) {
      messageText = messageText.substring(0, 4000) + "\n...メッセージが長すぎるため省略されました";
    }

    // Telegram送信
    let allSent = true;
    for (const target of targetTopics) {
      const payload: Record<string, string> = {
        chat_id: rule.bot.chatId,
        text: messageText,
      };
      if (target.topicId) {
        payload.message_thread_id = target.topicId;
      }

      try {
        const telegramUrl = `https://api.telegram.org/bot${rule.bot.token}/sendMessage`;
        const res = await fetch(telegramUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (!result.ok) {
          console.error("[TelegramNotify] Send failed:", result);
          allSent = false;
        }
      } catch (err) {
        console.error("[TelegramNotify] Fetch error:", err);
        allSent = false;
      }
    }

    // ログ記録
    await prisma.hojoTelegramNotificationLog.create({
      data: {
        ruleId: rule.id,
        requestHash,
        status: allSent ? "sent" : "error",
        params: params,
        errorMessage: allSent ? null : "一部または全ての送信に失敗",
      },
    });

    return NextResponse.json({
      status: allSent ? "ok" : "partial_error",
      telegram: allSent ? "sent" : "some_failed",
    });
  } catch (err) {
    console.error("[TelegramNotify] Unexpected error:", err);
    return NextResponse.json({ status: "error", message: "Internal server error" }, { status: 500 });
  }
}
