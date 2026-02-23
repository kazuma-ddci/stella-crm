/**
 * STP/Accounting → 新経理システム データ移行スクリプト
 *
 * 設計書 7.4 に基づき、旧STPテーブルと旧会計テーブルのデータを新経理テーブルに移行する。
 *
 * 使用方法:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-stp-to-accounting.ts [--dry-run]
 *
 * オプション:
 *   --dry-run  実際のデータ書き込みを行わず、移行内容のプレビューのみ表示
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

// ============================================================
// IDマッピング（旧ID → 新ID）
// ============================================================
const revenueToTransactionMap = new Map<number, number>();
const expenseToTransactionMap = new Map<number, number>();
const invoiceToInvoiceGroupMap = new Map<number, number>();
const paymentTxToBankTxMap = new Map<number, number>();
const accountingTxToBankTxMap = new Map<number, number>();

// キャッシュ
const companyToCounterpartyMap = new Map<number, number>(); // MasterStellaCompany.id → Counterparty.id
const bankNameToPaymentMethodMap = new Map<string, number>(); // bankAccountName → PaymentMethod.id

// ============================================================
// 統計
// ============================================================
const stats = {
  counterpartiesCreated: 0,
  expenseCategoriesCreated: 0,
  paymentMethodsCreated: 0,
  revenueRecords: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  expenseRecords: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  invoices: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  invoiceLinks: { total: 0, linked: 0, skipped: 0, errors: 0 },
  paymentTransactions: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  paymentAllocations: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  editLogs: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  accountingTransactions: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  monthlyCloses: { total: 0, migrated: 0, skipped: 0, errors: 0 },
};

// ============================================================
// ランタイム設定（初期化時に解決）
// ============================================================
let SYSTEM_USER_ID = 0;
let DEFAULT_OPERATING_COMPANY_ID = 0;
let STP_PROJECT_ID: number | null = null;
let REVENUE_CATEGORY_ID = 0;
let EXPENSE_CATEGORY_ID = 0;
let DEFAULT_PAYMENT_METHOD_ID = 0;

// ============================================================
// ヘルパー関数
// ============================================================

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function warn(msg: string) {
  console.warn(`[${new Date().toISOString()}] ⚠ ${msg}`);
}

function error(msg: string) {
  console.error(`[${new Date().toISOString()}] ✖ ${msg}`);
}

/** 月の末日を取得 */
function lastDayOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0); // 前月の末日
  d.setHours(23, 59, 59, 999);
  return d;
}

/** 月の初日を取得 */
function firstDayOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 税抜金額を計算 */
function calcTaxExcludedAmount(amount: number, taxAmount: number, taxType: string): number {
  if (taxType === 'tax_included') {
    return amount - taxAmount;
  }
  return amount; // tax_excluded の場合はそのまま
}

/** ステータスマッピング: StpRevenueRecord.status → Transaction.status */
function mapRevenueStatus(status: string, accountingStatus: string): string {
  // accountingStatusが処理済みの場合
  if (accountingStatus === 'journalized') return 'journalized';

  switch (status) {
    case 'pending':
      return 'unconfirmed';
    case 'approved':
      return 'confirmed';
    case 'invoiced':
      return 'awaiting_accounting';
    case 'paid':
      return 'paid';
    case 'overdue':
      return 'confirmed'; // 確認済みだが未払い
    case 'cancelled':
      return 'hidden';
    default:
      return 'unconfirmed';
  }
}

/** ステータスマッピング: StpExpenseRecord.status → Transaction.status */
function mapExpenseStatus(status: string, accountingStatus: string): string {
  if (accountingStatus === 'journalized') return 'journalized';

  switch (status) {
    case 'pending':
      return 'unconfirmed';
    case 'approved':
      return 'confirmed';
    case 'invoiced':
      return 'awaiting_accounting';
    case 'paid':
      return 'paid';
    case 'cancelled':
      return 'hidden';
    default:
      return 'unconfirmed';
  }
}

/** ステータスマッピング: StpInvoice.status → InvoiceGroup.status */
function mapInvoiceStatus(status: string): string {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'finalized':
    case 'generated':
      return 'pdf_created';
    case 'sent':
      return 'sent';
    case 'paid':
      return 'paid';
    case 'partially_paid':
      return 'partially_paid';
    case 'cancelled':
    case 'voided':
      return 'draft'; // 取消済みはdraftに戻す
    default:
      return 'draft';
  }
}

