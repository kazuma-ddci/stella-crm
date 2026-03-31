import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('password123', 10);

// システム管理者用パスワードハッシュ（bcrypt一方向ハッシュ、復元不可）
const SYSTEM_ADMIN_HASH = '$2b$10$5oyNNVor8xnqPL0O2QMpMOxXrO.dXO6Q5Mxt9yj04lsBnxt5G81Z.';
const SYSTEM_TEST_HASH = '$2b$10$BhWcBuEJ4k1I0Iq0jbDbJOlK8UrZ.YuZ5TCfoJpF/eYWeeiFi/vU6';
const STELLA001_HASH = '$2b$10$1f0KgxORLo8aJzsCECaBveCTt.bfgLNNFd1L6jiwZo8FKuFfVvYam';

// ============================================
// ヘルパー関数
// ============================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// 拠点・担当者のID計算（企業IDから）
// 企業1-30: 3件ずつ、31-70: 2件ずつ、71-100: 1件ずつ = 計200件
function primaryLocationId(companyId: number): number {
  if (companyId <= 30) return (companyId - 1) * 3 + 1;
  if (companyId <= 70) return 90 + (companyId - 31) * 2 + 1;
  return 170 + (companyId - 71) + 1;
}
function primaryContactId(companyId: number): number {
  return primaryLocationId(companyId); // 同じ分布
}

// ============================================
// データベースクリア（TRUNCATE CASCADE）
// ============================================

async function clearDatabase() {
  console.log('Clearing existing data...');

  // 全テーブルを一括TRUNCATE（FK依存を自動解決）
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename != '_prisma_migrations'
  `;

  if (tables.length > 0) {
    const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
  }

  console.log('Data cleared.');
}

// ============================================
// シーケンスリセット
// ============================================

async function resetSequences() {
  const tables = [
    'contact_categories', 'stp_stages', 'contact_methods', 'stp_lead_sources',
    'staff_role_types', 'master_staff', 'staff_permissions', 'staff_role_assignments',
    'staff_project_assignments', 'master_projects', 'master_contract_statuses',
    'display_views', 'customer_types', 'master_stella_companies',
    'stella_company_locations', 'stella_company_contacts',
    'stp_agents', 'stp_agent_staff', 'stp_agent_contracts',
    'stp_companies', 'stp_company_contracts',
    'contact_histories', 'contact_history_roles', 'contact_history_files',
    'stp_stage_histories', 'stp_contract_histories',
    'master_contracts', 'master_contract_status_histories',
    'registration_tokens', 'registration_token_default_views',
    'external_users', 'external_user_display_permissions',
    'email_verification_tokens', 'password_reset_tokens', 'login_histories',
    'stp_lead_form_tokens', 'stp_lead_form_submissions',
    'stp_proposals', 'short_urls',
    'stp_kpi_sheets', 'stp_kpi_weekly_data', 'stp_kpi_share_links',
    'stp_agent_contract_histories', 'stp_agent_commission_overrides',
    'stp_candidates', 'stp_revenue_records', 'stp_expense_records', 'stp_invoices',
    'staff_field_restrictions',
    'CostCenter', 'ExpenseCategory', 'Counterparty',
    'kpi_monthly_targets',
    'field_change_logs',
    'slp_stages',
  ];
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM "${table}"), false)`
      );
    } catch { /* テーブルにシーケンスがない場合は無視 */ }
  }
}

// ============================================
// メイン
// ============================================

