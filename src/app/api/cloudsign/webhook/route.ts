import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncContractStatus } from "@/lib/cloudsign-sync";
import { logAutomationError } from "@/lib/automation-error";
import { sendReferralNotification } from "@/lib/slp/slp-referral-notification";
import { sendMemberNotification } from "@/lib/slp/slp-member-notification";
import { declineSlpContract, resolveRelatedAutomationErrors } from "@/lib/slp-cloudsign";

/**
 * POST /api/cloudsign/webhook
 *
 * CloudSignからのWebhook通知を受信し、契約書ステータスを自動更新する。
 *
 * CloudSign Webhook イベント（text フィールドのプレフィックスで判定）:
 * - text が "COMPLETED ..." → 全員署名完了 → ステータスを「締結済み」に
 * - text が "CANCELED ..."  → 送信取消・拒否 → ステータスを「破棄」に
 * - text が "BOUNCED ..."   → メール不達 → SlpMemberの cloudsignBounced=true
 *
 * 注意: status フィールドは「通知時点のドキュメント状態」を返すため、メール不達時でも
 * status=1（先方確認中）や status=2（締結済）が返ってくる。text プレフィックスで判定する。
 *
 * クラウドサイン側の設定:
 *   管理画面 > 設定 > Web API > Webhook URL に以下を登録（token認証はクエリに付与）
 *   本番: https://portal.stella-international.co.jp/api/cloudsign/webhook?token=<secret>
 *   stg:  https://stg-portal.stella-international.co.jp/api/cloudsign/webhook?token=<secret>
 *   通知条件: 締結時 + 取り消し・却下時 + メール不達時 の3つすべてON
 */

type CloudSignEventType = "completed" | "canceled" | "bounced";

type WebhookPayload = {
  documentID: string;
  status: number;
  userID?: string;
  email?: string;
  text?: string;
};

/**
 * text フィールドのプレフィックスからイベント種別を判定。
 * CloudSign仕様:
 *  - COMPLETED : ... → 締結完了
 *  - CANCELED : ...  → 取り消し・却下
 *  - BOUNCED : [title] sent by [sender] for [email] <[url]> → メール不達
 */
function detectEventType(text?: string): CloudSignEventType | null {
  if (!text) return null;
  const trimmed = text.trimStart();
  if (/^BOUNCED\b/i.test(trimmed)) return "bounced";
  if (/^CANCELED\b/i.test(trimmed)) return "canceled";
  if (/^COMPLETED\b/i.test(trimmed)) return "completed";
  return null;
}

/**
 * BOUNCED text から不達先メールアドレスを抽出。
 * 例: "BOUNCED : タイトル sent by 塩澤 for foo@example.com <https://...>"
 */