// ============================================================
// Step 0: 前提条件の初期化
// ============================================================
async function initPrerequisites(): Promise<void> {
  log('=== Step 0: 前提条件の初期化 ===');

  // システムユーザーを取得（ID=1 をデフォルトとして使用）
  const systemUser = await prisma.masterStaff.findFirst({
    orderBy: { id: 'asc' },
  });
  if (!systemUser) {
    throw new Error('MasterStaffが1件も存在しません。先にシードを実行してください。');
  }
  SYSTEM_USER_ID = systemUser.id;
  log(`  システムユーザー: ${systemUser.name} (ID: ${SYSTEM_USER_ID})`);

  // OperatingCompanyを取得
  const opCo = await prisma.operatingCompany.findFirst({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });
  if (!opCo) {
    throw new Error('OperatingCompanyが1件も存在しません。先にマスタデータを投入してください。');
  }
  DEFAULT_OPERATING_COMPANY_ID = opCo.id;
  log(`  デフォルト運営法人: ${opCo.companyName} (ID: ${DEFAULT_OPERATING_COMPANY_ID})`);

  // STPプロジェクトを取得
  const stpProject = await prisma.masterProject.findFirst({
    where: { code: 'stp' },
  });
  STP_PROJECT_ID = stpProject?.id ?? null;
  log(`  STPプロジェクト: ${stpProject ? `${stpProject.name} (ID: ${STP_PROJECT_ID})` : '未設定'}`);

  // ExpenseCategory の作成/取得
  REVENUE_CATEGORY_ID = await ensureExpenseCategory('STP売上', 'revenue');
  EXPENSE_CATEGORY_ID = await ensureExpenseCategory('STP経費', 'expense');
  log(`  売上カテゴリ ID: ${REVENUE_CATEGORY_ID}`);
  log(`  経費カテゴリ ID: ${EXPENSE_CATEGORY_ID}`);

  // デフォルトPaymentMethod の作成/取得
  DEFAULT_PAYMENT_METHOD_ID = await ensurePaymentMethod('不明（移行データ）', 'bank_account');
  log(`  デフォルト決済手段 ID: ${DEFAULT_PAYMENT_METHOD_ID}`);

  // 既存Counterpartyをキャッシュ
  const existingCounterparties = await prisma.counterparty.findMany({
    where: { deletedAt: null },
  });
  for (const cp of existingCounterparties) {
    if (cp.companyId) {
      companyToCounterpartyMap.set(cp.companyId, cp.id);
    }
  }
  log(`  既存取引先キャッシュ: ${companyToCounterpartyMap.size}件`);

  // 既存PaymentMethodをキャッシュ
  const existingPaymentMethods = await prisma.paymentMethod.findMany({
    where: { deletedAt: null },
  });
  for (const pm of existingPaymentMethods) {
    bankNameToPaymentMethodMap.set(pm.name, pm.id);
  }
  log(`  既存決済手段キャッシュ: ${bankNameToPaymentMethodMap.size}件`);
}

async function ensureExpenseCategory(name: string, type: string): Promise<number> {
  const existing = await prisma.expenseCategory.findFirst({
    where: { name, deletedAt: null },
  });
  if (existing) return existing.id;

  if (DRY_RUN) {
    log(`  [DRY RUN] ExpenseCategory "${name}" を作成予定`);
    return -1;
  }

  const created = await prisma.expenseCategory.create({
    data: { name, type, createdBy: SYSTEM_USER_ID || 1 },
  });
  stats.expenseCategoriesCreated++;
  return created.id;
}

async function ensurePaymentMethod(name: string, methodType: string): Promise<number> {
  const existing = await prisma.paymentMethod.findFirst({
    where: { name, deletedAt: null },
  });
  if (existing) return existing.id;

  if (DRY_RUN) {
    log(`  [DRY RUN] PaymentMethod "${name}" を作成予定`);
    return -1;
  }

  const created = await prisma.paymentMethod.create({
    data: { name, methodType, createdBy: SYSTEM_USER_ID },
  });
  stats.paymentMethodsCreated++;
  bankNameToPaymentMethodMap.set(name, created.id);
  return created.id;
}

// ============================================================
// Counterparty 解決ヘルパー
// ============================================================

/** MasterStellaCompany.id から Counterparty を取得/作成 */
async function resolveCounterpartyByCompanyId(
  masterCompanyId: number,
  counterpartyType: string = 'customer',
): Promise<number> {
  const cached = companyToCounterpartyMap.get(masterCompanyId);
  if (cached) return cached;

  if (DRY_RUN) {
    return -1;
  }

  // MasterStellaCompanyの名前を取得
  const company = await prisma.masterStellaCompany.findUnique({
    where: { id: masterCompanyId },
    select: { id: true, name: true },
  });

  if (!company) {
    warn(`MasterStellaCompany ID=${masterCompanyId} が見つかりません`);
    return -1;
  }

  const created = await prisma.counterparty.create({
    data: {
      name: company.name,
      companyId: masterCompanyId,
      counterpartyType,
      createdBy: SYSTEM_USER_ID,
    },
  });
  companyToCounterpartyMap.set(masterCompanyId, created.id);
  stats.counterpartiesCreated++;
  return created.id;
}

