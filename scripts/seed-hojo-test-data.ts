/**
 * 補助金プロジェクト テストデータ投入用ワンショットスクリプト
 *
 * 対象機能:
 *   - applicant-info / application-support
 *   - grant-customers (pre / post application)
 *   - loan-submissions / loan-progress
 *   - consulting (contract / activity)
 *
 * 各テーブル 12〜15 件投入。テストデータは vendor.name に "[TEST]"
 * プレフィックスを付与し再実行時はスキップする (冪等)。
 *
 * 実行方法 (docker 環境):
 *   docker compose exec app npx ts-node \
 *     --compiler-options '{"module":"CommonJS"}' \
 *     scripts/seed-hojo-test-data.ts
 *
 * もしくは host から:
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm_db" \
 *     npx tsx scripts/seed-hojo-test-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEST_PREFIX = "[TEST]";

const VENDOR_NAMES = [
  "アクメ商事",
  "サンライズ工業",
  "オーシャンテック",
  "ブルースカイ製作所",
  "グリーンリーフ食品",
  "シルバーウィング運輸",
  "ゴールデンベル流通",
  "クリムゾンソフト",
  "ホワイトベア印刷",
  "ブラックパール飲食",
  "クリアウォーター環境",
  "サンセット建材",
  "ノーザンライト広告",
  "イーストフィールド人材",
  "ウェストポート貿易",
];

const APPLICANT_NAMES = [
  "山田太郎",
  "佐藤花子",
  "鈴木一郎",
  "高橋美咲",
  "田中健太",
  "伊藤さくら",
  "渡辺直樹",
  "中村優子",
  "小林洋平",
  "加藤恵子",
  "吉田大輔",
  "松本由香",
  "井上拓也",
  "斎藤美穂",
  "木村翔太",
];

const STAFF_NAMES = ["塩澤", "白石", "島田", "鳥居", "大野"];

const INDUSTRIES = ["製造業", "卸売業", "小売業", "建設業", "情報通信業", "運輸業", "飲食サービス業"];

const APPLICATION_STATUSES = [
  { name: "未着手", displayOrder: 1 },
  { name: "ヒアリング中", displayOrder: 2 },
  { name: "資料準備中", displayOrder: 3 },
  { name: "申請済", displayOrder: 4 },
  { name: "交付決定", displayOrder: 5 },
];

function daysFromNow(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function ensureApplicationStatuses() {
  const count = await prisma.hojoApplicationStatus.count();
  if (count > 0) {
    console.log(`✓ HojoApplicationStatus 既に ${count} 件 — skip`);
    return;
  }
  await prisma.hojoApplicationStatus.createMany({
    data: APPLICATION_STATUSES.map((s) => ({
      name: s.name,
      displayOrder: s.displayOrder,
      isActive: true,
    })),
  });
  console.log(`✓ HojoApplicationStatus を ${APPLICATION_STATUSES.length} 件作成`);
}

async function ensureJoseiLineFriends(count: number) {
  const friends = await prisma.hojoLineFriendJoseiSupport.findMany({
    where: { uid: { startsWith: "test-josei-" } },
    orderBy: { id: "asc" },
  });
  if (friends.length >= count) {
    console.log(`✓ HojoLineFriendJoseiSupport (test) 既に ${friends.length} 件 — skip`);
    return friends.slice(0, count);
  }
  const created: typeof friends = [...friends];
  for (let i = friends.length; i < count; i++) {
    const f = await prisma.hojoLineFriendJoseiSupport.create({
      data: {
        uid: `test-josei-${i + 1}`,
        snsname: `テスト助成金友達${i + 1}`,
        sei: pick(APPLICANT_NAMES, i).slice(0, 2),
        mei: pick(APPLICANT_NAMES, i).slice(2),
        nickname: `テスト${i + 1}`,
        email: `josei-test-${i + 1}@example.com`,
        phone: `090-0000-${String(1000 + i).padStart(4, "0")}`,
        friendAddedDate: daysFromNow(-30 + i),
        activeStatus: "アクティブ",
        free1: pick(VENDOR_NAMES, i),
      },
    });
    created.push(f);
  }
  console.log(`✓ HojoLineFriendJoseiSupport (test) を ${count} 件確保`);
  return created;
}

async function ensureVendors(count: number) {
  const existing = await prisma.hojoVendor.findMany({
    where: { name: { startsWith: TEST_PREFIX } },
    orderBy: { id: "asc" },
  });
  if (existing.length >= count) {
    console.log(`✓ HojoVendor (test) 既に ${existing.length} 件 — skip`);
    return existing.slice(0, count);
  }
  const created = [...existing];
  for (let i = existing.length; i < count; i++) {
    const name = `${TEST_PREFIX} ${pick(VENDOR_NAMES, i)}`;
    const token = `test-vendor-token-${Date.now()}-${i}`;
    const v = await prisma.hojoVendor.create({
      data: {
        name,
        accessToken: token,
        memo: `テスト用ベンダー (${i + 1})`,
        displayOrder: i,
        isActive: true,
        representativeName: pick(APPLICANT_NAMES, i),
        contactPersonName: pick(APPLICANT_NAMES, i + 5),
        email: `vendor-${i + 1}@example.com`,
        phone: `03-0000-${String(1000 + i).padStart(4, "0")}`,
        kickoffMtg: daysFromNow(-60 + i * 2),
        nextContactDate: daysFromNow(7 + (i % 14)),
        consultingContractAmount: 300000 + i * 50000,
        successFee: 50000 + i * 10000,
        loanUsage: i % 3 === 0,
        subsidyConsulting: i % 2 === 0,
        grantApplicationBpo: i % 4 === 0,
      },
    });
    created.push(v);
  }
  console.log(`✓ HojoVendor (test) を ${count} 件確保`);
  return created;
}

async function seedApplicationSupports(
  vendors: { id: number }[],
  joseiFriends: { id: number }[],
  count: number,
) {
  const existing = await prisma.hojoApplicationSupport.count({
    where: { detailMemo: { startsWith: "[TEST]" } },
  });
  if (existing >= count) {
    console.log(`✓ HojoApplicationSupport (test) 既に ${existing} 件 — skip`);
    return;
  }

  const statuses = await prisma.hojoApplicationStatus.findMany({ orderBy: { id: "asc" } });
  const bbsStatuses = await prisma.hojoBbsStatus.findMany({ orderBy: { id: "asc" } });

  for (let i = existing; i < count; i++) {
    const vendor = pick(vendors, i);
    const friend = pick(joseiFriends, i);
    const status = pick(statuses, i);
    const bbs = pick(bbsStatuses, i);
    const subsidyAmount = 500000 + i * 100000;
    await prisma.hojoApplicationSupport.create({
      data: {
        lineFriendId: friend.id,
        vendorId: vendor.id,
        statusId: status.id,
        bbsStatusId: bbs.id,
        applicantName: pick(APPLICANT_NAMES, i),
        detailMemo: `[TEST] 申請ヒアリングメモ #${i + 1}`,
        formAnswerDate: daysFromNow(-50 + i),
        formTranscriptDate: daysFromNow(-45 + i),
        applicationFormDate: daysFromNow(-30 + i),
        subsidyDesiredDate: daysFromNow(60 + i),
        subsidyAmount,
        paymentReceivedDate: i % 2 === 0 ? daysFromNow(-10 + i) : null,
        paymentReceivedAmount: i % 2 === 0 ? subsidyAmount : null,
        bbsTransferAmount: i % 3 === 0 ? Math.floor(subsidyAmount * 0.3) : null,
        bbsTransferDate: i % 3 === 0 ? daysFromNow(-5 + i) : null,
        alkesMemo: `ALKES備考 #${i + 1}`,
        bbsMemo: `BBS備考 #${i + 1}`,
        vendorMemo: `ベンダー備考 #${i + 1}`,
      },
    });
  }
  console.log(`✓ HojoApplicationSupport を ${count - existing} 件作成`);
}

async function seedGrantPreApplications(vendors: { id: number }[], count: number) {
  const existing = await prisma.hojoGrantCustomerPreApplication.count({
    where: { detailMemo: { startsWith: "[TEST]" } },
  });
  if (existing >= count) {
    console.log(`✓ HojoGrantCustomerPreApplication (test) 既に ${existing} 件 — skip`);
    return;
  }
  const supports = await prisma.hojoApplicationSupport.findMany({
    where: { detailMemo: { startsWith: "[TEST]" } },
    orderBy: { id: "asc" },
  });

  for (let i = existing; i < count; i++) {
    const vendor = pick(vendors, i);
    const support = supports[i] ?? null;
    await prisma.hojoGrantCustomerPreApplication.create({
      data: {
        vendorId: vendor.id,
        applicationSupportId: support?.id ?? null,
        applicantName: pick(APPLICANT_NAMES, i),
        referrer: `紹介者${(i % 5) + 1}`,
        salesStaff: pick(STAFF_NAMES, i),
        category: pick(["新規", "リピート", "紹介"], i),
        status: pick(["概要案内予定", "概要案内済", "検討中", "申請決定"], i),
        prospectLevel: pick(["A", "B", "C"], i),
        detailMemo: `[TEST] 概要案内メモ #${i + 1}`,
        nextAction: `次回MTGで${pick(["金額確認", "資料準備", "契約書送付"], i)}`,
        nextContactDate: daysFromNow(3 + (i % 14)),
        overviewBriefingDate: daysFromNow(-20 + i),
        briefingStaff: pick(STAFF_NAMES, i + 1),
        phone: `090-1111-${String(1000 + i).padStart(4, "0")}`,
        businessEntity: i % 2 === 0 ? "法人" : "個人事業主",
        industry: pick(INDUSTRIES, i),
        systemType: pick(["クラウド型", "オンプレ型", "ハイブリッド"], i),
        hasLoan: i % 3 === 0 ? "あり" : "なし",
        revenueRange: pick(["〜1,000万円", "1,000万〜3,000万円", "3,000万〜1億円", "1億円〜"], i),
        referrerRewardPct: 0.05,
        agent1RewardPct: 0.03,
        totalReward: 100000 + i * 10000,
        capital: `${(i + 1) * 100}万円`,
        revenue: 5000000 + i * 1000000,
        empRegular: 5 + (i % 20),
        empContract: i % 5,
        empPartTime: i % 10,
        homepageUrl: `https://example.com/test-${i + 1}`,
      },
    });
  }
  console.log(`✓ HojoGrantCustomerPreApplication を ${count - existing} 件作成`);
}

async function seedGrantPostApplications(vendors: { id: number }[], count: number) {
  const existing = await prisma.hojoGrantCustomerPostApplication.count({
    where: { memo: { startsWith: "[TEST]" } },
  });
  if (existing >= count) {
    console.log(`✓ HojoGrantCustomerPostApplication (test) 既に ${existing} 件 — skip`);
    return;
  }
  const preApps = await prisma.hojoGrantCustomerPreApplication.findMany({
    where: { detailMemo: { startsWith: "[TEST]" } },
    orderBy: { id: "asc" },
  });

  for (let i = existing; i < count; i++) {
    const vendor = pick(vendors, i);
    const pre = preApps[i] ?? null;
    const subsidyTarget = 1000000 + i * 200000;
    await prisma.hojoGrantCustomerPostApplication.create({
      data: {
        vendorId: vendor.id,
        preApplicationId: pre?.id ?? null,
        isBpo: i % 3 === 0,
        applicantName: pick(APPLICANT_NAMES, i),
        memo: `[TEST] 交付申請メモ #${i + 1}`,
        referrer: `紹介者${(i % 5) + 1}`,
        salesStaff: pick(STAFF_NAMES, i),
        applicationCompletedDate: daysFromNow(-40 + i),
        applicationStaff: pick(STAFF_NAMES, i + 2),
        grantApplicationNumber: `IT2025-${String(10000 + i).padStart(6, "0")}`,
        nextAction: pick(
          ["実績報告書作成", "交付申請手続き", "従業員リスト確認", "返金処理"],
          i,
        ),
        nextContactDate: daysFromNow(7 + (i % 14)),
        prefecture: pick(
          ["東京都", "神奈川県", "大阪府", "愛知県", "福岡県", "北海道"],
          i,
        ),
        recruitmentRound: `${(i % 4) + 1}次`,
        applicationType: pick(["通常枠", "セキュリティ枠", "デジタル化基盤導入枠"], i),
        subsidyStatus: pick(
          ["申請中", "交付決定", "実績報告中", "確定", "支払済"],
          i,
        ),
        subsidyVendorName: `IT-${pick(VENDOR_NAMES, i)}`,
        itToolName: pick(
          ["クラウド会計X", "勤怠管理Y", "EC構築Z", "在庫管理α", "顧客管理β"],
          i,
        ),
        subsidyTargetAmount: subsidyTarget,
        subsidyAppliedAmount: Math.floor(subsidyTarget * 0.5),
        grantDecisionAmount: i % 3 === 0 ? Math.floor(subsidyTarget * 0.5) : null,
        grantDecisionDate: i % 3 === 0 ? daysFromNow(-20 + i) : null,
        hasLoan: i % 4 === 0,
        loanAmount: i % 4 === 0 ? Math.floor(subsidyTarget * 0.6) : null,
        loanMtgDate: i % 4 === 0 ? daysFromNow(-15 + i) : null,
        referrerPct: 0.05,
        referrerAmount: 50000 + i * 5000,
        agent1Pct: 0.03,
        agent1Amount: 30000 + i * 3000,
      },
    });
  }
  console.log(`✓ HojoGrantCustomerPostApplication を ${count - existing} 件作成`);
}

async function ensureLoanProgressStatuses() {
  const count = await prisma.hojoLoanProgressStatus.count();
  if (count >= 4) {
    console.log(`✓ HojoLoanProgressStatus 既に ${count} 件 — skip`);
    return;
  }
  await prisma.hojoLoanProgressStatus.createMany({
    data: [
      { name: "融資稟議確認中", displayOrder: 1 },
      { name: "契約書送付前", displayOrder: 2 },
      { name: "契約書返送待ち", displayOrder: 3 },
      { name: "契約完了", displayOrder: 4 },
      { name: "融資実行待ち", displayOrder: 5 },
      { name: "返済待ち", displayOrder: 6 },
      { name: "終了", displayOrder: 7 },
    ],
  });
  console.log(`✓ HojoLoanProgressStatus を補完`);
}

async function seedLoanProgress(vendors: { id: number }[], count: number) {
  const existing = await prisma.hojoLoanProgress.count({
    where: { memo: { startsWith: "[TEST]" } },
  });
  if (existing >= count) {
    console.log(`✓ HojoLoanProgress (test) 既に ${existing} 件 — skip`);
    return;
  }
  const statuses = await prisma.hojoLoanProgressStatus.findMany({ orderBy: { id: "asc" } });

  for (let i = existing; i < count; i++) {
    const vendor = pick(vendors, i);
    const status = pick(statuses, i);
    const isCorp = i % 2 === 0;
    const loanAmount = 1500000 + i * 300000;

    const submission = await prisma.hojoFormSubmission.create({
      data: {
        formType: "loan-application",
        companyName: isCorp ? `${TEST_PREFIX} ${pick(VENDOR_NAMES, i)}` : `${pick(APPLICANT_NAMES, i)} 商店`,
        representName: pick(APPLICANT_NAMES, i),
        email: `loan-${i + 1}@example.com`,
        phone: `03-2222-${String(1000 + i).padStart(4, "0")}`,
        answers: {
          companyName: isCorp ? pick(VENDOR_NAMES, i) : `${pick(APPLICANT_NAMES, i)} 商店`,
          representName: pick(APPLICANT_NAMES, i),
          loanAmount,
          applicantType: isCorp ? "法人" : "個人事業主",
        },
        submittedAt: daysFromNow(-30 + i),
      },
    });

    await prisma.hojoLoanProgress.create({
      data: {
        formSubmissionId: submission.id,
        vendorId: vendor.id,
        companyName: submission.companyName,
        representName: submission.representName,
        loanAmount,
        applicantType: isCorp ? "法人" : "個人事業主",
        statusId: status.id,
        requestDate: daysFromNow(-25 + i),
        toolPurchasePrice: Math.floor(loanAmount * 0.7),
        fundTransferDate: i % 3 === 0 ? daysFromNow(-20 + i) : null,
        loanExecutionDate: i % 3 === 0 ? daysFromNow(-18 + i) : null,
        repaymentDate: i % 5 === 0 ? daysFromNow(-5 + i) : null,
        repaymentAmount: i % 5 === 0 ? Math.floor(loanAmount * 1.05) : null,
        principalAmount: i % 5 === 0 ? loanAmount : null,
        interestAmount: i % 5 === 0 ? Math.floor(loanAmount * 0.05) : null,
        memo: `[TEST] 融資メモ #${i + 1}`,
        memorandum: `覚書 #${i + 1}`,
        funds: i % 2 === 0 ? "自己資金" : "委託金",
        staffMemo: `弊社備考 #${i + 1}`,
      },
    });
  }
  console.log(`✓ HojoLoanProgress を ${count - existing} 件作成`);
}

async function seedConsulting(vendors: { id: number }[], count: number) {
  const existingContracts = await prisma.hojoConsultingContract.count({
    where: { notes: { startsWith: "[TEST]" } },
  });
  if (existingContracts >= count) {
    console.log(`✓ HojoConsultingContract (test) 既に ${existingContracts} 件 — skip`);
  } else {
    for (let i = existingContracts; i < count; i++) {
      const vendor = pick(vendors, i);
      await prisma.hojoConsultingContract.create({
        data: {
          vendorId: vendor.id,
          companyName: `${TEST_PREFIX} ${pick(VENDOR_NAMES, i)}`,
          representativeName: pick(APPLICANT_NAMES, i),
          mainContactName: pick(APPLICANT_NAMES, i + 3),
          customerEmail: `consult-${i + 1}@example.com`,
          customerPhone: `03-3333-${String(1000 + i).padStart(4, "0")}`,
          contractDate: daysFromNow(-90 + i * 3),
          contractPlan: pick(["スタンダード", "プレミアム", "エンタープライズ"], i),
          contractAmount: 300000 + i * 50000,
          serviceType: pick(["補助金支援", "BPO", "コンサル一体型"], i),
          caseStatus: pick(["進行中", "完了", "保留", "成約"], i),
          consultingPlan: pick(["6ヶ月", "12ヶ月", "24ヶ月"], i),
          successFee: 50000 + i * 10000,
          startDate: daysFromNow(-80 + i * 3),
          endDate: daysFromNow(100 + i * 5),
          billingStatus: pick(["請求準備", "請求済", "回収済"], i),
          paymentStatus: pick(["未払い", "一部入金", "完了"], i),
          revenueRecordingDate: daysFromNow(-30 + i),
          grossProfit: 100000 + i * 20000,
          hasScSales: i % 3 === 0,
          hasSubsidyConsulting: true,
          hasBpoSupport: i % 2 === 0,
          notes: `[TEST] コンサル契約メモ #${i + 1}`,
          assignedAs: pick(STAFF_NAMES, i),
          consultingStaff: pick(STAFF_NAMES, i + 1),
        },
      });
    }
    console.log(`✓ HojoConsultingContract を ${count - existingContracts} 件作成`);
  }

  const existingActivities = await prisma.hojoConsultingActivity.count({
    where: { notes: { startsWith: "[TEST]" } },
  });
  if (existingActivities >= count) {
    console.log(`✓ HojoConsultingActivity (test) 既に ${existingActivities} 件 — skip`);
    return;
  }
  const contracts = await prisma.hojoConsultingContract.findMany({
    where: { notes: { startsWith: "[TEST]" } },
    orderBy: { id: "asc" },
  });
  for (let i = existingActivities; i < count; i++) {
    const vendor = pick(vendors, i);
    const contract = contracts[i] ?? null;
    await prisma.hojoConsultingActivity.create({
      data: {
        vendorId: vendor.id,
        contractId: contract?.id ?? null,
        activityDate: daysFromNow(-30 + i * 2),
        contactMethod: pick(["Zoom", "電話", "対面", "メール", "Chatwork"], i),
        vendorIssue: `事業課題サンプル #${i + 1}: 補助金の対象範囲を確認したい`,
        hearingContent: `事業状況をヒアリング (${i + 1})`,
        responseContent: `スキーム説明を実施 (${i + 1})`,
        proposalContent: pick(
          ["IT導入補助金プラン提案", "事業再構築補助金プラン提案", "ものづくり補助金プラン提案"],
          i,
        ),
        vendorNextAction: "見積書の取り寄せ",
        nextDeadline: daysFromNow(7 + (i % 14)),
        vendorTask: `見積書送付 #${i + 1}`,
        vendorTaskDeadline: daysFromNow(10 + (i % 7)),
        vendorTaskPriority: pick(["高", "中", "低"], i),
        vendorTaskCompleted: i % 4 === 0,
        supportTask: `申請書類ドラフト確認 #${i + 1}`,
        supportTaskDeadline: daysFromNow(5 + (i % 10)),
        supportTaskPriority: pick(["高", "中", "低"], i + 1),
        supportTaskCompleted: i % 5 === 0,
        notes: `[TEST] 活動メモ #${i + 1}`,
      },
    });
  }
  console.log(`✓ HojoConsultingActivity を ${count - existingActivities} 件作成`);
}

async function main() {
  console.log("=== 補助金プロジェクト テストデータ投入開始 ===");

  const VENDOR_COUNT = 15;
  const PER_TABLE_COUNT = 15;

  await ensureApplicationStatuses();
  await ensureLoanProgressStatuses();

  const joseiFriends = await ensureJoseiLineFriends(VENDOR_COUNT);
  const vendors = await ensureVendors(VENDOR_COUNT);

  await seedApplicationSupports(vendors, joseiFriends, PER_TABLE_COUNT);
  await seedGrantPreApplications(vendors, PER_TABLE_COUNT);
  await seedGrantPostApplications(vendors, PER_TABLE_COUNT);
  await seedLoanProgress(vendors, PER_TABLE_COUNT);
  await seedConsulting(vendors, PER_TABLE_COUNT);

  console.log("=== 完了 ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