function extractBouncedEmail(text?: string): string | null {
  if (!text) return null;
  const match = text.match(/\bfor\s+([^\s<>]+@[^\s<>]+)/i);
  return match?.[1] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    // Webhook認証: CLOUDSIGN_WEBHOOK_SECRET は必須(fail-secure)。
    // 未設定の場合は500を返してリクエストを拒否する。
    // CloudSignのWebhookには独自の署名機構がないため、URLクエリの ?token=<secret> で認証する。
    const webhookSecret = process.env.CLOUDSIGN_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[CloudSign Webhook] CLOUDSIGN_WEBHOOK_SECRET is not configured");
      await logAutomationError({
        source: "cloudsign-webhook/config",
        message: "CLOUDSIGN_WEBHOOK_SECRET 未設定のため Webhook を拒否",
        detail: {
          userAgent: request.headers.get("user-agent") ?? "unknown",
        },
      });
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (token !== webhookSecret) {
      // CloudSignは400番台を「送信成功扱い」で再送しないため、認証失敗はアラート検知に必ず記録
      // （ログを見落とすと永久にWebhookが抜ける可能性があるため）
      console.warn("[CloudSign Webhook] トークン不一致。不正なリクエストの可能性があります。");
      await logAutomationError({
        source: "cloudsign-webhook/auth",
        message: "CloudSign Webhook トークン認証失敗（再送されないため要確認）",
        detail: {
          userAgent: request.headers.get("user-agent") ?? "unknown",
          tokenProvided: token ? "present (mismatched)" : "missing",
          // セキュリティ上、トークン値やクエリパラメータは記録しない
          pathname: url.pathname,
        },
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: WebhookPayload = await request.json();
    const { documentID, status, email, text } = body;

    // ペイロード全体をログ（運用初期のペイロード仕様確認のため）
    console.log(
      `[CloudSign Webhook] documentID=${documentID}, status=${status}, email=${email}, text=${text}`
    );

    if (!documentID) {
      return NextResponse.json({ error: "documentID is required" }, { status: 400 });
    }

    // text プレフィックスでイベント種別を判定（status より信頼性が高い）
    const detectedEventType = detectEventType(text);

    // ============================================
    // メール不達処理（BOUNCED）
    // ============================================
    // CloudSign仕様: メール不達通知のタイミングは以下の3つ
    //   - 確認依頼メール不達 → BOUNCED (status=1 先方確認中)
    //   - 書類転送メール不達 → BOUNCED (status=1 先方確認中)
    //   - 締結完了メール不達 → BOUNCED (status=2 締結済)
    // status=2 の場合、契約自体は締結済みなので、bounce フラグを立てた後に
    // 締結処理（COMPLETED）も続行する必要がある。
    if (detectedEventType === "bounced") {
      const bouncedEmail = extractBouncedEmail(text);
      console.log(
        `[CloudSign Webhook/Bounce] documentID=${documentID}, bouncedEmail=${bouncedEmail}, status=${status}`
      );

      if (!bouncedEmail) {
        // 抽出失敗時もログ記録（フォーマット変更検知用）
        await logAutomationError({
          source: "cloudsign-webhook/bounce",
          message: `CloudSign不達通知からメールアドレス抽出失敗: documentID=${documentID}`,
          detail: { documentID, text, rawStatus: status },
        });
        return NextResponse.json({ ok: true, message: "bounce text format not recognized" });
      }

      // 該当する契約書を検索して、紐づくSlpMemberにフラグを立てる
      const contractForBounce = await prisma.masterContract.findFirst({
        where: { cloudsignDocumentId: documentID },
        select: { id: true, slpMemberId: true },
      });

      // 1. 契約書経由のSlpMember検索（優先）
      let bouncedMember = contractForBounce?.slpMemberId
        ? await prisma.slpMember.findUnique({
            where: { id: contractForBounce.slpMemberId },
          })
        : null;

      // 2. 契約書未リンクの場合、メールアドレスで直接検索（レガシー対応）
      if (!bouncedMember) {
        bouncedMember = await prisma.slpMember.findFirst({
          where: { email: bouncedEmail, deletedAt: null },
        });
      }

      if (bouncedMember) {
        // 冪等性チェック: 既にこのdocumentIdがbouncedとして記録済みならスキップ
        // （CloudSignが同じWebhookを複数回送ってきた場合の重複処理を防ぐ）
        const alreadyBounced = await prisma.slpContractAttempt.findFirst({
          where: {
            slpMemberId: bouncedMember.id,
            documentId: documentID,
            sendResult: "bounced",
          },
          select: { id: true },
        });
        if (alreadyBounced && status !== 2) {
          console.log(
            `[CloudSign Webhook/Bounce] Already processed: documentID=${documentID}, skipping duplicate notifications`
          );
          return NextResponse.json({
            ok: true,
            message: "bounce already processed (idempotent skip)",
            memberId: bouncedMember.id,
          });
        }

        // SlpContractAttemptのsendResultを「bounced」に更新
        await prisma.slpContractAttempt.updateMany({
          where: {
            slpMemberId: bouncedMember.id,
            documentId: documentID,
            sendResult: "delivered",
          },
          data: {
            sendResult: "bounced",
            cloudsignStatus: "pending", // CloudSign上はまだ先方確認中
          },
        });

        // バウンスしたdocumentIdが「最新」かどうかを判定
        // 並行方式で旧契約が遅延バウンス通知された場合、最新契約への影響を避ける
        const isLatestContract =
          bouncedMember.documentId === documentID;

        // 最新契約のバウンスの場合のみ、memberのcloudsign不達フラグを更新
        // （古い契約の遅延バウンスで、新しい契約の状態を上書きしないように）
        if (isLatestContract) {
          const memberUpdateData: Record<string, unknown> = {
            cloudsignBounced: true,
            cloudsignBouncedAt: new Date(),
            cloudsignBouncedEmail: bouncedEmail,
          };
          if (bouncedMember.emailChangeUsed) {
            // メアド変更後の送付がバウンスした → 完全ロック
            memberUpdateData.formLocked = true;
          } else if (bouncedMember.bounceFixUsed) {
            // 不達修正後の再送付もバウンス → 自動送付停止（希望メアド保存のみ可能）
            memberUpdateData.autoSendLocked = true;
          }

          await prisma.slpMember.update({
            where: { id: bouncedMember.id },
            data: memberUpdateData,
          });
        } else {
          console.log(
            `[CloudSign Webhook/Bounce] Not the latest contract, skipping member update: documentID=${documentID}, latest=${bouncedMember.documentId}`
          );
        }

        // 自動化エラー記録（最新契約・旧契約問わず記録。旧契約の場合は別途スタッフ手動対応の必要性を記録）
        await logAutomationError({
          source: "cloudsign-bounce",
          message: isLatestContract
            ? `CloudSignメール送信失敗: ${bouncedMember.name} (${bouncedEmail})`
            : `CloudSignメール送信失敗（旧契約の遅延通知）: ${bouncedMember.name} (${bouncedEmail})`,
          detail: {
            memberId: bouncedMember.id,
            memberName: bouncedMember.name,
            uid: bouncedMember.uid,
            bouncedEmail,
            bouncedAt: new Date().toISOString(),
            documentID,
            isLatestContract,
            rawStatus: status,
            source: "webhook",
            retryAction: isLatestContract ? "slp-resend-cloudsign" : undefined,
          },
        });

        // 契約書メール不達をお客様にLINE通知（最新契約のバウンスのみ、fire-and-forget）
        // Form15統合：テンプレベースで送信、本文はスタッフが設定画面で編集可能
        const bouncedMemberUid = bouncedMember.uid;
        if (isLatestContract && bouncedMemberUid) {
          sendMemberNotification({
            trigger: "contract_bounced",
            memberUid: bouncedMemberUid,
            context: {
              memberName: bouncedMember.name,
              contractSentEmail: bouncedEmail ?? bouncedMember.email ?? undefined,
            },
          })
            .then(async (r) => {
              if (!r.ok) {
                await logAutomationError({
                  source: "cloudsign-webhook-bounced-notify",
                  message: "契約書メール不達のLINE通知送信に失敗しました",
                  detail: {
                    uid: bouncedMemberUid,
                    errorMessage: r.errorMessage,
                    retryAction: "contract-bounced",
                  },
                });
              }
            })
            .catch(async (err) => {
              await logAutomationError({
                source: "cloudsign-webhook-bounced-notify",
                message: "契約書メール不達のLINE通知呼び出しに失敗しました",
                detail: {
                  uid: bouncedMemberUid,
                  error: err instanceof Error ? err.message : String(err),
                  retryAction: "contract-bounced",
                },
              });
            });
        }
      } else {
        // 該当組合員なし → 未照合バウンスとして保存（後でスタッフが照合可能に）
        // 冪等性: 同一documentIdで既存レコードがあればスキップ
        const existingUnmatched = await prisma.slpUnmatchedBounce.findFirst({
          where: { documentId: documentID },
          select: { id: true },
        });
        if (existingUnmatched) {
          console.log(
            `[CloudSign Webhook/Bounce] Unmatched bounce already recorded: documentID=${documentID}`
          );
          return NextResponse.json({
            ok: true,
            message: "unmatched bounce already recorded",
          });
        }
        await prisma.slpUnmatchedBounce.create({
          data: {
            documentId: documentID,
            bouncedEmail,
            webhookText: text,
          },
        });
        await logAutomationError({
          source: "cloudsign-bounce",
          message: `CloudSignメール送信失敗（該当組合員なし）: ${bouncedEmail}`,
          detail: {
            bouncedEmail,
            documentID,
            rawStatus: status,
            source: "webhook",
          },
        });
      }

      // status=1 (確認依頼/転送メール不達) → 契約はまだ締結されていないので、ここで終了
      if (status !== 2) {
        return NextResponse.json({
          ok: true,
          message: "bounce recorded (contract not yet completed)",
          memberId: bouncedMember?.id,
        });
      }

      // status=2 (締結完了メール不達) → 契約は締結済みなので、続けて締結処理を実行する
      console.log(
        `[CloudSign Webhook/Bounce] status=2 → 締結処理も続行 documentID=${documentID}`
      );
    }

    // BOUNCED(status=2) の場合は completed として扱う
    const eventType: CloudSignEventType | null =
      detectedEventType === "bounced" && status === 2 ? "completed" : detectedEventType;

    // ============================================
    // 以下、締結・取消処理
    // ============================================

    // CloudSign Document ID からCRM内の契約書を検索
    const contract = await prisma.masterContract.findFirst({
      where: { cloudsignDocumentId: documentID },
      select: {
        id: true,
        currentStatusId: true,
        cloudsignStatus: true,
        cloudsignTitle: true,
        cloudsignDocumentId: true,
        cloudsignAutoSync: true,
        projectId: true,
        slpMemberId: true,
      },
    });

    if (!contract) {
      // MasterContractに見つからない場合、レガシーSLPメンバーを検索（移行前データ対応）
      const slpHandled = await handleSlpMemberWebhookLegacy(documentID, eventType);
      if (slpHandled) {
        return NextResponse.json({ ok: true, message: "slp member status updated (legacy)" });
      }

      console.log(`[CloudSign Webhook] Contract not found for documentID=${documentID}`);
      return NextResponse.json({ ok: true, message: "contract not found, skipped" });
    }

    // 運営法人情報を1回で取得（破棄者判定 + PDF保存の両方で使用）
    const project = contract.projectId
      ? await prisma.masterProject.findUnique({
          where: { id: contract.projectId },
          include: {
            operatingCompany: {
              select: { cloudsignRegisteredEmail: true, cloudsignClientId: true },
            },
          },
        })
      : null;

    // ステータスマッピング
    let newCloudsignStatus: string | null = null;

    if (eventType === "completed") {
      newCloudsignStatus = "completed";
    } else if (eventType === "canceled") {
      // 破棄者の判定: 運営会社のメールアドレスと一致するか
      const registeredEmail = project?.operatingCompany?.cloudsignRegisteredEmail;
      if (registeredEmail && email && registeredEmail.toLowerCase() === email.toLowerCase()) {
        newCloudsignStatus = "canceled_by_sender";
      } else {
        newCloudsignStatus = "canceled_by_recipient";
      }
    }

    if (!newCloudsignStatus) {
      console.log(
        `[CloudSign Webhook] Unhandled event (status=${status}, text prefix unknown), skipped`
      );
      return NextResponse.json({ ok: true, message: "unhandled event, skipped" });
    }

    // 既に同じステータスなら更新しない
    if (contract.cloudsignStatus === newCloudsignStatus) {
      console.log(`[CloudSign Webhook] Status unchanged (${newCloudsignStatus}), skipped`);
      return NextResponse.json({ ok: true, message: "status unchanged, skipped" });
    }

    // 自動同期OFFの場合: cloudsignStatusのみ更新してCRMステータスは変更しない
    if (!contract.cloudsignAutoSync) {
      await prisma.masterContract.update({
        where: { id: contract.id },
        data: { cloudsignStatus: newCloudsignStatus },
      });
      console.log(
        `[CloudSign Webhook] AutoSync OFF: cloudsignStatus only updated for contract #${contract.id}: ${contract.cloudsignStatus} → ${newCloudsignStatus}`
      );
      return NextResponse.json({ ok: true, message: "cloudsign status updated (auto-sync off)" });
    }

    const clientId = project?.operatingCompany?.cloudsignClientId;

    // 共通ヘルパーでステータス同期
    await syncContractStatus(
      {
        id: contract.id,
        currentStatusId: contract.currentStatusId,
        cloudsignStatus: contract.cloudsignStatus,
        cloudsignTitle: contract.cloudsignTitle,
        cloudsignDocumentId: documentID,
      },
      clientId || null,
      newCloudsignStatus,
      "CloudSign Webhook"
    );

    console.log(
      `[CloudSign Webhook] Updated contract #${contract.id}: ${contract.cloudsignStatus} → ${newCloudsignStatus}`
    );

    // SLPメンバーに紐づく契約書の場合、SlpMemberの旧カラムも同期 + SLP固有処理
    if (contract.slpMemberId) {
      await syncSlpMemberFromContract(contract.slpMemberId, newCloudsignStatus);
    }

    return NextResponse.json({ ok: true, message: "status updated" });
  } catch (error) {
    console.error("[CloudSign Webhook] Error:", error);
    await logAutomationError({
      source: "cloudsign-webhook",
      message: error instanceof Error ? error.message : "不明なエラー",
      detail: { error: String(error) },
    });
    // CloudSign側にリトライさせないため200を返す（内部エラーはログで追跡）
    return NextResponse.json({ ok: false, message: "internal error" });
  }
}

/**
 * MasterContract更新後、紐づくSlpMemberの旧カラムを同期し、SLP固有処理を実行
 */
async function syncSlpMemberFromContract(
  slpMemberId: number,
  newCloudsignStatus: string
): Promise<void> {
  const member = await prisma.slpMember.findUnique({
    where: { id: slpMemberId },
  });
  if (!member || member.deletedAt) return;

  if (newCloudsignStatus === "completed") {
    // 後方互換: SlpMemberのステータスも更新
    await prisma.slpMember.update({
      where: { id: member.id },
      data: {
        status: "組合員契約書締結",
        contractSignedDate: new Date(),
      },
    });
    console.log(
      `[CloudSign Webhook] SLP member #${member.id} (${member.name}) → 組合員契約書締結`
    );

    // 締結されたドキュメントのSlpContractAttemptをcompleted に更新
    const completedContract = await prisma.masterContract.findFirst({
      where: { slpMemberId: member.id, cloudsignStatus: "completed" },
      select: { cloudsignDocumentId: true },
    });
    if (completedContract?.cloudsignDocumentId) {
      await prisma.slpContractAttempt.updateMany({
        where: {
          slpMemberId: member.id,
          documentId: completedContract.cloudsignDocumentId,
        },
        data: { cloudsignStatus: "completed" },
      });
    }

    // 並行方式: 同じ組合員の他の未締結契約書を自動破棄
    const otherPendingContracts = await prisma.masterContract.findMany({
      where: {
        slpMemberId: member.id,
        cloudsignStatus: { in: ["sent"] },
        cloudsignDocumentId: { not: completedContract?.cloudsignDocumentId ?? "" },
      },
      select: { id: true, cloudsignDocumentId: true },
    });
    for (const otherContract of otherPendingContracts) {
      if (!otherContract.cloudsignDocumentId) continue;
      try {
        await declineSlpContract(otherContract.cloudsignDocumentId);
        await prisma.masterContract.update({
          where: { id: otherContract.id },
          data: { cloudsignStatus: "canceled_by_sender" },
        });
        // SlpContractAttemptも更新
        await prisma.slpContractAttempt.updateMany({
          where: {
            slpMemberId: member.id,
            documentId: otherContract.cloudsignDocumentId,
          },
          data: { cloudsignStatus: "canceled", declinedAt: new Date(), declinedBy: "system（自動破棄）" },
        });
        console.log(
          `[CloudSign Webhook] Auto-declined parallel contract: documentId=${otherContract.cloudsignDocumentId}`
        );
      } catch (declineErr) {
        console.error(
          `[CloudSign Webhook] Failed to auto-decline parallel contract: documentId=${otherContract.cloudsignDocumentId}`,
          declineErr
        );
        await logAutomationError({
          source: "cloudsign-webhook/auto-decline",
          message: `旧契約書の自動破棄に失敗しました（組合員: ${member.name}）`,
          detail: {
            memberId: member.id,
            memberName: member.name,
            uid: member.uid,
            failedDocumentId: otherContract.cloudsignDocumentId,
            error: String(declineErr),
            hint: "クラウドサインにログインして手動で破棄してください。",
          },
        });
      }
    }

    // 関連する自動化エラーを解決済みにする
    await resolveRelatedAutomationErrors(member.uid, member.name);

    // Form5: 紹介者に契約締結通知を送信
    // 判定: 現在のfree1（紹介者UID）が form5NotifiedReferrerUid と異なる場合のみ送信
    // - 初回: form5NotifiedReferrerUid が null → 送信
    // - free1 が後から変わった: 別の紹介者 → 送信
    // - free1 が null（LINE未紐付け）: 送信しない（手動ボタンで対応）
    try {
      const lineFriend = await prisma.slpLineFriend.findUnique({
        where: { uid: member.uid },
        select: { free1: true },
      });
      const referrerUid = lineFriend?.free1;

      if (referrerUid && member.form5NotifiedReferrerUid !== referrerUid) {
        const r = await sendReferralNotification({
          trigger: "contract_signed",
          referrerUid,
          context: {
            memberName: member.name,
            memberLineName: member.lineName ?? undefined,
          },
          // SlpMemberは事業者と直接リレーションを持たないためnull
          relatedCompanyRecordId: null,
        });
        if (r.ok && !r.skipped) {
          await prisma.slpMember.update({
            where: { id: member.id },
            data: {
              form5NotifyCount: { increment: 1 },
              form5NotifiedReferrerUid: referrerUid,
            },
          });
          console.log(
            `[CloudSign Webhook] contract_signed notification sent for member #${member.id}, referrer=${referrerUid}`
          );
        } else if (!r.ok) {
          throw new Error(r.errorMessage ?? "契約締結通知失敗");
        }
      }
    } catch (form5Err) {
      console.error(
        `[CloudSign Webhook] contract_signed notification failed for member #${member.id}:`,
        form5Err
      );
      await logAutomationError({
        source: "cloudsign-webhook/contract_signed",
        message: `契約締結通知失敗 (memberId=${member.id})`,
        detail: { memberId: member.id, uid: member.uid, error: String(form5Err) },
      });
    }

    // プロラインのビーコンURLを呼び出し（リッチメニュー切り替え）
    // 成功時に richmenuBeaconCalled=true を立てる
    // LINE未紐付けで失敗した場合は line-friend-webhook で後紐付け時に再実行される
    try {
      const lineFriendExists = await prisma.slpLineFriend.findUnique({
        where: { uid: member.uid },
        select: { id: true },
      });
      if (lineFriendExists) {
        const beaconUrl = `https://autosns.jp/api/call-beacon/xZugEszbhx/${member.uid}`;
        const res = await fetch(beaconUrl);
        console.log(
          `[CloudSign Webhook] ProLine beacon called for uid=${member.uid}, status=${res.status}`
        );
        if (res.ok) {
          await prisma.slpMember.update({
            where: { id: member.id },
            data: { richmenuBeaconCalled: true },
          });
        }
      } else {
        console.log(
          `[CloudSign Webhook] LINE friend not found for uid=${member.uid}, beacon will be called on line-friend-webhook`
        );
      }
    } catch (beaconErr) {
      console.error(
        `[CloudSign Webhook] ProLine beacon failed for uid=${member.uid}:`,
        beaconErr
      );
      await logAutomationError({
        source: "cloudsign-webhook",
        message: `プロラインビーコン呼び出し失敗 (uid=${member.uid})`,
        detail: {
          uid: member.uid,
          memberId: member.id,
          error: String(beaconErr),
          retryAction: "slp-richmenu-beacon",
        },
      });
    }
  } else if (newCloudsignStatus === "canceled_by_sender" || newCloudsignStatus === "canceled_by_recipient") {
    // 後方互換: 破棄
    await prisma.slpMember.update({
      where: { id: member.id },
      data: { status: "契約破棄" },
    });
    console.log(
      `[CloudSign Webhook] SLP member #${member.id} (${member.name}) → 契約破棄`
    );
  }
}

/**
 * レガシー: MasterContractに移行前のSlpMemberデータ用フォールバック
 * SlpMember.documentIdで直接検索して更新
 */
async function handleSlpMemberWebhookLegacy(
  documentID: string,
  eventType: CloudSignEventType | null
): Promise<boolean> {
  const member = await prisma.slpMember.findFirst({
    where: { documentId: documentID, deletedAt: null },
  });

  if (!member) return false;

  const now = new Date();

  if (eventType === "completed") {
    await prisma.slpMember.update({
      where: { id: member.id },
      data: {
        status: "組合員契約書締結",
        contractSignedDate: now,
      },
    });
    console.log(
      `[CloudSign Webhook] SLP member #${member.id} (${member.name}) → 組合員契約書締結 (legacy)`
    );

    // Form5・ビーコン処理
    try {
      const lineFriend = await prisma.slpLineFriend.findUnique({
        where: { uid: member.uid },
        select: { free1: true },
      });
      const referrerUid = lineFriend?.free1;

      if (referrerUid && member.form5NotifiedReferrerUid !== referrerUid) {
        const r = await sendReferralNotification({
          trigger: "contract_signed",
          referrerUid,
          context: {
            memberName: member.name,
            memberLineName: member.lineName ?? undefined,
          },
          relatedCompanyRecordId: null,
        });
        if (r.ok && !r.skipped) {
          await prisma.slpMember.update({
            where: { id: member.id },
            data: {
              form5NotifyCount: { increment: 1 },
              form5NotifiedReferrerUid: referrerUid,
            },
          });
        } else if (!r.ok) {
          throw new Error(r.errorMessage ?? "契約締結通知失敗");
        }
      }
    } catch (form5Err) {
      await logAutomationError({
        source: "cloudsign-webhook/contract_signed",
        message: `契約締結通知失敗 (memberId=${member.id}, legacy)`,
        detail: { memberId: member.id, uid: member.uid, error: String(form5Err) },
      });
    }

    try {
      const lineFriendExists = await prisma.slpLineFriend.findUnique({
        where: { uid: member.uid },
        select: { id: true },
      });
      if (lineFriendExists) {
        const res = await fetch(`https://autosns.jp/api/call-beacon/xZugEszbhx/${member.uid}`);
        if (res.ok) {
          await prisma.slpMember.update({
            where: { id: member.id },
            data: { richmenuBeaconCalled: true },
          });
        }
      }
    } catch (beaconErr) {
      await logAutomationError({
        source: "cloudsign-webhook",
        message: `プロラインビーコン呼び出し失敗 (uid=${member.uid})`,
        detail: {
          uid: member.uid,
          memberId: member.id,
          error: String(beaconErr),
          retryAction: "slp-richmenu-beacon",
        },
      });
    }

    return true;
  }

  if (eventType === "canceled") {
    await prisma.slpMember.update({
      where: { id: member.id },
      data: { status: "契約破棄" },
    });
    console.log(
      `[CloudSign Webhook] SLP member #${member.id} (${member.name}) → 契約破棄 (legacy)`
    );
    return true;
  }

  return false;
}

// GET: ヘルスチェック（Webhook URL疎通確認用）
export async function GET() {
  return NextResponse.json({ ok: true, service: "cloudsign-webhook" });
}