/** StpCompanyId から Counterparty を解決 */
async function resolveCounterpartyByStpCompanyId(stpCompanyId: number): Promise<number> {
  const stpCompany = await prisma.stpCompany.findUnique({
    where: { id: stpCompanyId },
    select: { companyId: true },
  });

  if (!stpCompany) {
    warn(`StpCompany ID=${stpCompanyId} が見つかりません`);
    return -1;
  }

  return resolveCounterpartyByCompanyId(stpCompany.companyId, 'customer');
}

/** StpAgent.id から Counterparty を解決 */
async function resolveCounterpartyByAgentId(agentId: number): Promise<number> {
  const agent = await prisma.stpAgent.findUnique({
    where: { id: agentId },
    select: { companyId: true },
  });

  if (!agent) {
    warn(`StpAgent ID=${agentId} が見つかりません`);
    return -1;
  }

  return resolveCounterpartyByCompanyId(agent.companyId, 'vendor');
}

/** PaymentMethod を銀行口座名から解決/作成 */
async function resolvePaymentMethodByBankName(bankAccountName: string | null): Promise<number> {
  if (!bankAccountName) return DEFAULT_PAYMENT_METHOD_ID;

  const cached = bankNameToPaymentMethodMap.get(bankAccountName);
  if (cached) return cached;

  if (DRY_RUN) return -1;

  return ensurePaymentMethod(bankAccountName, 'bank_account');
}

