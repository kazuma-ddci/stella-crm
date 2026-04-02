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
    const rule = await prisma.hojoTelegramNotificationRule.findUnique({
      where: { uuid: ruleUuid },
      include: {
        bot: true,
        group: true,
        fixedTopic: { include: { group: true } },
        topicMappings: { include: { topic: { include: { group: true } } } },
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

    // 重複チェック用ハッシュ
    const hashSource = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
    const requestHash = crypto.createHash("md5").update(hashSource).digest("hex");

    const lockCutoff = new Date(Date.now() - rule.duplicateLockSeconds * 1000);
    const existingLog = await prisma.hojoTelegramNotificationLog.findFirst({
      where: { ruleId: rule.id, requestHash, status: "sent", createdAt: { gte: lockCutoff } },
    });

    if (existingLog) {
      return NextResponse.json({ status: "duplicate_prevented", message: "同じリクエストが既に処理中です" });
    }

    // CRM友達情報
    const uid = params["uid"] || "";
    let lineNumber = "データなし";
    let introducer = "データなし";

    if (uid && rule.lineAccountType) {
      try {
        if (rule.lineAccountType === "security-cloud") {
          const friend = await prisma.hojoLineFriendSecurityCloud.findUnique({ where: { uid } });
          if (friend) {
            lineNumber = friend.snsname || "データなし";
            introducer = friend.free1 || "データなし";
          }
        } else if (rule.lineAccountType === "josei-support") {
          const friend = await prisma.hojoLineFriendJoseiSupport.findUnique({
            where: { uid },
            include: { vendors: { take: 1, orderBy: { id: "asc" } } },
          });
          if (friend) {
            lineNumber = friend.snsname || "データなし";
            introducer = friend.vendors[0]?.name || friend.free1 || "データなし";
          }
        }
      } catch {
        // フォールバック
      }
    }

    // スタッフ名の解決
    const prefix = rule.bookingPrefix || "";
    const staffKey = prefix ? `${prefix}-booking-staff` : "";
    const staffName = staffKey ? (params[staffKey] || "") : "";

    // 送信先の解決
    type SendTarget = { chatId: string; topicId: string | null; mention: string };
    const targets: SendTarget[] = [];

    if (rule.topicStrategy === "group_direct" && rule.group) {
      targets.push({ chatId: rule.group.chatId, topicId: null, mention: "" });
    } else if (rule.topicStrategy === "fixed" && rule.fixedTopic?.group) {
      targets.push({
        chatId: rule.fixedTopic.group.chatId,
        topicId: rule.fixedTopic.topicId,
        mention: "",
      });
    } else if (rule.topicStrategy === "staff_mapped") {
      const mapping = (staffName
        ? rule.topicMappings.find((m) => m.staffName === staffName)
        : null) || rule.topicMappings.find((m) => m.isDefault);

      if (mapping?.topic?.group) {
        const mention = mapping.telegramMention
          ? `${staffName || mapping.staffName}(${mapping.telegramMention})`
          : staffName || mapping.staffName;
        targets.push({
          chatId: mapping.topic.group.chatId,
          topicId: mapping.topic.topicId,
          mention,
        });
      }
    }

    if (targets.length === 0 && rule.group) {
      targets.push({ chatId: rule.group.chatId, topicId: null, mention: "" });
    }

    // メンション文字列（最初のターゲットから）
    const mentionStr = targets[0]?.mention || "";

    // プレースホルダー置換
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

    if (prefix) {
      const bookingFields = [
        "booking-id", "booking-create", "booking-start", "booking-start-date",
        "booking-start-time", "booking-end", "booking-end-date", "booking-end-time",
        "booking-duration", "booking-menu", "booking-staff", "booking-num",
        "booking-active-num", "booking-finish-num", "booking-reschedule-num", "booking-cancel-num",
      ];
      for (const field of bookingFields) {
        const key = field.replace(/-/g, "_");
        replacements[`{{${key}}}`] = params[`${prefix}-${field}`] || "";
      }
    }

    replacements["{{booking_history_url}}"] = params["booking"] || "";
    replacements["{{booking_before}}"] = params["booking-before"] || "";
    replacements["{{all_booking_active_num}}"] = params["booking-active-num"] || "";
    replacements["{{all_booking_finish_num}}"] = params["booking-finish-num"] || "";

    const formFields = (rule.includeFormFields as string[] | null) || [];
    for (const field of formFields) {
      replacements[`{{form:${field}}}`] = params[field] || "";
    }

    const customParamsDef = (rule.customParams as Array<{ key: string; label: string }> | null) || [];
    for (const cp of customParamsDef) {
      replacements[`{{custom:${cp.key}}}`] = params[cp.key] || "";
    }

    let messageText = rule.messageTemplate;
    for (const [placeholder, value] of Object.entries(replacements)) {
      messageText = messageText.replaceAll(placeholder, value);
    }

    if (messageText.length > 4000) {
      messageText = messageText.substring(0, 4000) + "\n...メッセージが長すぎるため省略されました";
    }

    // Telegram送信
    let allSent = true;
    for (const target of targets) {
      const payload: Record<string, string> = {
        chat_id: target.chatId,
        text: messageText,
      };
      if (target.topicId) {
        payload.message_thread_id = target.topicId;
      }

      try {
        const res = await fetch(`https://api.telegram.org/bot${rule.bot.token}/sendMessage`, {
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

    await prisma.hojoTelegramNotificationLog.create({
      data: {
        ruleId: rule.id,
        requestHash,
        status: allSent ? "sent" : "error",
        params,
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