async function main() {
  console.log('=== Starting comprehensive seed (2026-01~) ===\n');
  await clearDatabase();

  // ============================================
  // 1. マスタデータ
  // ============================================

  // 商談ステージ
  await prisma.stpStage.createMany({
    data: [
      { id: 1, name: 'リード', displayOrder: 1, stageType: 'progress' },
      { id: 2, name: '商談化', displayOrder: 2, stageType: 'progress' },
      { id: 3, name: '提案中', displayOrder: 3, stageType: 'progress' },
      { id: 4, name: '口頭契約', displayOrder: 4, stageType: 'progress' },
      { id: 5, name: '契約締結', displayOrder: 5, stageType: 'progress' },
      { id: 6, name: '失注', stageType: 'closed_lost' },
      { id: 7, name: '検討中', stageType: 'pending' },
      { id: 8, name: 'キックオフ', displayOrder: 6, stageType: 'progress' },
      { id: 9, name: '運用準備', displayOrder: 7, stageType: 'progress' },
      { id: 10, name: '運用中', displayOrder: 8, stageType: 'closed_won' },
      { id: 11, name: '解約', stageType: 'closed_lost' },
    ],
  });
  console.log('✓ Stages (11)');

  // SLPパイプラインステージ
  await prisma.slpStage.createMany({
    data: [
      { id: 1, name: 'リード', stageNumber: 1 },
      { id: 2, name: '概要説明予約', stageNumber: 2 },
      { id: 3, name: '概要説明完了', stageNumber: 3 },
      { id: 4, name: '契約送付', stageNumber: 4 },
      { id: 5, name: '契約締結', stageNumber: 5 },
      { id: 6, name: '書類回収中', stageNumber: 6 },
      { id: 7, name: '書類回収完了', stageNumber: 7 },
      { id: 8, name: 'AI計算中', stageNumber: 8 },
      { id: 9, name: '申請準備', stageNumber: 9 },
      { id: 10, name: '申請済', stageNumber: 10 },
      { id: 11, name: '還付待ち', stageNumber: 11 },
      { id: 12, name: '還付完了', stageNumber: 12 },
      { id: 13, name: '入金待ち', stageNumber: 13 },
      { id: 14, name: '入金完了', stageNumber: 14 },
    ],
  });
  console.log('✓ SLP Stages (14)');

  // 接触方法
  await prisma.contactMethod.createMany({
    data: [
      { id: 1, name: '電話', displayOrder: 1 },
      { id: 2, name: 'メール', displayOrder: 2 },
      { id: 3, name: '訪問', displayOrder: 3 },
      { id: 4, name: 'Web会議', displayOrder: 4 },
      { id: 5, name: 'その他', displayOrder: 5 },
    ],
  });
  console.log('✓ Contact methods (5)');

  // プロジェクト
  await prisma.masterProject.createMany({
    data: [
      { id: 1, code: 'stp', name: 'STP', description: '採用支援サービスの商談・契約管理', displayOrder: 2 },
      { id: 2, code: 'srd', name: 'SRD', description: 'システム受託開発プロジェクト管理', displayOrder: 3 },
      { id: 3, code: 'slp', name: '公的制度教育推進協会', description: '公的制度教育推進協会', displayOrder: 4 },
      { id: 4, code: 'stella', name: 'Stella', description: '全顧客マスタ管理', displayOrder: 0 },
      { id: 5, code: 'common', name: '共通', description: '企業マスタ・スタッフ管理等の共通機能', displayOrder: 1, isActive: false },
      { id: 6, code: 'accounting', name: '経理', description: '経理・会計管理', displayOrder: 5 },
      { id: 7, code: 'hojo', name: '補助金', description: '補助金申請・LINE友達管理・セキュリティクラウド', displayOrder: 6 },
    ],
  });
  console.log('✓ Projects (7)');

  // 経費部門
  await prisma.costCenter.createMany({
    data: [
      { id: 1, name: 'STP事業', projectId: 1, isActive: true },
      { id: 2, name: '管理部門', projectId: null, isActive: true },
    ],
  });
  console.log('✓ CostCenters (2)');

  // 費目
  await prisma.expenseCategory.createMany({
    data: [
      { id: 1, name: '初期費用売上', type: 'revenue', projectId: 1, displayOrder: 1 },
      { id: 2, name: '月額売上', type: 'revenue', projectId: 1, displayOrder: 2 },
      { id: 3, name: '成果報酬売上', type: 'revenue', projectId: 1, displayOrder: 3 },
      { id: 4, name: '外注費', type: 'expense', projectId: 1, displayOrder: 4 },
      { id: 5, name: '通信費', type: 'expense', projectId: 1, displayOrder: 5 },
      { id: 6, name: '家賃', type: 'expense', projectId: 1, displayOrder: 6 },
      { id: 7, name: 'その他売上', type: 'revenue', projectId: 1, displayOrder: 7 },
      { id: 8, name: 'その他経費', type: 'expense', projectId: 1, displayOrder: 8 },
    ],
  });
  console.log('✓ ExpenseCategories (8)');

  // 接触種別
  await prisma.contactCategory.createMany({
    data: [
      { id: 1, projectId: 1, name: '商談', displayOrder: 1 },
      { id: 2, projectId: 1, name: 'キックオフ', displayOrder: 2 },
      { id: 3, projectId: 1, name: '定例MTG', displayOrder: 3 },
      { id: 4, projectId: 1, name: 'その他', displayOrder: 4 },
    ],
  });
  console.log('✓ Contact categories (4)');

  // 流入経路
  await prisma.stpLeadSource.createMany({
    data: [
      { id: 1, name: '紹介', displayOrder: 1 },
      { id: 2, name: 'Web問い合わせ', displayOrder: 2 },
      { id: 3, name: 'テレアポ', displayOrder: 3 },
      { id: 4, name: '展示会', displayOrder: 4 },
      { id: 5, name: 'セミナー', displayOrder: 5 },
      { id: 6, name: '代理店', displayOrder: 6 },
    ],
  });
  console.log('✓ Lead sources (6)');

  // 契約書ステータスマスタ
  await prisma.masterContractStatus.createMany({
    data: [
      { id: 1, name: '雛形作成中', displayOrder: 1, isTerminal: false },
      { id: 2, name: '内容確認中', displayOrder: 2, isTerminal: false },
      { id: 3, name: '合意待ち', displayOrder: 3, isTerminal: false },
      { id: 4, name: '修正対応中', displayOrder: 4, isTerminal: false },
      { id: 5, name: '送付情報確認中', displayOrder: 5, isTerminal: false },
      { id: 6, name: '送付済み', displayOrder: 6, isTerminal: false },
      { id: 7, name: '締結済み', displayOrder: 7, isTerminal: true },
      { id: 8, name: '破棄', displayOrder: 8, isTerminal: true },
    ],
  });
  console.log('✓ Contract statuses (8)');

  // 表示ビュー
  await prisma.displayView.createMany({
    data: [
      { id: 1, viewKey: 'stp_client', viewName: '採用ブースト（企業版）', projectId: 1, description: '' },
      { id: 2, viewKey: 'stp_agent', viewName: '採用ブースト（代理店版）', projectId: 1, description: '' },
      { id: 3, viewKey: 'srd_agent', viewName: '開発（紹介者版）', projectId: 2, description: '紹介者向け開発データ閲覧画面' },
    ],
  });
  console.log('✓ Display views (3)');

  // 顧客種別マスタ
  await prisma.customerType.createMany({
    data: [
      { id: 1, projectId: 1, name: '企業', displayOrder: 1 },
      { id: 2, projectId: 1, name: '代理店', displayOrder: 2 },
      { id: 3, projectId: 2, name: 'クライアント', displayOrder: 1 },
      { id: 4, projectId: 2, name: 'パートナー', displayOrder: 2 },
      { id: 5, projectId: 2, name: '紹介元', displayOrder: 3 },
      { id: 6, projectId: 3, name: '財団', displayOrder: 1 },
      { id: 7, projectId: 3, name: '企業', displayOrder: 2 },
      { id: 8, projectId: 3, name: '自治体', displayOrder: 3 },
    ],
  });
  console.log('✓ Customer types (8)');

  // ============================================
  // 2. スタッフ (13名)
  // ============================================

  await prisma.masterStaff.createMany({
    data: [
      { id: 1, name: '田中太郎', nameKana: 'タナカタロウ', email: 'tanaka@example.com', phone: '090-1111-1111', contractType: '正社員', loginId: 'tanaka', passwordHash: DEFAULT_PASSWORD_HASH, displayOrder: 1 },
      { id: 2, name: '鈴木花子', nameKana: 'スズキハナコ', email: 'suzuki@example.com', phone: '090-2222-2222', contractType: '正社員', loginId: 'suzuki', passwordHash: DEFAULT_PASSWORD_HASH, displayOrder: 2 },
      { id: 3, name: '山本次郎', nameKana: 'ヤマモトジロウ', email: 'yamamoto@example.com', phone: '090-3333-3333', contractType: '業務委託', loginId: 'yamamoto', passwordHash: DEFAULT_PASSWORD_HASH, displayOrder: 3 },
      { id: 4, name: '佐藤美咲', nameKana: 'サトウミサキ', email: 'sato@example.com', phone: '090-4444-4444', contractType: '正社員', loginId: 'sato', passwordHash: DEFAULT_PASSWORD_HASH, displayOrder: 4 },
      { id: 5, name: '伊藤健一', nameKana: 'イトウケンイチ', email: 'ito@example.com', phone: '090-5555-5555', contractType: '正社員', loginId: 'ito', passwordHash: DEFAULT_PASSWORD_HASH, displayOrder: 5 },
      { id: 6, name: '渡辺優子', nameKana: 'ワタナベユウコ', email: 'watanabe@example.com', phone: '090-6666-6666', contractType: '正社員', loginId: 'watanabe', passwordHash: DEFAULT_PASSWORD_HASH, displayOrder: 6 },
      { id: 7, name: '高橋大輔', nameKana: 'タカハシダイスケ', email: 'takahashi@example.com', phone: '090-7777-7777', contractType: '正社員', loginId: 'takahashi', passwordHash: DEFAULT_PASSWORD_HASH, displayOrder: 7 },
      { id: 8, name: '小林理恵', nameKana: 'コバヤシリエ', email: 'kobayashi@example.com', phone: '090-8888-8888', contractType: '業務委託', loginId: 'kobayashi', passwordHash: DEFAULT_PASSWORD_HASH, displayOrder: 8 },
      { id: 9, name: '加藤誠', nameKana: 'カトウマコト', email: 'kato@example.com', phone: '090-9999-9999', contractType: '正社員', loginId: 'kato', passwordHash: DEFAULT_PASSWORD_HASH, displayOrder: 9 },
      { id: 10, name: '管理者', nameKana: 'カンリシャ', email: 'admin@example.com', phone: '090-0000-0000', contractType: '正社員', loginId: 'kanrisha', passwordHash: DEFAULT_PASSWORD_HASH, displayOrder: 10, organizationRole: 'founder' },
      { id: 11, name: 'システム管理者', nameKana: 'システムカンリシャ', email: 'sysadmin@stella-crm.local', phone: null, contractType: '正社員', loginId: 'admin', passwordHash: SYSTEM_ADMIN_HASH, isSystemUser: true },
      { id: 12, name: 'テストユーザー', nameKana: 'テストユーザー', email: 'testuser@stella-crm.local', phone: null, contractType: '正社員', loginId: 'test_user', passwordHash: SYSTEM_TEST_HASH, isSystemUser: true, organizationRole: 'founder' },
      { id: 13, name: '固定データ管理者', nameKana: 'コテイデータカンリシャ', email: 'stella001@stella-crm.local', phone: null, contractType: '正社員', loginId: 'stella001', passwordHash: STELLA001_HASH, canEditMasterData: true, isSystemUser: true },
    ],
  });
  console.log('✓ Staff (13)');

  // スタッフ権限
  await prisma.staffPermission.createMany({
    data: [
      { staffId: 1, projectId: 1, permissionLevel: 'edit' },
      { staffId: 1, projectId: 2, permissionLevel: 'view' },
      { staffId: 2, projectId: 1, permissionLevel: 'edit' },
      { staffId: 3, projectId: 1, permissionLevel: 'view' },
      { staffId: 3, projectId: 2, permissionLevel: 'edit' },
      { staffId: 4, projectId: 1, permissionLevel: 'edit' },
      { staffId: 4, projectId: 3, permissionLevel: 'view' },
      { staffId: 5, projectId: 1, permissionLevel: 'edit' },
      { staffId: 5, projectId: 2, permissionLevel: 'edit' },
      { staffId: 6, projectId: 1, permissionLevel: 'view' },
      { staffId: 6, projectId: 3, permissionLevel: 'edit' },
      { staffId: 7, projectId: 1, permissionLevel: 'edit' },
      { staffId: 8, projectId: 2, permissionLevel: 'edit' },
      { staffId: 8, projectId: 3, permissionLevel: 'view' },
      { staffId: 9, projectId: 1, permissionLevel: 'edit' },
      // 管理者（founder）
      { staffId: 10, projectId: 4, permissionLevel: 'manager' },
      { staffId: 10, projectId: 1, permissionLevel: 'manager' },
      { staffId: 10, projectId: 2, permissionLevel: 'manager' },
      { staffId: 10, projectId: 3, permissionLevel: 'manager' },
      { staffId: 10, projectId: 6, permissionLevel: 'manager' },
      { staffId: 10, projectId: 7, permissionLevel: 'manager' },
      // システム管理者（admin）
      { staffId: 11, projectId: 4, permissionLevel: 'manager' },
      { staffId: 11, projectId: 1, permissionLevel: 'manager' },
      { staffId: 11, projectId: 2, permissionLevel: 'manager' },
      { staffId: 11, projectId: 3, permissionLevel: 'manager' },
      { staffId: 11, projectId: 6, permissionLevel: 'manager' },
      { staffId: 11, projectId: 7, permissionLevel: 'manager' },
      // テストユーザー（founder）
      { staffId: 12, projectId: 4, permissionLevel: 'manager' },
      { staffId: 12, projectId: 1, permissionLevel: 'manager' },
      { staffId: 12, projectId: 2, permissionLevel: 'manager' },
      { staffId: 12, projectId: 3, permissionLevel: 'manager' },
      { staffId: 12, projectId: 6, permissionLevel: 'manager' },
      { staffId: 12, projectId: 7, permissionLevel: 'manager' },
    ],
  });
  console.log('✓ Staff permissions (33)');

  // スタッフプロジェクト割当
  const staffProjectData: { staffId: number; projectId: number }[] = [];
  for (let s = 1; s <= 12; s++) staffProjectData.push({ staffId: s, projectId: 1 });
  for (const s of [1, 3, 5, 8, 10, 11, 12]) staffProjectData.push({ staffId: s, projectId: 2 });
  for (const s of [1, 4, 6, 8, 10, 11, 12]) staffProjectData.push({ staffId: s, projectId: 3 });
  await prisma.staffProjectAssignment.createMany({ data: staffProjectData });
  console.log('✓ Staff project assignments');

  // ============================================
  // 3. 全顧客マスタ (100社)
  // ============================================

  const industries = ['IT・通信', '製造業', '商社', '医療機器', '外食', 'エネルギー', '金融', 'デザイン', '人材サービス', '不動産', '建設', '物流', '小売', '教育', 'コンサルティング'];
  const revenueScales = ['10億未満', '10億〜50億', '50億〜100億', '100億以上'];
  const companyNames = [
    '株式会社テックソリューション', '山田製造株式会社', 'グローバルトレード株式会社', 'メディカルケア株式会社',
    'フードサービス株式会社', 'エコエナジー株式会社', 'ファイナンシャルパートナーズ', 'クリエイティブデザイン株式会社',
    '東京システム開発', '大阪物産株式会社', '名古屋建設工業', '福岡トレーディング',
    '北海道フーズ', '札幌IT株式会社', '仙台メディカル', '広島エンジニアリング',
    '京都デザインラボ', '神戸物流センター', '横浜コンサルティング', '千葉不動産',
    'さいたまテック', '川崎製作所', '相模原システムズ', '堺エネルギー',
    '岡山商事', '静岡フーズ', '新潟工業', '浜松テクノロジー',
    '熊本サービス', '鹿児島ホールディングス', '長崎トレード', '金沢IT',
    '富山製造', '高松建設', '松山エージェント', '那覇リゾート',
    'アルファシステムズ', 'ベータコーポレーション', 'ガンマテクノロジー', 'デルタサービス',
    'イプシロンホールディングス', 'ゼータソリューションズ', 'イータコンサルティング', 'シータデザイン',
    'アイオータシステムズ', 'カッパエンタープライズ', 'ラムダテクノロジー', 'ミューコーポレーション',
    'ニューシステムズ', 'クサイサービス', 'オミクロンホールディングス', 'パイテクノロジー',
    'ローシステムズ', 'シグマコーポレーション', 'タウサービス', 'ウプシロンIT',
    'ファイソリューションズ', 'カイコンサルティング', 'プサイテクノロジー', 'オメガシステムズ',
    '日本テクノサービス', '全国物流ネットワーク', 'ユニバーサルデザイン', 'パシフィックトレード',
    'アジアンホールディングス', 'グローバルネットワーク', 'ナショナルサービス', 'インターナショナルIT',
    'ワールドコーポレーション', 'コンチネンタルシステムズ', 'メトロポリタンサービス', 'オーシャンテクノロジー',
    'マウンテンホールディングス', 'リバーサイドシステムズ', 'サンシャインサービス', 'ムーンライトIT',
    'スターシステムズ', 'プラネットコーポレーション', 'ギャラクシーテクノロジー', 'コスモスサービス',
    'ABCエージェント', 'XYZパートナーズ', 'グローバルリクルート', 'ヒューマンリソース',
    'タレントブリッジ', 'リクルートパートナーズ', 'キャリアコネクト', 'ジョブマッチング',
    'エンプロイメントサービス', 'ワークフォース', 'スタッフィングプロ', 'タレントスカウト',
    'リクルートメント360', 'キャリアナビ', 'ジョブファインダー', 'エージェントネクスト',
    'ヒューマンキャピタル', 'ワーカーズネット', 'プロフェッショナルHR', 'タレントパートナーズ',
  ];

  const companyData = [];
  for (let i = 0; i < 100; i++) {
    const id = i + 1;
    companyData.push({
      id,
      companyCode: `SC-${id}`,
      name: companyNames[i],
      websiteUrl: `https://company${id}.co.jp`,
      industry: industries[i % industries.length],
      revenueScale: revenueScales[i % revenueScales.length],
      staffId: Math.random() > 0.3 ? randomInt(1, 10) : null,
      note: `テストデータ${id}。`,
    });
  }
  await prisma.masterStellaCompany.createMany({ data: companyData });
  console.log('✓ Companies (100)');

  // ============================================
  // 4. 企業拠点 (200件)
  // ============================================

  const prefectures = ['東京都', '大阪府', '愛知県', '神奈川県', '福岡県', '北海道', '宮城県', '広島県', '京都府', '兵庫県'];
  const cities = ['千代田区', '中央区', '新宿区', '渋谷区', '港区', '品川区', '梅田', '難波', '栄', '博多'];
  const locationData = [];
  let locId = 0;

  for (let companyId = 1; companyId <= 100; companyId++) {
    const count = companyId <= 30 ? 3 : companyId <= 70 ? 2 : 1;
    for (let j = 0; j < count; j++) {
      locId++;
      const isPrimary = j === 0;
      const locName = isPrimary ? '本社' : ['支社', '営業所', '事業所'][j - 1] || '支店';
      locationData.push({
        id: locId,
        companyId,
        name: locName,
        address: `${randomChoice(prefectures)}${randomChoice(cities)}${randomInt(1, 10)}-${randomInt(1, 20)}-${randomInt(1, 30)}`,
        phone: `0${randomInt(3, 9)}-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`,
        email: `${locName.toLowerCase().replace(/[^\w]/g, '')}@company${companyId}.co.jp`,
        isPrimary,
        note: isPrimary ? '主要拠点' : null,
      });
    }
  }
  await prisma.stellaCompanyLocation.createMany({ data: locationData });
  console.log(`✓ Company locations (${locId})`);

  // ============================================
  // 5. 企業担当者 (200件)
  // ============================================

  const firstNames = ['太郎', '花子', '一郎', '美咲', '健太', '直樹', '恵', '拓也', '由美', '翔'];
  const lastNames = ['山田', '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '中村', '小林', '加藤'];
  const departments = ['人事部', '総務部', '営業部', '経営企画部', '経理部', '開発部', '代表'];
  const contactData = [];
  let ctId = 0;

  for (let companyId = 1; companyId <= 100; companyId++) {
    const count = companyId <= 30 ? 3 : companyId <= 70 ? 2 : 1;
    for (let j = 0; j < count; j++) {
      ctId++;
      const isPrimary = j === 0;
      contactData.push({
        id: ctId,
        companyId,
        name: `${randomChoice(lastNames)}${randomChoice(firstNames)}`,
        email: `contact${ctId}@company${companyId}.co.jp`,
        phone: `090-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`,
        department: randomChoice(departments),
        isPrimary,
        note: isPrimary ? '採用担当責任者' : null,
      });
    }
  }
  await prisma.stellaCompanyContact.createMany({ data: contactData });
  console.log(`✓ Company contacts (${ctId})`);

  // 取引先（Counterparty）
  const allCompanies = await prisma.masterStellaCompany.findMany({
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  });
  const counterpartyData = allCompanies.map((c, i) => ({
    id: i + 1,
    name: c.name,
    companyId: c.id,
    counterpartyType: c.id <= 80 ? 'customer' : 'vendor',
    isActive: true,
  }));
  await prisma.counterparty.createMany({ data: counterpartyData });
  console.log(`✓ Counterparties (${counterpartyData.length})`);

  // ============================================
  // 6. 代理店マスタ (20社: companyId 81-100)
  // ============================================

  const agentData = [];
  for (let i = 0; i < 20; i++) {
    const agentId = i + 1;
    const companyId = 81 + i;
    const isAdvisor = i >= 12 && i <= 15;
    const status = i < 15 ? 'アクティブ' : i < 18 ? '休止' : '解約';
    const contractStatus = i < 8 ? '契約済み' : i < 12 ? '商談済み' : i < 14 ? '契約済み' : i < 16 ? '未商談' : '契約済み';

    agentData.push({
      id: agentId,
      companyId,
      status,
      category1: isAdvisor ? '顧問' : '代理店',
      contractStatus,
      referrerCompanyId: i > 2 && Math.random() > 0.7 ? 81 + randomInt(0, Math.min(i - 1, 19)) : null,
      note: `${isAdvisor ? '顧問' : '代理店'}テストデータ${agentId}。${['IT業界に強い', '医療業界専門', '製造業中心', '関西エリア担当', '全国対応可能'][i % 5]}。`,
      minimumCases: isAdvisor ? randomInt(3, 10) : null,
      monthlyFee: isAdvisor ? randomInt(50, 200) * 1000 : null,
      hearingUrl: status === 'アクティブ' ? `https://form.example.com/hearing/${agentId}` : null,
    });
  }
  await prisma.stpAgent.createMany({ data: agentData });
  console.log('✓ Agents (20)');

  // 代理店スタッフ割当
  const agentStaffData: { agentId: number; staffId: number }[] = [];
  for (let agentId = 1; agentId <= 20; agentId++) {
    const numStaff = randomInt(1, 3);
    const assigned = new Set<number>();
    for (let j = 0; j < numStaff; j++) {
      let staffId: number;
      do { staffId = randomInt(1, 10); } while (assigned.has(staffId));
      assigned.add(staffId);
      agentStaffData.push({ agentId, staffId });
    }
  }
  await prisma.stpAgentStaff.createMany({ data: agentStaffData });
  console.log(`✓ Agent staff assignments (${agentStaffData.length})`);

  // 代理店契約書 (40件)
  const agentContractData = [];
  const agentContractTitles = ['業務委託基本契約書', '秘密保持契約書', '紹介手数料契約書', '代理店契約書', '顧問契約書'];
  for (let i = 1; i <= 40; i++) {
    const agentId = ((i - 1) % 20) + 1;
    const status = randomChoice(['draft', 'pending', 'signed', 'signed', 'signed', 'expired'] as const);
    const isSigned = status === 'signed' || status === 'expired';
    agentContractData.push({
      id: i,
      agentId,
      contractUrl: `https://cloudsign.example.com/contracts/agent-${agentId}-${i}`,
      signedDate: isSigned ? randomDate(new Date('2026-01-01'), new Date('2026-03-04')) : null,
      title: randomChoice(agentContractTitles),
      externalId: isSigned ? `CS-AGENT-${String(i).padStart(3, '0')}` : null,
      externalService: isSigned ? 'cloudsign' : null,
      status,
      note: status === 'pending' ? '署名待ち' : status === 'draft' ? '作成中' : null,
    });
  }
  await prisma.stpAgentContract.createMany({ data: agentContractData });
  console.log('✓ Agent contracts (40)');

  // ============================================
  // 6b. 代理店契約履歴 (30件: 報酬率・手数料条件)
  // ============================================

  const agentContractHistoryData = [];
  let achId = 0;
  for (let agentId = 1; agentId <= 20; agentId++) {
    const numHistories = agentId <= 15 ? 2 : 1;
    for (let h = 0; h < numHistories; h++) {
      achId++;
      const isLatest = h === numHistories - 1;
      const isCurrent = isLatest && agentId <= 15;
      const startDate = h === 0
        ? randomDate(new Date('2026-01-01'), new Date('2026-01-31'))
        : randomDate(new Date('2026-02-01'), new Date('2026-03-01'));
      const endDate = !isLatest
        ? randomDate(new Date('2026-02-01'), new Date('2026-02-28'))
        : agentId > 18 ? randomDate(new Date('2026-02-15'), new Date('2026-03-04')) : null;

      const baseInitialRate = randomInt(10, 20);
      const baseMonthlyRate = randomInt(5, 15);
      const basePerfRate = randomInt(15, 30);
      const monthlyType = randomChoice(['rate', 'fixed'] as const);
      const perfType = randomChoice(['rate', 'fixed'] as const);

      agentContractHistoryData.push({
        id: achId,
        agentId,
        contractStartDate: startDate,
        contractEndDate: endDate,
        status: isCurrent ? '契約済み' : endDate ? '終了' : '契約前',
        initialFee: agentId >= 13 && agentId <= 16 ? randomInt(50, 150) * 1000 : randomInt(0, 3) * 10000,
        monthlyFee: agentId >= 13 && agentId <= 16 ? randomInt(50, 200) * 1000 : randomInt(0, 2) * 10000,
        defaultMpInitialRate: baseInitialRate,
        defaultMpInitialDuration: randomChoice([1, 1, 3]),
        defaultMpMonthlyType: monthlyType,
        defaultMpMonthlyRate: monthlyType === 'rate' ? baseMonthlyRate : null,
        defaultMpMonthlyFixed: monthlyType === 'fixed' ? randomInt(1, 5) * 10000 : null,
        defaultMpMonthlyDuration: randomChoice([3, 6, 6, 12]),
        defaultPpInitialRate: Math.max(baseInitialRate - 5, 5),
        defaultPpInitialDuration: randomChoice([1, 1]),
        defaultPpPerfType: perfType,
        defaultPpPerfRate: perfType === 'rate' ? basePerfRate : null,
        defaultPpPerfFixed: perfType === 'fixed' ? randomInt(3, 10) * 10000 : null,
        defaultPpPerfDuration: randomChoice([1, 3, 6]),
        note: h === 0 && numHistories > 1 ? '旧条件（更新済み）' : null,
      });
    }
  }
  await prisma.stpAgentContractHistory.createMany({ data: agentContractHistoryData });
  console.log(`✓ Agent contract histories (${achId})`);

  // ============================================
  // 7. STP企業 (80社: companyId 1-80)
  //    ステージ分布を部門KPI計算に最適化
  //    ID 1-7: 運用中, 8-12: 運用準備, 13-17: キックオフ
  //    18-25: 契約締結, 26-33: 口頭契約, 34-43: 提案中
  //    44-55: 商談化, 56-70: リード, 71-75: 失注, 76-80: 検討中
  // ============================================

  function getStageId(i: number): number {
    if (i <= 7) return 10;
    if (i <= 12) return 9;
    if (i <= 17) return 8;
    if (i <= 25) return 5;
    if (i <= 33) return 4;
    if (i <= 43) return 3;
    if (i <= 55) return 2;
    if (i <= 70) return 1;
    if (i <= 75) return 6;
    return 7;
  }

  function getLeadDate(i: number): Date {
    // Jan: companies 1-33, Feb: 34-55, Mar: 56-70, 失注/検討中: Jan-Feb
    if (i <= 33) return new Date(2026, 0, 3 + Math.floor((i - 1) * 27 / 33));
    if (i <= 55) return new Date(2026, 1, 1 + Math.floor((i - 34) * 24 / 22));
    if (i <= 70) return new Date(2026, 2, 1 + Math.floor((i - 56) * 3 / 15));
    if (i <= 75) return new Date(2026, 0, 10 + (i - 71) * 10);
    return new Date(2026, 0, 15 + (i - 76) * 8);
  }

  function getLeadValidity(i: number): string | null {
    if (i <= 25) return '有効';
    if (i <= 33) return i % 4 !== 0 ? '有効' : null;
    if (i <= 40) return '有効';
    if (i <= 43) return null;
    if (i <= 51) return '有効';
    if (i <= 55) return null;
    // March leads: specific 8/15 valid
    if (i <= 70) return [56, 57, 59, 61, 62, 64, 66, 67].includes(i) ? '有効' : null;
    return null;
  }

  const forecasts = ['MIN', '落とし', 'MAX', '来月', '辞退'];
  const operationStatuses = ['テスト1', 'テスト2'];
  const industryTypes = ['一般', '派遣'];
  const mediaOptions = ['Airワーク', 'Wantedly', '求人ボックス'];
  const initialFees = [0, 100000, 150000];
  const progressDetails: Record<number, string> = {
    1: 'リード獲得。メール返信待ち。',
    2: '初回商談完了。ニーズヒアリング済み。',
    3: '提案書作成中。来週プレゼン予定。',
    4: '見積提示済み。決裁待ち。',
    5: '受注済み。契約手続き中。',
    6: '失注。競合に決定。',
    7: '検討中。予算調整中。',
    8: 'キックオフ完了。運用準備開始。',
    9: '運用準備中。媒体設定進行中。',
    10: '運用中。月次レポート提出済み。',
  };

  const stpCompanyData = [];
  for (let i = 1; i <= 80; i++) {
    const stageId = getStageId(i);
    const isProgress = [1, 2, 3, 4].includes(stageId);
    const hasTarget = isProgress && Math.random() > 0.3;
    const hasAgent = Math.random() > 0.7;
    const leadDate = getLeadDate(i);

    stpCompanyData.push({
      id: i,
      companyId: i,
      agentId: hasAgent ? randomInt(1, 20) : null,
      currentStageId: stageId,
      nextTargetStageId: hasTarget ? Math.min(stageId + 1, 5) : null,
      nextTargetDate: hasTarget ? randomDate(new Date('2026-03-01'), new Date('2026-05-31')) : null,
      leadAcquiredDate: leadDate,
      leadValidity: getLeadValidity(i),
      meetingDate: stageId >= 2 || [6, 7].includes(stageId) ? randomDate(leadDate, new Date('2026-03-04')) : null,
      firstKoDate: stageId >= 8 ? randomDate(new Date('2026-02-01'), new Date('2026-03-04')) : null,
      jobPostingStartDate: stageId >= 4 && stageId !== 6 && stageId !== 7 ? `2026-0${randomInt(1, 3)}-${String(randomInt(10, 28)).padStart(2, '0')}` : null,
      progressDetail: progressDetails[stageId] || null,
      forecast: isProgress ? randomChoice(forecasts) : null,
      operationStatus: stageId >= 8 && stageId <= 10 ? randomChoice(operationStatuses) : null,
      industryType: randomChoice(industryTypes),
      plannedHires: randomInt(1, 30),
      leadSourceId: randomInt(1, 5),
      media: stageId >= 3 && stageId !== 6 && stageId !== 7 ? randomChoice(mediaOptions) : null,
      initialFee: stageId >= 4 && stageId !== 6 && stageId !== 7 ? randomChoice(initialFees) : null,
      monthlyFee: stageId >= 4 && stageId !== 6 && stageId !== 7 ? randomInt(3, 15) * 10000 : null,
      performanceFee: stageId >= 4 && stageId !== 6 && stageId !== 7 && Math.random() > 0.5 ? randomInt(2, 5) * 10000 : null,
      salesStaffId: randomInt(1, 10),
      operationStaffList: stageId >= 8 && stageId <= 10 ? randomChoice(['indeed', 'indeed,運用2', '運用2']) : null,
      accountId: stageId >= 8 && stageId <= 10 ? `account-${i}` : null,
      accountPass: stageId >= 8 && stageId <= 10 ? `pass${randomInt(1000, 9999)}` : null,
      note: `STP企業テストデータ${i}。`,
      contractNote: stageId >= 5 && stageId !== 6 && stageId !== 7 ? `契約内容メモ${i}` : null,
      lostReason: stageId === 6 ? randomChoice(['競合に決定', '予算不足', '時期尚早', '社内調整不可']) : null,
      pendingReason: stageId === 7 ? randomChoice(['予算調整中', '社内承認待ち', '人員確保待ち']) : null,
      pendingResponseDate: stageId === 7 ? randomDate(new Date('2026-03-15'), new Date('2026-04-30')) : null,
      billingCompanyName: stageId >= 5 && stageId !== 6 && stageId !== 7 ? companyNames[i - 1] : null,
      billingAddress: stageId >= 5 && stageId !== 6 && stageId !== 7 ? `東京都千代田区${randomInt(1, 5)}-${randomInt(1, 10)}` : null,
      paymentTerms: stageId >= 5 && stageId !== 6 && stageId !== 7 ? randomChoice(['月末締め翌月末払い', '月末締め翌々月末払い', '20日締め翌月末払い']) : null,
    });
  }
  // 成果報酬テスト用: 企業61-65に代理店を強制割り当て
  stpCompanyData[60].agentId = 1;
  stpCompanyData[61].agentId = 2;
  stpCompanyData[62].agentId = 3;
  stpCompanyData[63].agentId = 5;
  stpCompanyData[64].agentId = 7;

  await prisma.stpCompany.createMany({ data: stpCompanyData });
  console.log('✓ STP Companies (80)');

  // ============================================
  // STP企業契約書
  // KPI用: 初回signedDateを明示的に管理
  //   1-3: Jan signed, 4-20: Feb signed, 21-23: Mar signed
  //   残り(24-80): ランダム/null
  // ============================================

  // StpCompanyContract は廃止済み（MasterContractに統合）

  // ============================================
  // 7b. 企業別報酬例外 + 求職者
  // ============================================

  const overrideData = [];
  const overrideTargets = [
    { agentId: 1, stpCompanyId: 5, note: '大口顧客のため優遇レート' },
    { agentId: 2, stpCompanyId: 12, note: '長期契約のため特別レート' },
    { agentId: 3, stpCompanyId: 18, note: '初回キャンペーン適用' },
    { agentId: 5, stpCompanyId: 25, note: '複数媒体利用のため割引' },
    { agentId: 7, stpCompanyId: 30, note: 'パートナー契約のため特別条件' },
    { agentId: 8, stpCompanyId: 35, note: '紹介元優待レート' },
    { agentId: 10, stpCompanyId: 40, note: '成果報酬増額' },
    { agentId: 12, stpCompanyId: 50, note: '特別キャンペーン' },
    { agentId: 1, stpCompanyId: 60, note: '上位パートナー優遇' },
    { agentId: 3, stpCompanyId: 70, note: '大量採用案件のため特別条件' },
  ];
  for (let i = 0; i < overrideTargets.length; i++) {
    const target = overrideTargets[i];
    const latestAch = agentContractHistoryData.find(
      (a) => a.agentId === target.agentId && a.contractEndDate === null
    ) || agentContractHistoryData.find(
      (a) => a.agentId === target.agentId
    );
    if (!latestAch) continue;

    overrideData.push({
      id: i + 1,
      agentContractHistoryId: latestAch.id,
      stpCompanyId: target.stpCompanyId,
      mpInitialRate: (latestAch.defaultMpInitialRate ?? 10) + 5,
      mpInitialDuration: null,
      mpMonthlyType: latestAch.defaultMpMonthlyType,
      mpMonthlyRate: latestAch.defaultMpMonthlyType === 'rate'
        ? (latestAch.defaultMpMonthlyRate ?? 10) + 3 : null,
      mpMonthlyFixed: latestAch.defaultMpMonthlyType === 'fixed'
        ? (latestAch.defaultMpMonthlyFixed ?? 30000) + 10000 : null,
      mpMonthlyDuration: null,
      ppInitialRate: (latestAch.defaultPpInitialRate ?? 5) + 3,
      ppInitialDuration: null,
      ppPerfType: latestAch.defaultPpPerfType,
      ppPerfRate: latestAch.defaultPpPerfType === 'rate'
        ? (latestAch.defaultPpPerfRate ?? 20) + 5 : null,
      ppPerfFixed: latestAch.defaultPpPerfType === 'fixed'
        ? (latestAch.defaultPpPerfFixed ?? 50000) + 20000 : null,
      ppPerfDuration: null,
      note: target.note,
    });
  }
  await prisma.stpAgentCommissionOverride.createMany({ data: overrideData });
  console.log(`✓ Agent commission overrides (${overrideData.length})`);

  // 求職者 (20件)
  const candidateLastNames = ['山田', '佐藤', '田中', '鈴木', '高橋', '伊藤', '渡辺', '中村', '小林', '加藤'];
  const candidateFirstNames = ['太郎', '花子', '一郎', '美咲', '健太', '直樹', '恵', '拓也', '由美', '翔'];
  const selectionStatuses = ['書類選考中', '一次面接', '二次面接', '最終面接', '内定', '入社済み', '辞退', '不合格'];
  const candidateIndustryTypes = ['general', 'dispatch'];
  const candidateJobMedias = ['Airワーク', 'Wantedly', '求人ボックス'];

  const perfCandidates = [
    { id: 1, lastName: '山田', firstName: '太郎', stpCompanyId: 61, industryType: 'general' as string | null, jobMedia: 'Airワーク' as string | null, joinDate: new Date('2026-02-15') as Date | null, interviewDate: new Date('2026-01-15') as Date | null, offerDate: new Date('2026-02-01') as Date | null },
    { id: 2, lastName: '佐藤', firstName: '花子', stpCompanyId: 62, industryType: 'dispatch' as string | null, jobMedia: '求人ボックス' as string | null, joinDate: new Date('2026-02-20') as Date | null, interviewDate: new Date('2026-01-20') as Date | null, offerDate: new Date('2026-02-05') as Date | null },
    { id: 3, lastName: '田中', firstName: '一郎', stpCompanyId: 63, industryType: 'general' as string | null, jobMedia: 'Wantedly' as string | null, joinDate: new Date('2026-03-01') as Date | null, interviewDate: new Date('2026-02-01') as Date | null, offerDate: new Date('2026-02-15') as Date | null },
    { id: 4, lastName: '鈴木', firstName: '美咲', stpCompanyId: 64, industryType: 'dispatch' as string | null, jobMedia: 'Airワーク' as string | null, joinDate: new Date('2026-01-25') as Date | null, interviewDate: new Date('2026-01-05') as Date | null, offerDate: new Date('2026-01-15') as Date | null },
    { id: 5, lastName: '高橋', firstName: '健太', stpCompanyId: 65, industryType: 'general' as string | null, jobMedia: '求人ボックス' as string | null, joinDate: new Date('2026-02-10') as Date | null, interviewDate: new Date('2026-01-10') as Date | null, offerDate: new Date('2026-01-25') as Date | null },
  ];

  const candidateData = [];
  for (const pc of perfCandidates) {
    candidateData.push({
      id: pc.id,
      lastName: pc.lastName,
      firstName: pc.firstName,
      interviewDate: pc.interviewDate,
      interviewAttendance: '参加',
      selectionStatus: '入社済み',
      offerDate: pc.offerDate,
      joinDate: pc.joinDate,
      industryType: pc.industryType,
      jobMedia: pc.jobMedia,
      note: '成果報酬テスト用。入社済み。',
      stpCompanyId: pc.stpCompanyId,
    });
  }
  for (let i = 6; i <= 20; i++) {
    const hasInterview = Math.random() > 0.3;
    const hasOffer = hasInterview && Math.random() > 0.5;
    const hasJoin = hasOffer && Math.random() > 0.4;
    const status = hasJoin ? '入社済み' : hasOffer ? '内定' : randomChoice(selectionStatuses);
    candidateData.push({
      id: i,
      lastName: randomChoice(candidateLastNames),
      firstName: randomChoice(candidateFirstNames),
      interviewDate: hasInterview ? randomDate(new Date('2026-01-01'), new Date('2026-03-04')) : null,
      interviewAttendance: hasInterview ? (Math.random() > 0.1 ? '参加' : '不参加') : null,
      selectionStatus: status,
      offerDate: hasOffer ? randomDate(new Date('2026-01-15'), new Date('2026-03-04')) : null,
      joinDate: hasJoin ? randomDate(new Date('2026-02-01'), new Date('2026-03-04')) : null,
      industryType: Math.random() > 0.5 ? randomChoice(candidateIndustryTypes) : null,
      jobMedia: Math.random() > 0.5 ? randomChoice(candidateJobMedias) : null,
      note: hasJoin ? '入社済み。' : hasOffer ? '内定承諾待ち。' : null,
      stpCompanyId: randomInt(61, 70),
    });
  }
  await prisma.stpCandidate.createMany({ data: candidateData });
  console.log('✓ Candidates (20)');

  // ============================================
  // 8. 接触履歴 — KPI計算に最適化
  //    商談(categoryId=1): 初回商談日が各月に分布
  //    キックオフ(categoryId=2): stage8+の企業に初回KO日
  // ============================================

  const meetingMinutes = [
    'ヒアリングを実施。採用課題について詳細確認。', '提案内容について説明。前向きな反応あり。',
    '見積内容について質問あり。回答済み。', '契約条件について調整中。',
    '月次定例ミーティング。進捗共有。', '新規案件について相談。',
    '課題整理を実施。', 'サービス説明を実施。興味を示している。',
  ];
  const noteTemplates = [
    '60分のWeb会議を実施', '15分の電話', '90分の訪問商談', '45分のオンラインミーティング',
    'メールでの確認', '30分の電話会議', '資料送付', 'フォローアップ連絡',
  ];

  const contactHistoryData = [];
  let chId = 0;

  // --- 確定的データ: 初回商談（contactCategoryId=1）---
  // Companies 1-25: first meeting in January
  for (let i = 1; i <= 25; i++) {
    chId++;
    const day = 9 + Math.floor((i - 1) * 20 / 25); // Jan 9 ~ Jan 29
    contactHistoryData.push({
      id: chId,
      companyId: i,
      contactDate: new Date(2026, 0, day),
      contactMethodId: 4,
      contactCategoryId: 1,
      staffId: ((i - 1) % 10) + 1,
      meetingMinutes: 'ヒアリングを実施。採用課題について詳細確認。',
      note: '初回商談',
    });
  }
  // Companies 26-50: first meeting in February
  for (let i = 26; i <= 50; i++) {
    chId++;
    const day = 2 + Math.floor((i - 26) * 25 / 25); // Feb 2 ~ Feb 27
    contactHistoryData.push({
      id: chId,
      companyId: i,
      contactDate: new Date(2026, 1, day),
      contactMethodId: 4,
      contactCategoryId: 1,
      staffId: ((i - 1) % 10) + 1,
      meetingMinutes: '提案内容について説明。前向きな反応あり。',
      note: '初回商談',
    });
  }
  // Companies 51-55: first meeting in March
  for (let i = 51; i <= 55; i++) {
    chId++;
    contactHistoryData.push({
      id: chId,
      companyId: i,
      contactDate: new Date(2026, 2, i - 50), // Mar 1-5
      contactMethodId: 4,
      contactCategoryId: 1,
      staffId: ((i - 1) % 10) + 1,
      meetingMinutes: 'サービス説明を実施。興味を示している。',
      note: '初回商談',
    });
  }
  // 失注/検討中の企業にも商談履歴
  for (const i of [71, 72, 73, 74, 75, 76, 77]) {
    chId++;
    const isJan = i <= 73;
    contactHistoryData.push({
      id: chId,
      companyId: i,
      contactDate: isJan
        ? new Date(2026, 0, 15 + (i - 71) * 5)
        : new Date(2026, 1, 5 + (i - 74) * 5),
      contactMethodId: 4,
      contactCategoryId: 1,
      staffId: ((i - 1) % 10) + 1,
      meetingMinutes: '課題整理を実施。',
      note: '商談実施',
    });
  }

  // --- 確定的データ: 初回キックオフ（contactCategoryId=2）---
  // Companies 1-7: kickoff in Feb (for 運用開始LT計算)
  for (let i = 1; i <= 7; i++) {
    chId++;
    const day = 1 + i * 2; // Feb 3, 5, 7, 9, 11, 13, 15
    contactHistoryData.push({
      id: chId,
      companyId: i,
      contactDate: new Date(2026, 1, day),
      contactMethodId: 3,
      contactCategoryId: 2,
      staffId: ((i - 1) % 10) + 1,
      meetingMinutes: 'キックオフミーティング実施。運用開始に向けた準備計画を策定。',
      note: 'キックオフ実施',
    });
  }
  // Companies 8-12: kickoff in mid-Feb
  for (let i = 8; i <= 12; i++) {
    chId++;
    const day = 15 + (i - 8) * 2; // Feb 15, 17, 19, 21, 23
    contactHistoryData.push({
      id: chId,
      companyId: i,
      contactDate: new Date(2026, 1, day),
      contactMethodId: 3,
      contactCategoryId: 2,
      staffId: ((i - 1) % 10) + 1,
      meetingMinutes: 'キックオフミーティング。媒体選定と求人原稿の方針を確認。',
      note: 'キックオフ実施',
    });
  }
  // Companies 13-17: kickoff in late Feb - early Mar
  for (let i = 13; i <= 17; i++) {
    chId++;
    const offset = i - 13; // 0,1,2,3,4
    const date = offset < 3
      ? new Date(2026, 1, 25 + offset) // Feb 25, 26, 27
      : new Date(2026, 2, offset - 2);  // Mar 1, 2
    contactHistoryData.push({
      id: chId,
      companyId: i,
      contactDate: date,
      contactMethodId: 3,
      contactCategoryId: 2,
      staffId: ((i - 1) % 10) + 1,
      meetingMinutes: 'キックオフ。アカウント発行とテスト運用の計画策定。',
      note: 'キックオフ実施',
    });
  }

  // --- ランダムデータ: 追加の接触履歴 ---
  for (let i = 0; i < 130; i++) {
    chId++;
    const isAgent = Math.random() > 0.7;
    const companyId = isAgent ? randomInt(81, 100) : randomInt(1, 80);
    contactHistoryData.push({
      id: chId,
      companyId,
      contactDate: randomDate(new Date('2026-01-01'), new Date('2026-03-04')),
      contactMethodId: randomInt(1, 5),
      contactCategoryId: randomInt(1, 4),
      staffId: randomInt(1, 10),
      meetingMinutes: Math.random() > 0.3 ? randomChoice(meetingMinutes) : null,
      note: randomChoice(noteTemplates),
    });
  }

  await prisma.contactHistory.createMany({ data: contactHistoryData });
  console.log(`✓ Contact histories (${chId})`);

  // 接触履歴ロール
  const contactHistoryRoleData = [];
  for (let i = 0; i < contactHistoryData.length; i++) {
    const companyId = contactHistoryData[i].companyId;
    const isAgent = companyId >= 81;
    contactHistoryRoleData.push({
      contactHistoryId: contactHistoryData[i].id,
      customerTypeId: isAgent ? 2 : 1,
    });
  }
  await prisma.contactHistoryRole.createMany({ data: contactHistoryRoleData });
  console.log(`✓ Contact history roles (${contactHistoryRoleData.length})`);

  // ============================================
  // 9. ステージ変更履歴 — KPI計算に最適化
  //    運用中への遷移: ID 1-3 → Mar, ID 4-7 → Feb
  // ============================================

  const staffNames = ['田中太郎', '鈴木花子', '山本次郎', '佐藤美咲', '伊藤健一', '渡辺優子', '高橋大輔', '小林理恵', '加藤誠', '管理者'];
  const stageHistoryData = [];
  let shId = 0;

  // 確定的データ: 運用中への遷移（BackOffice 運用開始LT用）
  // Feb transitions (companies 4-7)
  for (const [companyId, day] of [[4, 20], [5, 22], [6, 25], [7, 28]] as const) {
    shId++;
    stageHistoryData.push({
      id: shId,
      stpCompanyId: companyId,
      eventType: 'achieved',
      fromStageId: 9,
      toStageId: 10,
      targetDate: null,
      recordedAt: new Date(2026, 1, day),
      changedBy: randomChoice(staffNames),
      note: '運用開始',
    });
  }
  // Mar transitions (companies 1-3)
  for (const [companyId, day] of [[1, 1], [2, 2], [3, 3]] as const) {
    shId++;
    stageHistoryData.push({
      id: shId,
      stpCompanyId: companyId,
      eventType: 'achieved',
      fromStageId: 9,
      toStageId: 10,
      targetDate: null,
      recordedAt: new Date(2026, 2, day),
      changedBy: randomChoice(staffNames),
      note: '運用開始',
    });
  }

  // ランダムデータ: その他のステージ変更
  const eventTypes = ['commit', 'achieved', 'recommit', 'progress', 'back', 'cancel'];
  for (let i = 0; i < 140; i++) {
    shId++;
    const stpCompanyId = randomInt(1, 80);
    const eventType = randomChoice(eventTypes);
    const fromStageId = randomInt(1, 5);
    let toStageId = fromStageId;
    switch (eventType) {
      case 'progress': case 'achieved': toStageId = Math.min(fromStageId + 1, 5); break;
      case 'back': toStageId = Math.max(fromStageId - 1, 1); break;
      case 'commit': case 'recommit': toStageId = Math.min(fromStageId + randomInt(1, 2), 5); break;
    }
    stageHistoryData.push({
      id: shId,
      stpCompanyId,
      eventType,
      fromStageId: eventType !== 'commit' ? fromStageId : null,
      toStageId,
      targetDate: ['commit', 'recommit'].includes(eventType) ? randomDate(new Date('2026-03-01'), new Date('2026-05-31')) : null,
      recordedAt: randomDate(new Date('2026-01-01'), new Date('2026-03-04')),
      changedBy: randomChoice(staffNames),
      note: eventType === 'back' ? '戦略見直しのため' : eventType === 'achieved' ? '目標達成' : null,
    });
  }
  await prisma.stpStageHistory.createMany({ data: stageHistoryData });
  console.log(`✓ Stage histories (${shId})`);

  // ============================================
  // 10. 契約履歴 (100件)
  // ============================================

  const jobMediaOptions = ['Airワーク', 'Wantedly', '求人ボックス'];
  const contractHistoryData = [];
  for (let i = 1; i <= 100; i++) {
    const companyId = randomInt(1, 80);
    const startDate = randomDate(new Date('2026-01-01'), new Date('2026-03-01'));
    const isActive = Math.random() > 0.3;
    contractHistoryData.push({
      id: i,
      companyId,
      industryType: randomChoice(['general', 'dispatch']),
      contractPlan: randomChoice(['monthly', 'performance']),
      jobMedia: randomChoice(jobMediaOptions),
      contractStartDate: startDate,
      contractEndDate: isActive ? null : randomDate(startDate, new Date('2026-03-04')),
      initialFee: randomChoice(initialFees),
      monthlyFee: randomInt(3, 15) * 10000,
      performanceFee: Math.random() > 0.5 ? randomInt(2, 5) * 10000 : 0,
      salesStaffId: randomInt(1, 10),
      operationStaffId: randomInt(1, 10),
      status: isActive ? 'active' : randomChoice(['active', 'cancelled', 'dormant']),
      note: `契約履歴テストデータ${i}`,
      operationStatus: randomChoice([...operationStatuses, null]),
      accountId: `acc-${companyId}-${i}`,
      accountPass: `pass${randomInt(1000, 9999)}`,
    });
  }
  await prisma.stpContractHistory.createMany({ data: contractHistoryData });
  console.log('✓ Contract histories (100)');

  // 成果報酬テスト用: 企業61-65の専用契約履歴
  const perfContractHistories = [
    { id: 101, companyId: 61, industryType: 'general', contractPlan: 'performance', jobMedia: 'Airワーク', contractStartDate: new Date('2026-01-01'), contractEndDate: null as Date | null, initialFee: 0, monthlyFee: 50000, performanceFee: 80000, salesStaffId: 1, operationStaffId: 2, status: 'active', note: '成果報酬テスト（企業61）', operationStatus: null as string | null, accountId: 'acc-61-perf', accountPass: 'pass1234' },
    { id: 102, companyId: 62, industryType: 'dispatch', contractPlan: 'performance', jobMedia: '求人ボックス', contractStartDate: new Date('2026-01-01'), contractEndDate: null as Date | null, initialFee: 0, monthlyFee: 40000, performanceFee: 60000, salesStaffId: 2, operationStaffId: 3, status: 'active', note: '成果報酬テスト（企業62）', operationStatus: null as string | null, accountId: 'acc-62-perf', accountPass: 'pass2345' },
    { id: 103, companyId: 63, industryType: 'general', contractPlan: 'performance', jobMedia: 'Wantedly', contractStartDate: new Date('2026-01-01'), contractEndDate: null as Date | null, initialFee: 0, monthlyFee: 60000, performanceFee: 100000, salesStaffId: 3, operationStaffId: 4, status: 'active', note: '成果報酬テスト（企業63）', operationStatus: null as string | null, accountId: 'acc-63-perf', accountPass: 'pass3456' },
    { id: 104, companyId: 64, industryType: 'dispatch', contractPlan: 'performance', jobMedia: 'Airワーク', contractStartDate: new Date('2026-01-01'), contractEndDate: null as Date | null, initialFee: 0, monthlyFee: 45000, performanceFee: 50000, salesStaffId: 4, operationStaffId: 5, status: 'active', note: '成果報酬テスト（企業64）', operationStatus: null as string | null, accountId: 'acc-64-perf', accountPass: 'pass4567' },
    { id: 105, companyId: 65, industryType: 'general', contractPlan: 'performance', jobMedia: '求人ボックス', contractStartDate: new Date('2026-01-01'), contractEndDate: null as Date | null, initialFee: 0, monthlyFee: 55000, performanceFee: 70000, salesStaffId: 5, operationStaffId: 6, status: 'active', note: '成果報酬テスト（企業65）', operationStatus: null as string | null, accountId: 'acc-65-perf', accountPass: 'pass5678' },
  ];
  await prisma.stpContractHistory.createMany({ data: perfContractHistories });
  console.log('✓ Performance fee contract histories (5)');

  // ============================================
  // 11. 契約書管理 (40件) + ステータス履歴
  // ============================================

  const contractTypes = ['基本契約', '秘密保持契約', '業務委託契約', '保守契約', 'SLA契約'];
  const masterContractData = [];
  for (let i = 1; i <= 40; i++) {
    const projectId = i <= 20 ? 1 : i <= 32 ? 2 : 3;
    const companyId = randomInt(1, 100);
    const statusId = randomInt(1, 8);
    const isActive = statusId === 7;
    const startDate = randomDate(new Date('2026-01-01'), new Date('2026-03-01'));
    masterContractData.push({
      id: i,
      companyId,
      projectId,
      contractNumber: `CTR-${['STP', 'SRD', 'SLP'][projectId - 1]}-${String(i).padStart(4, '0')}`,
      contractType: randomChoice(contractTypes),
      title: `${companyNames[companyId - 1]} ${randomChoice(contractTypes)}`,
      startDate,
      endDate: isActive ? randomDate(startDate, new Date('2027-06-30')) : null,
      currentStatusId: statusId,
      targetDate: statusId < 7 ? randomDate(new Date('2026-03-01'), new Date('2026-06-30')) : null,
      signedDate: statusId >= 7 ? randomDate(startDate, new Date('2026-03-04')) : null,
      isActive,
      signingMethod: randomChoice(['cloudsign', 'paper', 'cloudsign']),
      assignedTo: randomChoice(staffNames),
      note: `契約書テストデータ${i}`,
    });
  }
  await prisma.masterContract.createMany({ data: masterContractData });
  console.log('✓ Master contracts (40)');

  const statusHistoryData = [];
  let statusHistId = 0;
  for (let contractId = 1; contractId <= 40; contractId++) {
    const numHistory = randomInt(1, 3);
    let prevStatusId: number | null = null;
    for (let j = 0; j < numHistory; j++) {
      statusHistId++;
      const toStatusId: number = prevStatusId !== null ? Math.min(prevStatusId + randomInt(1, 2), 8) : randomInt(1, 3);
      statusHistoryData.push({
        id: statusHistId,
        contractId,
        eventType: prevStatusId === null ? 'created' : 'status_changed',
        fromStatusId: prevStatusId,
        toStatusId,
        targetDate: randomDate(new Date('2026-03-01'), new Date('2026-06-30')),
        changedBy: randomChoice(staffNames),
        note: prevStatusId === null ? '契約書作成' : 'ステータス更新',
        recordedAt: randomDate(new Date('2026-01-01'), new Date('2026-03-04')),
      });
      prevStatusId = toStatusId;
    }
  }
  await prisma.masterContractStatusHistory.createMany({ data: statusHistoryData });
  console.log(`✓ Contract status histories (${statusHistId})`);

  // ============================================
  // 12. 登録トークン (8件) + デフォルトビュー
  // ============================================

  const registrationTokenData = [];
  const tokenDefaultViewData: { registrationTokenId: number; displayViewId: number }[] = [];
  for (let i = 1; i <= 5; i++) {
    registrationTokenData.push({
      id: i,
      token: generateToken(),
      companyId: i,
      name: `${companyNames[i - 1]}向けトークン`,
      note: 'クライアント向け登録トークン',
      expiresAt: new Date('2026-09-30'),
      maxUses: 3,
      useCount: randomInt(0, 2),
      status: 'active',
      issuedBy: 10,
    });
    tokenDefaultViewData.push({ registrationTokenId: i, displayViewId: 1 });
  }
  for (let i = 6; i <= 8; i++) {
    const companyId = 75 + i;
    registrationTokenData.push({
      id: i,
      token: generateToken(),
      companyId,
      name: `${companyNames[companyId - 1]}向けトークン`,
      note: '代理店向け登録トークン',
      expiresAt: new Date('2026-09-30'),
      maxUses: 5,
      useCount: randomInt(0, 3),
      status: 'active',
      issuedBy: 10,
    });
    tokenDefaultViewData.push({ registrationTokenId: i, displayViewId: 2 });
  }
  await prisma.registrationToken.createMany({ data: registrationTokenData });
  await prisma.registrationTokenDefaultView.createMany({ data: tokenDefaultViewData });
  console.log('✓ Registration tokens (8) + default views');

  // ============================================
  // 13. 外部ユーザー (15件) + 表示権限
  // ============================================

  const externalUserData = [];
  const displayPermData: { externalUserId: number; displayViewId: number }[] = [];

  for (let i = 1; i <= 5; i++) {
    const companyId = 80 + i;
    const contactId = primaryContactId(companyId);
    const status: string = i <= 3 ? 'active' : i === 4 ? 'pending_approval' : 'suspended';
    externalUserData.push({
      id: i,
      companyId,
      registrationTokenId: i <= 3 ? i + 5 : null,
      contactId,
      name: `代理店ユーザー${i}`,
      position: randomChoice(['代表取締役', '営業部長', '営業担当']),
      email: `agent-user${i}@external.co.jp`,
      passwordHash: DEFAULT_PASSWORD_HASH,
      status,
      emailVerifiedAt: status !== 'pending_email' ? new Date('2026-02-01') : null,
      approvedAt: status === 'active' ? new Date('2026-02-02') : null,
      approvedBy: status === 'active' ? 10 : null,
      lastLoginAt: status === 'active' ? randomDate(new Date('2026-02-15'), new Date('2026-03-04')) : null,
    });
    displayPermData.push({ externalUserId: i, displayViewId: 2 });
  }

  for (let i = 6; i <= 15; i++) {
    const companyId = i - 5;
    const contactId = primaryContactId(companyId);
    const status: string = i <= 12 ? 'active' : i <= 14 ? 'pending_approval' : 'pending_email';
    externalUserData.push({
      id: i,
      companyId,
      registrationTokenId: companyId <= 5 ? companyId : null,
      contactId,
      name: `クライアントユーザー${i - 5}`,
      position: randomChoice(['人事部長', '採用担当', '総務部長', '代表取締役']),
      email: `client-user${i - 5}@external.co.jp`,
      passwordHash: DEFAULT_PASSWORD_HASH,
      status,
      emailVerifiedAt: status !== 'pending_email' ? new Date('2026-01-20') : null,
      approvedAt: status === 'active' ? new Date('2026-01-22') : null,
      approvedBy: status === 'active' ? 10 : null,
      lastLoginAt: status === 'active' ? randomDate(new Date('2026-02-01'), new Date('2026-03-04')) : null,
    });
    displayPermData.push({ externalUserId: i, displayViewId: 1 });
  }

  await prisma.externalUser.createMany({ data: externalUserData });
  await prisma.externalUserDisplayPermission.createMany({ data: displayPermData });
  console.log('✓ External users (15) + display permissions');

  // ============================================
  // 14. リード獲得フォームトークン (15件) + 回答 (25件)
  // ============================================

  const leadTokenData = [];
  for (let i = 1; i <= 15; i++) {
    leadTokenData.push({
      id: i,
      token: generateToken(),
      agentId: i,
      status: i <= 12 ? 'active' : i <= 14 ? 'paused' : 'revoked',
      expiresAt: i <= 12 ? new Date('2027-06-30') : new Date('2026-01-01'),
    });
  }
  await prisma.stpLeadFormToken.createMany({ data: leadTokenData });
  console.log('✓ Lead form tokens (15)');

  const jobTypes = ['営業', '事務', 'エンジニア', 'デザイナー', '管理職', '製造', '接客', 'ドライバー', '医療', '介護'];
  const prefectureList = ['東京都', '大阪府', '愛知県', '神奈川県', '福岡県', '北海道', '宮城県', '広島県', '京都府', '兵庫県'];
  const submissionData = [];
  for (let i = 1; i <= 25; i++) {
    const tokenId = ((i - 1) % 12) + 1;
    const status = i <= 15 ? 'processed' : i <= 22 ? 'pending' : 'rejected';
    const selectedJobs = [randomChoice(jobTypes), randomChoice(jobTypes)];
    const desiredJobs = [randomChoice(jobTypes)];
    const areas = [randomChoice(prefectureList), randomChoice(prefectureList)];
    submissionData.push({
      id: i,
      tokenId,
      stpCompanyId: status === 'processed' && i <= 10 ? randomInt(1, 80) : null,
      masterCompanyId: status === 'processed' && i <= 10 ? randomInt(1, 100) : null,
      companyName: `フォーム回答企業${i}`,
      contactName: `${randomChoice(lastNames)}${randomChoice(firstNames)}`,
      contactEmail: `submission${i}@form.co.jp`,
      contactPhone: `080-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`,
      pastHiringJobTypes: JSON.stringify(selectedJobs),
      pastRecruitingCostAgency: randomInt(0, 5000000),
      pastRecruitingCostAds: randomInt(0, 3000000),
      pastHiringCount: randomInt(0, 20),
      desiredJobTypes: JSON.stringify(desiredJobs),
      annualBudget: randomInt(1, 50) * 100000,
      annualHiringTarget: randomInt(1, 20),
      hiringAreas: JSON.stringify(areas),
      hiringTimeline: randomChoice(['1ヶ月以内', '3ヶ月以内', '6ヶ月以内', '1年以内']),
      ageRange: randomChoice(['不問', '〜30', '〜35', '〜40', '〜45', '〜50']),
      requiredConditions: Math.random() > 0.5 ? '普通自動車免許' : null,
      preferredConditions: Math.random() > 0.5 ? '業界経験3年以上' : null,
      status,
      processedAt: status === 'processed' ? randomDate(new Date('2026-01-15'), new Date('2026-03-04')) : null,
      processedBy: status === 'processed' ? randomInt(1, 10) : null,
      processingNote: status === 'rejected' ? '重複データのため不受理' : null,
      submittedAt: randomDate(new Date('2026-01-01'), new Date('2026-03-04')),
    });
  }
  await prisma.stpLeadFormSubmission.createMany({ data: submissionData });
  console.log('✓ Lead form submissions (25)');

  // ============================================
  // 15. 提案書 (20件)
  // ============================================

  const proposalData = [];
  for (let i = 1; i <= 20; i++) {
    const isAutoGenerated = i <= 10;
    const status = randomChoice(['draft', 'sent', 'viewed', 'accepted', 'rejected'] as const);
    proposalData.push({
      id: i,
      stpCompanyId: i <= 15 ? randomInt(36, 70) : null,
      submissionId: isAutoGenerated ? ((i - 1) % 15) + 1 : null,
      title: `提案書_${isAutoGenerated ? 'フォーム自動' : '手動作成'}_${i}`,
      proposalNumber: `PROP-${String(i).padStart(4, '0')}`,
      externalUrl: Math.random() > 0.5 ? `https://canva.com/design/proposal-${i}` : null,
      externalService: Math.random() > 0.5 ? 'canva' : null,
      status,
      sentAt: ['sent', 'viewed', 'accepted'].includes(status) ? randomDate(new Date('2026-01-15'), new Date('2026-03-04')) : null,
      assignedTo: randomChoice(staffNames),
      note: isAutoGenerated ? 'フォーム回答から自動生成' : '営業担当が手動作成',
      isAutoGenerated,
    });
  }
  await prisma.stpProposal.createMany({ data: proposalData });
  console.log('✓ Proposals (20)');

  // ============================================
  // 16. 短縮URL (15件)
  // ============================================

  const shortUrlData = [];
  for (let i = 1; i <= 15; i++) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let j = 0; j < 6; j++) code += chars[randomInt(0, chars.length - 1)];
    shortUrlData.push({
      id: i,
      shortCode: code,
      originalUrl: i <= 12 ? `https://stella-crm.example.com/form/stp-lead/${generateToken().substring(0, 16)}` : `https://stella-crm.example.com/portal/register/${generateToken().substring(0, 16)}`,
    });
  }
  await prisma.shortUrl.createMany({ data: shortUrlData });
  console.log('✓ Short URLs (15)');

  // ============================================
  // 17. KPIシート (12件) + 週次データ + 共有リンク
  // ============================================

  const kpiSheetData = [];
  const kpiMediaNames = ['Airワーク', 'Wantedly', '求人ボックス'];
  for (let i = 1; i <= 12; i++) {
    const stpCompanyId = i <= 7 ? i : 7 + i; // 運用中/運用準備の企業
    kpiSheetData.push({
      id: i,
      stpCompanyId,
      name: randomChoice(kpiMediaNames),
    });
  }
  await prisma.stpKpiSheet.createMany({ data: kpiSheetData });
  console.log('✓ KPI sheets (12)');

  // 週次データ (6週間 × 12シート)
  const weeklyData = [];
  let wdId = 0;
  const baseDate = new Date('2026-01-26'); // 月曜始まり
  for (let sheetId = 1; sheetId <= 12; sheetId++) {
    for (let week = 0; week < 6; week++) {
      wdId++;
      const weekStart = new Date(baseDate);
      weekStart.setDate(baseDate.getDate() + week * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const tImpressions = randomInt(5000, 50000);
      const tClicks = randomInt(100, 2000);
      const tApps = randomInt(5, 50);
      const tCost = randomInt(10000, 500000);

      weeklyData.push({
        id: wdId,
        kpiSheetId: sheetId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        targetImpressions: tImpressions,
        targetClicks: tClicks,
        targetApplications: tApps,
        targetCost: tCost,
        targetCtr: Number(((tClicks / tImpressions) * 100).toFixed(2)),
        targetCvr: Number(((tApps / tClicks) * 100).toFixed(2)),
        targetCpc: Number((tCost / tClicks).toFixed(2)),
        targetCpa: Number((tCost / tApps).toFixed(2)),
        actualImpressions: week < 5 ? randomInt(Math.floor(tImpressions * 0.7), Math.floor(tImpressions * 1.3)) : null,
        actualClicks: week < 5 ? randomInt(Math.floor(tClicks * 0.7), Math.floor(tClicks * 1.3)) : null,
        actualApplications: week < 5 ? randomInt(Math.floor(tApps * 0.5), Math.floor(tApps * 1.5)) : null,
        actualCost: week < 5 ? randomInt(Math.floor(tCost * 0.8), Math.floor(tCost * 1.2)) : null,
      });
    }
  }
  await prisma.stpKpiWeeklyData.createMany({ data: weeklyData });
  console.log(`✓ KPI weekly data (${wdId})`);

  // KPI共有リンク
  const shareLinkData = [];
  for (let i = 1; i <= 8; i++) {
    shareLinkData.push({
      id: i,
      kpiSheetId: i,
      token: generateToken(),
      expiresAt: new Date('2026-06-30'),
      createdBy: randomInt(1, 10),
    });
  }
  await prisma.stpKpiShareLink.createMany({ data: shareLinkData });
  console.log('✓ KPI share links (8)');

  // ============================================
  // 18. KPI月次目標（部門KPIダッシュボード用）
  // ============================================

  const kpiTargetData = [];
  const kpiMonths = ['2026-01', '2026-02', '2026-03'];
  const kpiTargets: Record<string, number> = {
    // KGI
    monthly_revenue: 50000000,
    monthly_gross_profit: 20000000,
    new_contracts: 10,
    fixed_cost: 30000000,
    monthly_leads: 30,
    // Alliance部
    alliance_valid_leads: 15,
    alliance_meetings: 10,
    alliance_sql_rate: 60,
    // Sales部
    sales_close_rate: 50,
    sales_new_contracts: 5,
    sales_meeting_to_contract_lt: 35,
    // バックオフィス部
    bo_operation_start_lt: 30,
    bo_collection_delay_rate: 5,
    bo_meeting_to_contract_lt: 45,
  };

  for (const month of kpiMonths) {
    for (const [key, value] of Object.entries(kpiTargets)) {
      kpiTargetData.push({
        yearMonth: month,
        kpiKey: key,
        targetValue: value,
      });
    }
  }
  await prisma.kpiMonthlyTarget.createMany({ data: kpiTargetData });
  console.log(`✓ KPI monthly targets (${kpiTargetData.length})`);

  // ============================================
  // 19. スタッフ役割種別 + 担当者フィールド制約
  // ============================================

  await prisma.staffRoleType.createMany({
    data: [
      { id: 1, code: 'AS', name: 'AS', description: 'アカウントサポート', displayOrder: 1 },
    ],
  });
  console.log('✓ Staff role types (1): AS');

  // 担当者フィールド定義（StaffFieldDefinition）のシード
  await prisma.staffFieldDefinition.createMany({
    data: [
      { id: 1, fieldCode: 'STP_COMPANY_SALES', fieldName: 'STP企業 担当営業', displayOrder: 1 },
      { id: 2, fieldCode: 'STP_COMPANY_ADMIN', fieldName: 'STP企業 担当事務', displayOrder: 2 },
      { id: 3, fieldCode: 'MASTER_COMPANY_STAFF', fieldName: '全顧客マスタ 担当者', displayOrder: 3 },
      { id: 4, fieldCode: 'CONTRACT_HISTORY_SALES', fieldName: '契約履歴 担当営業', displayOrder: 4 },
      { id: 5, fieldCode: 'CONTRACT_HISTORY_OPERATION', fieldName: '契約履歴 担当運用', displayOrder: 5 },
      { id: 6, fieldCode: 'STP_AGENT_STAFF', fieldName: '代理店 担当営業', displayOrder: 6 },
      { id: 7, fieldCode: 'STP_AGENT_ADMIN', fieldName: '代理店 担当事務', displayOrder: 7 },
      { id: 8, fieldCode: 'PROPOSAL_STAFF', fieldName: '提案書 担当者', displayOrder: 8 },
      { id: 9, fieldCode: 'CONTRACT_ASSIGNED_TO', fieldName: '契約書 担当者', displayOrder: 9 },
      { id: 10, fieldCode: 'CONTACT_HISTORY_STAFF', fieldName: '接触履歴 担当者', displayOrder: 10 },
    ],
    skipDuplicates: true,
  });
  console.log('✓ Staff field definitions (10)');

  const asRole = await prisma.staffRoleType.findFirst({ where: { name: 'AS' } });
  const stpProject = await prisma.masterProject.findFirst({ where: { code: 'stp' } });
  const masterCompanyField = await prisma.staffFieldDefinition.findFirst({ where: { fieldCode: 'MASTER_COMPANY_STAFF' } });
  if (asRole && stpProject && masterCompanyField) {
    await prisma.staffFieldRestriction.deleteMany({
      where: { fieldDefinitionId: masterCompanyField.id },
    });
    await prisma.staffFieldRestriction.create({
      data: {
        fieldDefinitionId: masterCompanyField.id,
        managingProjectId: stpProject.id,
        roleTypeId: asRole.id,
      },
    });
    console.log('  StaffFieldRestriction: MASTER_COMPANY_STAFF → AS role (managed by STP)');
  }

  // ============================================
  // シーケンスリセット
  // ============================================

  await resetSequences();
  console.log('✓ Sequences reset');

  // ============================================
  // サマリー
  // ============================================

  console.log('\n=== Seed Summary (2026-01~) ===');
  // ============================================
  // 補助金: LINE友達テストデータ（4アカウント × 10人）
  // ============================================

  const lineFriendNames = [
    '田中太郎', '佐藤花子', '鈴木一郎', '高橋美咲', '伊藤健太',
    '渡辺由美', '山本大輔', '中村あかり', '小林誠', '加藤さくら',
  ];

  const lineFriendBase = (i: number, prefix: string) => ({
    uid: `U${prefix}${String(i + 1).padStart(3, '0')}`,
    snsname: lineFriendNames[i],
    activeStatus: i < 8 ? '稼働中' : 'ブロック',
    friendAddedDate: new Date(2026, 0, i + 1),
    sei: lineFriendNames[i].slice(0, 2),
    mei: lineFriendNames[i].slice(2),
  });

  await prisma.hojoLineFriendShinseiSupport.createMany({
    data: Array.from({ length: 10 }, (_, i) => lineFriendBase(i, 'shinsei')),
  });
  console.log('✓ Hojo LINE Friends: 申請サポートセンター (10)');

  await prisma.hojoLineFriendJoseiSupport.createMany({
    data: Array.from({ length: 10 }, (_, i) => lineFriendBase(i, 'josei')),
  });
  console.log('✓ Hojo LINE Friends: 助成金申請サポート (10)');

  await prisma.hojoLineFriendAlkes.createMany({
    data: Array.from({ length: 10 }, (_, i) => lineFriendBase(i, 'alkes')),
  });
  console.log('✓ Hojo LINE Friends: ALKES (10)');

  await prisma.hojoLineFriendSecurityCloud.createMany({
    data: Array.from({ length: 10 }, (_, i) => lineFriendBase(i, 'seccloud')),
  });
  console.log('✓ Hojo LINE Friends: セキュリティクラウド (10)');

  console.log('Projects: 6 (Stella, Common, STP, SRD, SLP, Accounting)');
  console.log('Staff: 13 members (10 test + 3 system admin)');
  console.log('Companies: 100 (1-80: STP clients, 81-100: agents)');
  console.log('Locations: ~200, Contacts: ~200');
  console.log('Agents: 20');
  console.log('Agent contracts: 40 (documents)');
  console.log(`Agent contract histories: ${achId} (commission terms)`);
  console.log(`Agent commission overrides: ${overrideData.length}`);
  console.log('Candidates: 20 (5 with performance fee matching)');
  console.log('STP Companies: 80 (with leadValidity for KPI)');
  console.log('STP Company contracts: removed (migrated to MasterContract)');
  console.log(`Contact histories: ${chId} (62 KPI-deterministic + random)`);
  console.log(`Stage histories: ${shId} (7 KPI-deterministic transitions + random)`);
  console.log('Contract histories: 105 (100 random + 5 perf fee test)');
  console.log(`KPI monthly targets: ${kpiTargetData.length} (Jan/Feb/Mar 2026)`);
  console.log('');
  console.log('=== 部門KPI想定値 (2026-03) ===');
  console.log('Alliance: 有効リード8/15件, 商談5件, SQL率53.3%');
  console.log('Sales: 新規契約3件, 成約率60%, 商談→契約LT ~31日');
  console.log('BackOffice: 運用開始LT ~25日');
  console.log('');
  console.log('※ 成果報酬の売上・経費は「一括生成」ボタンで生成してください');
  console.log('Login (test): admin@example.com / password123');
  console.log('Login (system): loginId "admin", "test_user", or "stella001"');
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