// ============================================================
// Step 1: StpRevenueRecord → Transaction
// ============================================================
async function migrateRevenueRecords(tx: Prisma.TransactionClient): Promise<void> {
  log('=== Step 1: StpRevenueRecord → Transaction ===');

  const records = await tx.stpRevenueRecord.findMany({
    include: {
      stpCompany: { select: { companyId: true } },
    },
  });
  stats.revenueRecords.total = records.length;
  log(`  対象: ${records.length}件`);

  for (const rev of records) {
    try {
      const counterpartyId = await resolveCounterpartyByStpCompanyId(rev.stpCompanyId);
      if (counterpartyId === -1 && !DRY_RUN) {
        stats.revenueRecords.errors++;
        error(`  Revenue ID=${rev.id}: Counterparty解決失敗`);
        continue;
      }

      const taxExcludedAmount = calcTaxExcludedAmount(
        rev.expectedAmount,
        rev.taxAmount,
        rev.taxType,
      );

      const periodFrom = firstDayOfMonth(rev.targetMonth);
      const periodTo = lastDayOfMonth(rev.targetMonth);

      const data = {
        counterpartyId,
        expenseCategoryId: REVENUE_CATEGORY_ID,
        projectId: STP_PROJECT_ID,
        type: 'revenue' as const,
        amount: taxExcludedAmount,
        taxAmount: rev.taxAmount,
        taxRate: rev.taxRate,
        taxType: 'tax_excluded' as const,
        periodFrom,
        periodTo,
        paymentDueDate: rev.dueDate,
        status: mapRevenueStatus(rev.status, rev.accountingStatus),
        note: rev.note,
        isAutoGenerated: rev.isAutoGenerated,
        sourceType: 'crm' as const,
        sourceDataChangedAt: rev.sourceDataChangedAt,
        latestCalculatedAmount: rev.latestCalculatedAmount,
        stpRevenueType: rev.revenueType,
        stpCandidateId: rev.candidateId,
        stpContractHistoryId: rev.contractHistoryId,
        confirmedBy: rev.approvedBy,
        confirmedAt: rev.approvedAt,
        createdBy: rev.approvedBy ?? SYSTEM_USER_ID,
        createdAt: rev.createdAt,
        updatedAt: rev.updatedAt,
        deletedAt: rev.deletedAt,
      };

      if (DRY_RUN) {
        log(`  [DRY RUN] Revenue ID=${rev.id} → Transaction: type=revenue, amount=${taxExcludedAmount}, status=${data.status}`);
        stats.revenueRecords.migrated++;
        continue;
      }

      const created = await tx.transaction.create({ data });
      revenueToTransactionMap.set(rev.id, created.id);
      stats.revenueRecords.migrated++;
    } catch (e) {
      stats.revenueRecords.errors++;
      error(`  Revenue ID=${rev.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log(`  結果: 成功=${stats.revenueRecords.migrated}, スキップ=${stats.revenueRecords.skipped}, エラー=${stats.revenueRecords.errors}`);
}

// ============================================================
// Step 2: StpExpenseRecord → Transaction
// ============================================================
async function migrateExpenseRecords(tx: Prisma.TransactionClient): Promise<void> {
  log('=== Step 2: StpExpenseRecord → Transaction ===');

  const records = await tx.stpExpenseRecord.findMany();
  stats.expenseRecords.total = records.length;
  log(`  対象: ${records.length}件`);

  for (const exp of records) {
    try {
      const counterpartyId = await resolveCounterpartyByAgentId(exp.agentId);
      if (counterpartyId === -1 && !DRY_RUN) {
        stats.expenseRecords.errors++;
        error(`  Expense ID=${exp.id}: Counterparty解決失敗`);
        continue;
      }

      const taxExcludedAmount = calcTaxExcludedAmount(
        exp.expectedAmount,
        exp.taxAmount,
        exp.taxType,
      );

      const periodFrom = firstDayOfMonth(exp.targetMonth);
      const periodTo = lastDayOfMonth(exp.targetMonth);

      const data = {
        counterpartyId,
        expenseCategoryId: EXPENSE_CATEGORY_ID,
        projectId: STP_PROJECT_ID,
        type: 'expense' as const,
        amount: taxExcludedAmount,
        taxAmount: exp.taxAmount,
        taxRate: exp.taxRate,
        taxType: 'tax_excluded' as const,
        periodFrom,
        periodTo,
        status: mapExpenseStatus(exp.status, exp.accountingStatus),
        note: exp.note,
        isAutoGenerated: exp.isAutoGenerated,
        sourceType: 'crm' as const,
        sourceDataChangedAt: exp.sourceDataChangedAt,
        latestCalculatedAmount: exp.latestCalculatedAmount,
        stpExpenseType: exp.expenseType,
        stpAgentId: exp.agentId,
        stpContractHistoryId: exp.contractHistoryId,
        isWithholdingTarget: exp.isWithholdingTarget,
        withholdingTaxRate: exp.withholdingTaxRate,
        withholdingTaxAmount: exp.withholdingTaxAmount,
        netPaymentAmount: exp.netPaymentAmount,
        createdBy: SYSTEM_USER_ID,
        createdAt: exp.createdAt,
        updatedAt: exp.updatedAt,
        deletedAt: exp.deletedAt,
      };

      if (DRY_RUN) {
        log(`  [DRY RUN] Expense ID=${exp.id} → Transaction: type=expense, amount=${taxExcludedAmount}, status=${data.status}`);
        stats.expenseRecords.migrated++;
        continue;
      }

      const created = await tx.transaction.create({ data });
      expenseToTransactionMap.set(exp.id, created.id);
      stats.expenseRecords.migrated++;
    } catch (e) {
      stats.expenseRecords.errors++;
      error(`  Expense ID=${exp.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log(`  結果: 成功=${stats.expenseRecords.migrated}, スキップ=${stats.expenseRecords.skipped}, エラー=${stats.expenseRecords.errors}`);
}

// ============================================================
// Step 3: StpInvoice → InvoiceGroup (direction="outgoing" のみ)
// ============================================================
async function migrateInvoices(tx: Prisma.TransactionClient): Promise<void> {
  log('=== Step 3: StpInvoice → InvoiceGroup ===');

  const invoices = await tx.stpInvoice.findMany({
    where: { direction: 'outgoing' },
    include: {
      stpCompany: { select: { companyId: true } },
    },
  });
  stats.invoices.total = invoices.length;
  log(`  対象: ${invoices.length}件 (direction=outgoing のみ)`);

  // direction="incoming" のスキップ数も表示
  const incomingCount = await tx.stpInvoice.count({ where: { direction: 'incoming' } });
  if (incomingCount > 0) {
    log(`  スキップ: ${incomingCount}件 (direction=incoming)`);
    stats.invoices.skipped = incomingCount;
  }

  for (const inv of invoices) {
    try {
      let counterpartyId = -1;
      if (inv.stpCompanyId && inv.stpCompany) {
        counterpartyId = await resolveCounterpartyByCompanyId(
          inv.stpCompany.companyId,
          'customer',
        );
      } else if (inv.agentId) {
        counterpartyId = await resolveCounterpartyByAgentId(inv.agentId);
      }

      if (counterpartyId === -1 && !DRY_RUN) {
        stats.invoices.errors++;
        error(`  Invoice ID=${inv.id}: Counterparty解決失敗 (stpCompanyId=${inv.stpCompanyId}, agentId=${inv.agentId})`);
        continue;
      }

      // 小計を計算
      const totalAmount = inv.totalAmount ?? 0;
      const taxAmount = inv.taxAmount ?? 0;
      const subtotal = totalAmount - taxAmount;

      const data = {
        counterpartyId,
        operatingCompanyId: DEFAULT_OPERATING_COMPANY_ID,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        paymentDueDate: inv.dueDate,
        subtotal: subtotal > 0 ? subtotal : null,
        taxAmount: inv.taxAmount,
        totalAmount: inv.totalAmount,
        pdfPath: inv.filePath,
        pdfFileName: inv.fileName,
        status: mapInvoiceStatus(inv.status),
        createdBy: SYSTEM_USER_ID,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
        deletedAt: inv.deletedAt,
      };

      if (DRY_RUN) {
        log(`  [DRY RUN] Invoice ID=${inv.id} → InvoiceGroup: number=${inv.invoiceNumber}, status=${data.status}`);
        stats.invoices.migrated++;
        continue;
      }

      const created = await tx.invoiceGroup.create({ data });
      invoiceToInvoiceGroupMap.set(inv.id, created.id);
      stats.invoices.migrated++;
    } catch (e) {
      stats.invoices.errors++;
      error(`  Invoice ID=${inv.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log(`  結果: 成功=${stats.invoices.migrated}, スキップ=${stats.invoices.skipped}, エラー=${stats.invoices.errors}`);
}

// ============================================================
// Step 4: StpInvoiceLineItem → Transaction.invoiceGroupId 紐づけ
// ============================================================
async function linkTransactionsToInvoiceGroups(tx: Prisma.TransactionClient): Promise<void> {
  log('=== Step 4: Transaction ↔ InvoiceGroup 紐づけ ===');

  const lineItems = await tx.stpInvoiceLineItem.findMany();
  stats.invoiceLinks.total = lineItems.length;
  log(`  対象: ${lineItems.length}件`);

  for (const li of lineItems) {
    try {
      const newInvoiceGroupId = invoiceToInvoiceGroupMap.get(li.invoiceId);
      if (!newInvoiceGroupId) {
        // outgoing以外のinvoiceは移行していないのでスキップ
        stats.invoiceLinks.skipped++;
        continue;
      }

      // RevenueRecord経由で移行済みTransactionを探す
      let newTransactionId: number | undefined;
      if (li.revenueRecordId) {
        newTransactionId = revenueToTransactionMap.get(li.revenueRecordId);
      }
      // ExpenseRecord経由で移行済みTransactionを探す
      if (!newTransactionId && li.expenseRecordId) {
        newTransactionId = expenseToTransactionMap.get(li.expenseRecordId);
      }

      if (!newTransactionId) {
        stats.invoiceLinks.skipped++;
        continue;
      }

      if (DRY_RUN) {
        log(`  [DRY RUN] LineItem ID=${li.id}: Transaction(${newTransactionId}) → InvoiceGroup(${newInvoiceGroupId})`);
        stats.invoiceLinks.linked++;
        continue;
      }

      await tx.transaction.update({
        where: { id: newTransactionId },
        data: { invoiceGroupId: newInvoiceGroupId },
      });
      stats.invoiceLinks.linked++;
    } catch (e) {
      stats.invoiceLinks.errors++;
      error(`  LineItem ID=${li.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log(`  結果: 紐づけ=${stats.invoiceLinks.linked}, スキップ=${stats.invoiceLinks.skipped}, エラー=${stats.invoiceLinks.errors}`);
}

// ============================================================
// Step 5: StpPaymentTransaction → BankTransaction
// ============================================================
async function migratePaymentTransactions(tx: Prisma.TransactionClient): Promise<void> {
  log('=== Step 5: StpPaymentTransaction → BankTransaction ===');

  const records = await tx.stpPaymentTransaction.findMany();
  stats.paymentTransactions.total = records.length;
  log(`  対象: ${records.length}件`);

  for (const pt of records) {
    try {
      const paymentMethodId = await resolvePaymentMethodByBankName(pt.bankAccountName);

      // counterpartyName からCounterpartyを検索（完全一致）
      let counterpartyId: number | null = null;
      if (pt.counterpartyName) {
        const cp = await prisma.counterparty.findFirst({
          where: { name: pt.counterpartyName, deletedAt: null },
          select: { id: true },
        });
        counterpartyId = cp?.id ?? null;
      }

      const data = {
        transactionDate: pt.transactionDate,
        direction: pt.direction, // "incoming" | "outgoing"
        paymentMethodId,
        counterpartyId,
        amount: pt.amount,
        description: pt.note,
        source: 'legacy' as const,
        createdBy: pt.processedBy ?? SYSTEM_USER_ID,
        createdAt: pt.createdAt,
        updatedAt: pt.updatedAt,
        deletedAt: pt.deletedAt,
      };

      if (DRY_RUN) {
        log(`  [DRY RUN] PaymentTx ID=${pt.id} → BankTransaction: direction=${pt.direction}, amount=${pt.amount}`);
        stats.paymentTransactions.migrated++;
        continue;
      }

      const created = await tx.bankTransaction.create({ data });
      paymentTxToBankTxMap.set(pt.id, created.id);
      stats.paymentTransactions.migrated++;
    } catch (e) {
      stats.paymentTransactions.errors++;
      error(`  PaymentTx ID=${pt.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log(`  結果: 成功=${stats.paymentTransactions.migrated}, スキップ=${stats.paymentTransactions.skipped}, エラー=${stats.paymentTransactions.errors}`);
}

// ============================================================
// Step 6: StpPaymentAllocation → Reconciliation
// ============================================================
async function migratePaymentAllocations(tx: Prisma.TransactionClient): Promise<void> {
  log('=== Step 6: StpPaymentAllocation → Reconciliation ===');

  const allocations = await tx.stpPaymentAllocation.findMany();
  stats.paymentAllocations.total = allocations.length;
  log(`  対象: ${allocations.length}件`);

  for (const alloc of allocations) {
    try {
      const newBankTxId = paymentTxToBankTxMap.get(alloc.paymentTransactionId);
      if (!newBankTxId) {
        stats.paymentAllocations.skipped++;
        continue;
      }

      // 関連するTransactionを特定
      let transactionId: number | undefined;
      if (alloc.revenueRecordId) {
        transactionId = revenueToTransactionMap.get(alloc.revenueRecordId);
      }
      if (!transactionId && alloc.expenseRecordId) {
        transactionId = expenseToTransactionMap.get(alloc.expenseRecordId);
      }

      if (!transactionId) {
        stats.paymentAllocations.skipped++;
        continue;
      }

      if (DRY_RUN) {
        log(`  [DRY RUN] Allocation ID=${alloc.id} → JournalEntry + Reconciliation`);
        stats.paymentAllocations.migrated++;
        continue;
      }

      // 中間JournalEntryを作成（消込の仲介）
      const journalEntry = await tx.journalEntry.create({
        data: {
          transactionId,
          journalDate: alloc.createdAt,
          description: `移行データ: 消込 (旧PaymentAllocation ID=${alloc.id})`,
          isAutoGenerated: true,
          status: 'confirmed',
          createdBy: SYSTEM_USER_ID,
        },
      });

      // Reconciliationを作成
      await tx.reconciliation.create({
        data: {
          journalEntryId: journalEntry.id,
          bankTransactionId: newBankTxId,
          amount: alloc.allocatedAmount,
          performedBy: SYSTEM_USER_ID,
          performedAt: alloc.createdAt,
        },
      });

      stats.paymentAllocations.migrated++;
    } catch (e) {
      stats.paymentAllocations.errors++;
      error(`  Allocation ID=${alloc.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log(`  結果: 成功=${stats.paymentAllocations.migrated}, スキップ=${stats.paymentAllocations.skipped}, エラー=${stats.paymentAllocations.errors}`);
}

// ============================================================
// Step 7: StpFinanceEditLog → ChangeLog
// ============================================================
async function migrateEditLogs(tx: Prisma.TransactionClient): Promise<void> {
  log('=== Step 7: StpFinanceEditLog → ChangeLog ===');

  const logs = await tx.stpFinanceEditLog.findMany();
  stats.editLogs.total = logs.length;
  log(`  対象: ${logs.length}件`);

  for (const editLog of logs) {
    try {
      // テーブル名とレコードIDを決定
      let tableName: string;
      let recordId: number;
      if (editLog.revenueRecordId) {
        tableName = 'StpRevenueRecord';
        recordId = editLog.revenueRecordId;
      } else if (editLog.expenseRecordId) {
        tableName = 'StpExpenseRecord';
        recordId = editLog.expenseRecordId;
      } else {
        stats.editLogs.skipped++;
        continue;
      }

      // 変更種別の決定
      const changeType = editLog.editType === 'field_change' ? 'update' : 'update';

      // JSON差分データの構築
      const oldData: Record<string, unknown> = {};
      const newData: Record<string, unknown> = {};
      if (editLog.fieldName) {
        oldData[editLog.fieldName] = editLog.oldValue;
        newData[editLog.fieldName] = editLog.newValue;
      }
      if (editLog.editType) {
        newData._editType = editLog.editType;
      }
      if (editLog.reason) {
        newData._reason = editLog.reason;
      }

      const data = {
        tableName,
        recordId,
        changeType,
        oldData: oldData as Prisma.InputJsonValue,
        newData: newData as Prisma.InputJsonValue,
        changedBy: editLog.editedBy ?? SYSTEM_USER_ID,
        changedAt: editLog.createdAt,
      };

      if (DRY_RUN) {
        log(`  [DRY RUN] EditLog ID=${editLog.id} → ChangeLog: table=${tableName}, recordId=${recordId}`);
        stats.editLogs.migrated++;
        continue;
      }

      await tx.changeLog.create({ data });
      stats.editLogs.migrated++;
    } catch (e) {
      stats.editLogs.errors++;
      error(`  EditLog ID=${editLog.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log(`  結果: 成功=${stats.editLogs.migrated}, スキップ=${stats.editLogs.skipped}, エラー=${stats.editLogs.errors}`);
}

// ============================================================
// Step 8: AccountingTransaction → BankTransaction (source="legacy")
// ============================================================
async function migrateAccountingTransactions(tx: Prisma.TransactionClient): Promise<void> {
  log('=== Step 8: AccountingTransaction → BankTransaction ===');

  const records = await tx.accountingTransaction.findMany();
  stats.accountingTransactions.total = records.length;
  log(`  対象: ${records.length}件`);

  for (const at of records) {
    try {
      const paymentMethodId = await resolvePaymentMethodByBankName(at.bankAccountName);

      // counterpartyName からCounterpartyを検索
      let counterpartyId: number | null = null;
      if (at.counterpartyName) {
        const cp = await prisma.counterparty.findFirst({
          where: { name: at.counterpartyName, deletedAt: null },
          select: { id: true },
        });
        counterpartyId = cp?.id ?? null;
      }

      const description = [at.description, at.memo].filter(Boolean).join(' / ');

      const data = {
        transactionDate: at.transactionDate,
        direction: at.direction, // "incoming" | "outgoing"
        paymentMethodId,
        counterpartyId,
        amount: at.amount,
        description: description || null,
        source: 'legacy' as const,
        createdBy: SYSTEM_USER_ID,
        createdAt: at.createdAt,
        updatedAt: at.updatedAt,
      };

      if (DRY_RUN) {
        log(`  [DRY RUN] AcctTx ID=${at.id} → BankTransaction: direction=${at.direction}, amount=${at.amount}`);
        stats.accountingTransactions.migrated++;
        continue;
      }

      const created = await tx.bankTransaction.create({ data });
      accountingTxToBankTxMap.set(at.id, created.id);
      stats.accountingTransactions.migrated++;
    } catch (e) {
      stats.accountingTransactions.errors++;
      error(`  AcctTx ID=${at.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log(`  結果: 成功=${stats.accountingTransactions.migrated}, スキップ=${stats.accountingTransactions.skipped}, エラー=${stats.accountingTransactions.errors}`);
}

// ============================================================
// Step 9: AccountingMonthlyClose → MonthlyCloseLog
// ============================================================
async function migrateMonthlyCloses(tx: Prisma.TransactionClient): Promise<void> {
  log('=== Step 9: AccountingMonthlyClose → MonthlyCloseLog ===');

  const records = await tx.accountingMonthlyClose.findMany();
  stats.monthlyCloses.total = records.length;
  log(`  対象: ${records.length}件`);

  for (const mc of records) {
    try {
      // project_closed または accounting_closed → "close" ログを作成
      if (mc.status === 'project_closed' || mc.status === 'accounting_closed') {
        const closePerformedBy = mc.accountingClosedBy ?? mc.projectClosedBy ?? SYSTEM_USER_ID;
        const closePerformedAt = mc.accountingClosedAt ?? mc.projectClosedAt ?? mc.createdAt;

        if (DRY_RUN) {
          log(`  [DRY RUN] MonthlyClose ID=${mc.id} → MonthlyCloseLog: action=close, month=${mc.targetMonth.toISOString().slice(0, 7)}`);
        } else {
          await tx.monthlyCloseLog.create({
            data: {
              projectId: mc.projectId,
              targetMonth: mc.targetMonth,
              action: 'close',
              reason: mc.note,
              performedBy: closePerformedBy,
              performedAt: closePerformedAt,
            },
          });
        }
        stats.monthlyCloses.migrated++;
      }

      // reopened → "reopen" ログを追加作成
      if (mc.reopenedAt && mc.reopenedBy) {
        if (DRY_RUN) {
          log(`  [DRY RUN] MonthlyClose ID=${mc.id} → MonthlyCloseLog: action=reopen`);
        } else {
          await tx.monthlyCloseLog.create({
            data: {
              projectId: mc.projectId,
              targetMonth: mc.targetMonth,
              action: 'reopen',
              reason: mc.reopenReason,
              performedBy: mc.reopenedBy,
              performedAt: mc.reopenedAt,
            },
          });
        }
        stats.monthlyCloses.migrated++;
      }

      // open状態のものはスキップ（クローズされていない）
      if (mc.status === 'open') {
        stats.monthlyCloses.skipped++;
      }
    } catch (e) {
      stats.monthlyCloses.errors++;
      error(`  MonthlyClose ID=${mc.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log(`  結果: 成功=${stats.monthlyCloses.migrated}, スキップ=${stats.monthlyCloses.skipped}, エラー=${stats.monthlyCloses.errors}`);
}

// ============================================================
// サマリー表示
// ============================================================
function printSummary(): void {
  log('');
  log('========================================');
  log(DRY_RUN ? '  移行プレビュー結果（DRY RUN）' : '  移行結果');
  log('========================================');
  log('');

  if (stats.counterpartiesCreated > 0 || stats.expenseCategoriesCreated > 0 || stats.paymentMethodsCreated > 0) {
    log('前提データ作成:');
    if (stats.counterpartiesCreated > 0) log(`  Counterparty:      ${stats.counterpartiesCreated}件 作成`);
    if (stats.expenseCategoriesCreated > 0) log(`  ExpenseCategory:   ${stats.expenseCategoriesCreated}件 作成`);
    if (stats.paymentMethodsCreated > 0) log(`  PaymentMethod:     ${stats.paymentMethodsCreated}件 作成`);
    log('');
  }

  const sections = [
    { name: 'StpRevenueRecord → Transaction', s: stats.revenueRecords, col: 'migrated' },
    { name: 'StpExpenseRecord → Transaction', s: stats.expenseRecords, col: 'migrated' },
    { name: 'StpInvoice → InvoiceGroup', s: stats.invoices, col: 'migrated' },
    { name: 'InvoiceLineItem → 紐づけ', s: stats.invoiceLinks, col: 'linked' },
    { name: 'StpPaymentTx → BankTransaction', s: stats.paymentTransactions, col: 'migrated' },
    { name: 'StpPaymentAlloc → Reconciliation', s: stats.paymentAllocations, col: 'migrated' },
    { name: 'StpFinanceEditLog → ChangeLog', s: stats.editLogs, col: 'migrated' },
    { name: 'AccountingTx → BankTransaction', s: stats.accountingTransactions, col: 'migrated' },
    { name: 'AccountingMonthlyClose → Log', s: stats.monthlyCloses, col: 'migrated' },
  ] as const;

  log('移行結果:');
  log(`${'テーブル'.padEnd(40)} ${'対象'.padStart(6)} ${'成功'.padStart(6)} ${'スキップ'.padStart(8)} ${'エラー'.padStart(6)}`);
  log('-'.repeat(70));
  for (const { name, s, col } of sections) {
    const successCount = col === 'linked' ? (s as typeof stats.invoiceLinks).linked : (s as typeof stats.revenueRecords).migrated;
    log(`${name.padEnd(40)} ${String(s.total).padStart(6)} ${String(successCount).padStart(6)} ${String(s.skipped).padStart(8)} ${String(s.errors).padStart(6)}`);
  }
  log('');

  const totalErrors = [
    stats.revenueRecords,
    stats.expenseRecords,
    stats.invoices,
    stats.invoiceLinks,
    stats.paymentTransactions,
    stats.paymentAllocations,
    stats.editLogs,
    stats.accountingTransactions,
    stats.monthlyCloses,
  ].reduce((sum, s) => sum + s.errors, 0);

  if (totalErrors > 0) {
    warn(`合計 ${totalErrors}件のエラーが発生しました。上記のログを確認してください。`);
  } else {
    log('全ての移行が正常に完了しました。');
  }
}

// ============================================================
// メイン処理
// ============================================================
async function main(): Promise<void> {
  log('========================================');
  log(`  STP/Accounting データ移行スクリプト`);
  log(`  モード: ${DRY_RUN ? 'DRY RUN（プレビュー）' : 'LIVE（実行）'}`);
  log('========================================');
  log('');

  // Step 0: 前提条件（トランザクション外で実行）
  await initPrerequisites();
  log('');

  if (DRY_RUN) {
    // ドライランではトランザクションを使わず順次実行
    // Counterparty作成もスキップされるため、読み取りのみ
    const fakeTx = prisma as unknown as Prisma.TransactionClient;
    await migrateRevenueRecords(fakeTx);
    await migrateExpenseRecords(fakeTx);
    await migrateInvoices(fakeTx);
    await linkTransactionsToInvoiceGroups(fakeTx);
    await migratePaymentTransactions(fakeTx);
    await migratePaymentAllocations(fakeTx);
    await migrateEditLogs(fakeTx);
    await migrateAccountingTransactions(fakeTx);
    await migrateMonthlyCloses(fakeTx);
  } else {
    // 本番実行はトランザクション内で全体をラップ
    await prisma.$transaction(
      async (tx) => {
        await migrateRevenueRecords(tx);
        await migrateExpenseRecords(tx);
        await migrateInvoices(tx);
        await linkTransactionsToInvoiceGroups(tx);
        await migratePaymentTransactions(tx);
        await migratePaymentAllocations(tx);
        await migrateEditLogs(tx);
        await migrateAccountingTransactions(tx);
        await migrateMonthlyCloses(tx);
      },
      {
        maxWait: 60000,
        timeout: 300000, // 5分
      },
    );
  }

  printSummary();
}

main()
  .catch((e) => {
    error(`移行失敗: ${e instanceof Error ? e.message : String(e)}`);
    if (e instanceof Error && e.stack) {
      console.error(e.stack);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
