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
// データベースクリア
// ============================================

async function clearDatabase() {
  console.log('Clearing existing data...');
  // 子テーブルから順に削除
  await prisma.stpKpiShareLink.deleteMany();
  await prisma.stpKpiWeeklyData.deleteMany();
  await prisma.stpKpiSheet.deleteMany();
  await prisma.stpProposal.deleteMany();
  await prisma.stpLeadFormSubmission.deleteMany();
  await prisma.stpLeadFormToken.deleteMany();
  await prisma.shortUrl.deleteMany();
  await prisma.loginHistory.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.externalUserDisplayPermission.deleteMany();
  await prisma.externalUser.deleteMany();
  await prisma.registrationTokenDefaultView.deleteMany();
  await prisma.registrationToken.deleteMany();
  await prisma.masterContractStatusHistory.deleteMany();
  // 自己参照FKをnull化してから削除
  await prisma.masterContract.updateMany({ data: { parentContractId: null } });
  await prisma.masterContract.deleteMany();
  // 財務系テーブル（請求書→経費→売上→報酬例外→代理店契約履歴→求職者）
  await prisma.stpInvoice.deleteMany();
  await prisma.stpExpenseRecord.deleteMany();
  await prisma.stpRevenueRecord.deleteMany();
  await prisma.stpAgentCommissionOverride.deleteMany();
  await prisma.stpAgentContractHistory.deleteMany();
  await prisma.stpCandidate.deleteMany();
  await prisma.stpContractHistory.deleteMany();
  await prisma.stpStageHistory.deleteMany();
  await prisma.contactHistoryFile.deleteMany();
  await prisma.contactHistoryRole.deleteMany();
  await prisma.contactHistory.deleteMany();
  await prisma.stpCompanyContract.deleteMany();
  await prisma.stpCompany.deleteMany();
  await prisma.stpAgentContract.deleteMany();
  await prisma.stpAgentStaff.deleteMany();
  await prisma.stpAgent.deleteMany();
  await prisma.stellaCompanyContact.deleteMany();
  await prisma.stellaCompanyLocation.deleteMany();
  await prisma.masterStellaCompany.deleteMany();
  await prisma.staffProjectAssignment.deleteMany();
  await prisma.staffRoleAssignment.deleteMany();
  await prisma.staffPermission.deleteMany();
  await prisma.masterStaff.deleteMany();
  await prisma.customerType.deleteMany();
  await prisma.masterProject.deleteMany();
  await prisma.masterContractStatus.deleteMany();
  await prisma.displayView.deleteMany();
  await prisma.stpStage.deleteMany();
  await prisma.contactMethod.deleteMany();
  await prisma.stpLeadSource.deleteMany();
  await prisma.staffRoleType.deleteMany();
  console.log('Data cleared.');
}

// ============================================
// シーケンスリセット
// ============================================

async function resetSequences() {
  const tables = [
    'stp_stages', 'contact_methods', 'stp_lead_sources',
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
  console.log('=== Starting comprehensive seed ===\n');
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
      { id: 4, name: '見積提示', displayOrder: 4, stageType: 'progress' },
      { id: 5, name: '受注', displayOrder: 5, stageType: 'closed_won' },
      { id: 6, name: '失注', stageType: 'closed_lost' },
      { id: 7, name: '検討中', stageType: 'pending' },
    ],
  });
  console.log('✓ Stages (7)');

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

  // スタッフ役割種別: 本番では管理画面から手入力のためシードデータなし

  // プロジェクト
  await prisma.masterProject.createMany({
    data: [
      { id: 1, code: 'stp', name: 'STP', description: '採用支援サービスの商談・契約管理', displayOrder: 1 },
      { id: 2, code: 'srd', name: 'SRD', description: 'システム受託開発プロジェクト管理', displayOrder: 2 },
      { id: 3, code: 'slo', name: 'SLO', description: '公的財団関連プロジェクト管理', displayOrder: 3 },
    ],
  });
  console.log('✓ Projects (3): STP, SRD, SLO');

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
      { id: 1, viewKey: 'stp_client', viewName: '採用ブースト（クライアント版）', projectCode: 'stp', description: 'クライアント企業向け採用ブーストデータ閲覧画面' },
      { id: 2, viewKey: 'stp_agent', viewName: '採用ブースト（紹介者版）', projectCode: 'stp', description: '紹介者向け採用ブーストデータ閲覧画面' },
      { id: 3, viewKey: 'srd_agent', viewName: '開発（紹介者版）', projectCode: 'srd', description: '紹介者向け開発データ閲覧画面' },
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
  // 2. スタッフ (10名)
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
      { id: 10, name: '管理者', nameKana: 'カンリシャ', email: 'admin@example.com', phone: '090-0000-0000', contractType: '正社員', loginId: 'kanrisha', passwordHash: DEFAULT_PASSWORD_HASH, displayOrder: 10 },
      // システム管理者（パスワードはbcryptハッシュ化済み・復元不可）
      { id: 11, name: 'システム管理者', nameKana: 'システムカンリシャ', email: 'sysadmin@stella-crm.local', phone: null, contractType: '正社員', loginId: 'admin', passwordHash: SYSTEM_ADMIN_HASH, isSystemUser: true },
      { id: 12, name: 'テストユーザー', nameKana: 'テストユーザー', email: 'testuser@stella-crm.local', phone: null, contractType: '正社員', loginId: 'test_user', passwordHash: SYSTEM_TEST_HASH, isSystemUser: true },
      // 固定データ編集専用アカウント（この権限はstella001のみが持つ）
      { id: 13, name: '固定データ管理者', nameKana: 'コテイデータカンリシャ', email: 'stella001@stella-crm.local', phone: null, contractType: '正社員', loginId: 'stella001', passwordHash: STELLA001_HASH, canEditMasterData: true, isSystemUser: true },
    ],
  });
  console.log('✓ Staff (13)');

  // スタッフ権限
  await prisma.staffPermission.createMany({
    data: [
      { staffId: 1, projectCode: 'stp', permissionLevel: 'edit' },
      { staffId: 1, projectCode: 'srd', permissionLevel: 'view' },
      { staffId: 2, projectCode: 'stp', permissionLevel: 'edit' },
      { staffId: 3, projectCode: 'stp', permissionLevel: 'view' },
      { staffId: 3, projectCode: 'srd', permissionLevel: 'edit' },
      { staffId: 4, projectCode: 'stp', permissionLevel: 'edit' },
      { staffId: 4, projectCode: 'slo', permissionLevel: 'view' },
      { staffId: 5, projectCode: 'stp', permissionLevel: 'edit' },
      { staffId: 5, projectCode: 'srd', permissionLevel: 'edit' },
      { staffId: 6, projectCode: 'stp', permissionLevel: 'view' },
      { staffId: 6, projectCode: 'slo', permissionLevel: 'edit' },
      { staffId: 7, projectCode: 'stp', permissionLevel: 'edit' },
      { staffId: 8, projectCode: 'srd', permissionLevel: 'edit' },
      { staffId: 8, projectCode: 'slo', permissionLevel: 'view' },
      { staffId: 9, projectCode: 'stp', permissionLevel: 'edit' },
      { staffId: 10, projectCode: 'stella', permissionLevel: 'admin' },
      { staffId: 10, projectCode: 'stp', permissionLevel: 'admin' },
      { staffId: 10, projectCode: 'srd', permissionLevel: 'admin' },
      { staffId: 10, projectCode: 'slo', permissionLevel: 'admin' },
      // システム管理者（admin）
      { staffId: 11, projectCode: 'stella', permissionLevel: 'admin' },
      { staffId: 11, projectCode: 'stp', permissionLevel: 'admin' },
      { staffId: 11, projectCode: 'srd', permissionLevel: 'admin' },
      { staffId: 11, projectCode: 'slo', permissionLevel: 'admin' },
      // テストユーザー（test_user）
      { staffId: 12, projectCode: 'stella', permissionLevel: 'admin' },
      { staffId: 12, projectCode: 'stp', permissionLevel: 'admin' },
      { staffId: 12, projectCode: 'srd', permissionLevel: 'admin' },
      { staffId: 12, projectCode: 'slo', permissionLevel: 'admin' },
      // 固定データ管理者（stella001）: プロジェクト権限なし（canEditMasterDataのみ）
    ],
  });
  console.log('✓ Staff permissions (27)');

  // スタッフ役割割当: 役割種別を管理画面で登録後に設定するためシードデータなし

  // スタッフプロジェクト割当
  const staffProjectData: { staffId: number; projectId: number }[] = [];
  // 全スタッフ → STP（stella001=13はプロジェクト割当なし）
  for (let s = 1; s <= 12; s++) staffProjectData.push({ staffId: s, projectId: 1 });
  // SRD: 田中, 山本, 伊藤, 小林, 管理者, admin, test_user
  for (const s of [1, 3, 5, 8, 10, 11, 12]) staffProjectData.push({ staffId: s, projectId: 2 });
  // SLO: 田中, 佐藤, 渡辺, 小林, 管理者, admin, test_user
  for (const s of [1, 4, 6, 8, 10, 11, 12]) staffProjectData.push({ staffId: s, projectId: 3 });
  await prisma.staffProjectAssignment.createMany({ data: staffProjectData });
  console.log('✓ Staff project assignments (20)');

  // ============================================
  // 3. 全顧客マスタ (100社)
  // ============================================

  const industries = ['IT・通信', '製造業', '商社', '医療機器', '外食', 'エネルギー', '金融', 'デザイン', '人材サービス', '不動産', '建設', '物流', '小売', '教育', 'コンサルティング'];
  const revenueScales = ['10億未満', '10億〜50億', '50億〜100億', '100億以上'];
  const companyNames = [
    // 1-20
    '株式会社テックソリューション', '山田製造株式会社', 'グローバルトレード株式会社', 'メディカルケア株式会社',
    'フードサービス株式会社', 'エコエナジー株式会社', 'ファイナンシャルパートナーズ', 'クリエイティブデザイン株式会社',
    '東京システム開発', '大阪物産株式会社', '名古屋建設工業', '福岡トレーディング',
    '北海道フーズ', '札幌IT株式会社', '仙台メディカル', '広島エンジニアリング',
    '京都デザインラボ', '神戸物流センター', '横浜コンサルティング', '千葉不動産',
    // 21-40
    'さいたまテック', '川崎製作所', '相模原システムズ', '堺エネルギー',
    '岡山商事', '静岡フーズ', '新潟工業', '浜松テクノロジー',
    '熊本サービス', '鹿児島ホールディングス', '長崎トレード', '金沢IT',
    '富山製造', '高松建設', '松山エージェント', '那覇リゾート',
    'アルファシステムズ', 'ベータコーポレーション', 'ガンマテクノロジー', 'デルタサービス',
    // 41-60
    'イプシロンホールディングス', 'ゼータソリューションズ', 'イータコンサルティング', 'シータデザイン',
    'アイオータシステムズ', 'カッパエンタープライズ', 'ラムダテクノロジー', 'ミューコーポレーション',
    'ニューシステムズ', 'クサイサービス', 'オミクロンホールディングス', 'パイテクノロジー',
    'ローシステムズ', 'シグマコーポレーション', 'タウサービス', 'ウプシロンIT',
    'ファイソリューションズ', 'カイコンサルティング', 'プサイテクノロジー', 'オメガシステムズ',
    // 61-80
    '日本テクノサービス', '全国物流ネットワーク', 'ユニバーサルデザイン', 'パシフィックトレード',
    'アジアンホールディングス', 'グローバルネットワーク', 'ナショナルサービス', 'インターナショナルIT',
    'ワールドコーポレーション', 'コンチネンタルシステムズ', 'メトロポリタンサービス', 'オーシャンテクノロジー',
    'マウンテンホールディングス', 'リバーサイドシステムズ', 'サンシャインサービス', 'ムーンライトIT',
    'スターシステムズ', 'プラネットコーポレーション', 'ギャラクシーテクノロジー', 'コスモスサービス',
    // 81-100: 代理店/紹介者企業
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

  // ============================================
  // 6. 代理店マスタ (20社: companyId 81-100)
  // ============================================

  const agentData = [];
  for (let i = 0; i < 20; i++) {
    const agentId = i + 1;
    const companyId = 81 + i;
    const isAdvisor = i >= 12 && i <= 15; // Agent 13-16: 顧問
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
      signedDate: isSigned ? randomDate(new Date('2024-06-01'), new Date('2025-12-31')) : null,
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
    // アクティブ代理店(1-15)は2件（旧→現行）、その他は1件
    const numHistories = agentId <= 15 ? 2 : 1;

    for (let h = 0; h < numHistories; h++) {
      achId++;
      const isLatest = h === numHistories - 1;
      const isCurrent = isLatest && agentId <= 15;
      const startDate = h === 0
        ? randomDate(new Date('2024-01-01'), new Date('2024-12-31'))
        : randomDate(new Date('2025-01-01'), new Date('2025-06-30'));
      const endDate = !isLatest
        ? randomDate(new Date('2025-01-01'), new Date('2025-06-30'))
        : agentId > 18 ? randomDate(new Date('2025-10-01'), new Date('2026-01-15')) : null;

      // 報酬率: 代理店ごとに少しばらつきを出す
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
        // 代理店への直接費用（顧問系は高め、一般は0〜少額）
        initialFee: agentId >= 13 && agentId <= 16 ? randomInt(50, 150) * 1000 : randomInt(0, 3) * 10000,
        monthlyFee: agentId >= 13 && agentId <= 16 ? randomInt(50, 200) * 1000 : randomInt(0, 2) * 10000,
        // 月額プラン（MP）の報酬
        defaultMpInitialRate: baseInitialRate,
        defaultMpInitialDuration: randomChoice([1, 1, 3]),
        defaultMpMonthlyType: monthlyType,
        defaultMpMonthlyRate: monthlyType === 'rate' ? baseMonthlyRate : null,
        defaultMpMonthlyFixed: monthlyType === 'fixed' ? randomInt(1, 5) * 10000 : null,
        defaultMpMonthlyDuration: randomChoice([3, 6, 6, 12]),
        // 成果報酬プラン（PP）の報酬
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
  // ============================================

  // ステージ分布: リード20, 商談化15, 提案中15, 見積提示10, 受注10, 失注5, 検討中5
  function stageForIndex(i: number): number {
    if (i <= 20) return 1;
    if (i <= 35) return 2;
    if (i <= 50) return 3;
    if (i <= 60) return 4;
    if (i <= 70) return 5;
    if (i <= 75) return 6;
    return 7;
  }

  const forecasts = ['MIN', '落とし', 'MAX', '来月', '辞退'];
  const operationStatuses = ['テスト1', 'テスト2'];
  const industryTypes = ['一般', '派遣'];
  const mediaOptions = ['Indeed', 'Wantedly', 'リクナビ', 'マイナビ', 'doda'];
  const initialFees = [0, 100000, 150000];
  const progressDetails = [
    'リード獲得。メール返信待ち。', '初回商談完了。ニーズヒアリング済み。',
    '提案書作成中。来週プレゼン予定。', '見積提示済み。決裁待ち。',
    '受注済み。契約手続き中。', '失注。競合に決定。', '検討中。予算調整中。',
  ];

  const stpCompanyData = [];
  for (let i = 1; i <= 80; i++) {
    const stageId = stageForIndex(i);
    const isProgress = stageId >= 1 && stageId <= 4;
    const hasTarget = isProgress && Math.random() > 0.3;
    const hasAgent = Math.random() > 0.7;
    const leadDate = randomDate(new Date('2025-06-01'), new Date('2026-01-31'));
    const hasMeeting = stageId >= 2;
    const meetDate = hasMeeting ? randomDate(leadDate, new Date('2026-02-15')) : null;

    stpCompanyData.push({
      id: i,
      companyId: i,
      agentId: hasAgent ? randomInt(1, 20) : null,
      currentStageId: stageId,
      nextTargetStageId: hasTarget ? Math.min(stageId + 1, 5) : null,
      nextTargetDate: hasTarget ? randomDate(new Date('2026-02-01'), new Date('2026-04-30')) : null,
      leadAcquiredDate: leadDate,
      meetingDate: meetDate,
      firstKoDate: stageId >= 3 && meetDate ? randomDate(meetDate, new Date('2026-02-28')) : null,
      jobPostingStartDate: stageId >= 4 ? `2026-0${randomInt(1, 3)}-${String(randomInt(10, 28)).padStart(2, '0')}` : null,
      progressDetail: progressDetails[stageId - 1],
      forecast: isProgress ? randomChoice(forecasts) : null,
      operationStatus: stageId >= 4 ? randomChoice(operationStatuses) : null,
      industryType: randomChoice(industryTypes),
      plannedHires: randomInt(1, 30),
      leadSourceId: randomInt(1, 5),
      media: stageId >= 3 ? randomChoice(mediaOptions) : null,
      initialFee: stageId >= 4 ? randomChoice(initialFees) : null,
      monthlyFee: stageId >= 4 ? randomInt(3, 15) * 10000 : null,
      performanceFee: stageId >= 4 && Math.random() > 0.5 ? randomInt(2, 5) * 10000 : null,
      salesStaffId: randomInt(1, 10),
      operationStaffList: stageId >= 4 ? randomChoice(['indeed', 'indeed,運用2', '運用2']) : null,
      accountId: stageId >= 4 ? `account-${i}` : null,
      accountPass: stageId >= 4 ? `pass${randomInt(1000, 9999)}` : null,
      note: `STP企業テストデータ${i}。`,
      contractNote: stageId >= 4 ? `契約内容メモ${i}` : null,
      lostReason: stageId === 6 ? randomChoice(['競合に決定', '予算不足', '時期尚早', '社内調整不可']) : null,
      pendingReason: stageId === 7 ? randomChoice(['予算調整中', '社内承認待ち', '人員確保待ち']) : null,
      pendingResponseDate: stageId === 7 ? randomDate(new Date('2026-02-15'), new Date('2026-03-31')) : null,
      billingCompanyName: stageId >= 4 ? companyNames[i - 1] : null,
      billingAddress: stageId >= 4 ? `東京都千代田区${randomInt(1, 5)}-${randomInt(1, 10)}` : null,
      paymentTerms: stageId >= 4 ? randomChoice(['月末締め翌月末払い', '月末締め翌々月末払い', '20日締め翌月末払い']) : null,
    });
  }
  // 成果報酬テスト用: 企業61-65に代理店を強制割り当て
  stpCompanyData[60].agentId = 1;  // stpCompany 61 → agent 1
  stpCompanyData[61].agentId = 2;  // stpCompany 62 → agent 2
  stpCompanyData[62].agentId = 3;  // stpCompany 63 → agent 3
  stpCompanyData[63].agentId = 5;  // stpCompany 64 → agent 5
  stpCompanyData[64].agentId = 7;  // stpCompany 65 → agent 7

  await prisma.stpCompany.createMany({ data: stpCompanyData });
  console.log('✓ STP Companies (80)');

  // STP企業契約書 (120件)
  const companyContractStatuses = ['draft', '送付済み', '先方情報待ち', 'signed', 'signed', 'expired'];
  const companyContractTitles = ['採用支援サービス利用契約書', '秘密保持契約書', '業務委託契約書', '求人広告掲載契約書', '成果報酬契約書'];
  const stpContractData = [];
  for (let i = 1; i <= 120; i++) {
    const stpCompanyId = ((i - 1) % 80) + 1;
    const status = randomChoice(companyContractStatuses);
    const isSigned = status === 'signed';
    stpContractData.push({
      id: i,
      stpCompanyId,
      contractUrl: status !== 'draft' ? `https://cloudsign.example.com/contracts/stp-${stpCompanyId}-${i}` : null,
      signedDate: isSigned ? randomDate(new Date('2025-01-01'), new Date('2026-01-31')) : null,
      title: randomChoice(companyContractTitles),
      externalId: status !== 'draft' ? `CS-STP-${String(i).padStart(4, '0')}` : null,
      externalService: status !== 'draft' ? 'cloudsign' : null,
      status,
      note: status === 'draft' ? '作成中' : status === '送付済み' ? '署名待ち' : null,
    });
  }
  await prisma.stpCompanyContract.createMany({ data: stpContractData });
  console.log('✓ STP Company contracts (120)');

  // ============================================
  // 7b. 企業別報酬例外 + 求職者 (STP企業作成後)
  // ============================================

  // 企業別報酬例外 (10件: 一部の企業は特別レート)
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

  // 求職者 (20件: 最初の5件は成果報酬テスト用の確定データ)
  const candidateLastNames = ['山田', '佐藤', '田中', '鈴木', '高橋', '伊藤', '渡辺', '中村', '小林', '加藤'];
  const candidateFirstNames = ['太郎', '花子', '一郎', '美咲', '健太', '直樹', '恵', '拓也', '由美', '翔'];
  const selectionStatuses = ['書類選考中', '一次面接', '二次面接', '最終面接', '内定', '入社済み', '辞退', '不合格'];
  const candidateIndustryTypes = ['general', 'dispatch'];
  const candidateJobMedias = ['Indeed', 'doda', 'Wantedly', 'マイナビ', 'リクナビ'];

  // 成果報酬テスト用: 確定的にマッチするデータ（5件）
  const perfCandidates = [
    { id: 1, lastName: '山田', firstName: '太郎', stpCompanyId: 61, industryType: 'general' as string | null, jobMedia: 'Indeed' as string | null, joinDate: new Date('2026-01-15') as Date | null, interviewDate: new Date('2025-12-01') as Date | null, offerDate: new Date('2025-12-20') as Date | null },
    { id: 2, lastName: '佐藤', firstName: '花子', stpCompanyId: 62, industryType: 'dispatch' as string | null, jobMedia: 'doda' as string | null, joinDate: new Date('2026-01-20') as Date | null, interviewDate: new Date('2025-12-05') as Date | null, offerDate: new Date('2025-12-25') as Date | null },
    { id: 3, lastName: '田中', firstName: '一郎', stpCompanyId: 63, industryType: 'general' as string | null, jobMedia: 'Wantedly' as string | null, joinDate: new Date('2026-02-01') as Date | null, interviewDate: new Date('2025-12-10') as Date | null, offerDate: new Date('2026-01-10') as Date | null },
    { id: 4, lastName: '鈴木', firstName: '美咲', stpCompanyId: 64, industryType: 'dispatch' as string | null, jobMedia: 'マイナビ' as string | null, joinDate: new Date('2025-12-15') as Date | null, interviewDate: new Date('2025-11-01') as Date | null, offerDate: new Date('2025-11-25') as Date | null },
    { id: 5, lastName: '高橋', firstName: '健太', stpCompanyId: 65, industryType: 'general' as string | null, jobMedia: 'リクナビ' as string | null, joinDate: new Date('2026-01-10') as Date | null, interviewDate: new Date('2025-11-20') as Date | null, offerDate: new Date('2025-12-15') as Date | null },
  ];

  const candidateData = [];
  // 成果報酬テスト用の5件
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

  // 残り15件はランダム
  for (let i = 6; i <= 20; i++) {
    const hasInterview = Math.random() > 0.3;
    const hasOffer = hasInterview && Math.random() > 0.5;
    const hasJoin = hasOffer && Math.random() > 0.4;
    const status = hasJoin ? '入社済み' : hasOffer ? '内定' : randomChoice(selectionStatuses);
    candidateData.push({
      id: i,
      lastName: randomChoice(candidateLastNames),
      firstName: randomChoice(candidateFirstNames),
      interviewDate: hasInterview ? randomDate(new Date('2025-10-01'), new Date('2026-01-31')) : null,
      interviewAttendance: hasInterview ? (Math.random() > 0.1 ? '参加' : '不参加') : null,
      selectionStatus: status,
      offerDate: hasOffer ? randomDate(new Date('2025-11-01'), new Date('2026-01-31')) : null,
      joinDate: hasJoin ? randomDate(new Date('2025-12-01'), new Date('2026-02-28')) : null,
      industryType: Math.random() > 0.5 ? randomChoice(candidateIndustryTypes) : null,
      jobMedia: Math.random() > 0.5 ? randomChoice(candidateJobMedias) : null,
      note: hasJoin ? '入社済み。' : hasOffer ? '内定承諾待ち。' : null,
      stpCompanyId: randomInt(61, 70),
    });
  }
  await prisma.stpCandidate.createMany({ data: candidateData });
  console.log('✓ Candidates (20, 5 with perf fee matching)');

  // ============================================
  // 8. 接触履歴 (200件)
  // ============================================

  const meetingMinutes = [
    'ヒアリングを実施。採用課題について詳細確認。', '提案内容について説明。前向きな反応あり。',
    '見積内容について質問あり。回答済み。', '契約条件について調整中。',
    '月次定例ミーティング。進捗共有。', '新規案件について相談。',
    '課題整理を実施。', 'サービス説明を実施。興味を示している。',
    'フォローアップの電話。好感触。', '資料送付後の確認連絡。',
  ];
  const noteTemplates = [
    '60分のWeb会議を実施', '15分の電話', '90分の訪問商談', '45分のオンラインミーティング',
    'メールでの確認', '30分の電話会議', '資料送付', 'フォローアップ連絡',
  ];

  const contactHistoryData = [];
  for (let i = 1; i <= 200; i++) {
    const isAgent = Math.random() > 0.7;
    const companyId = isAgent ? randomInt(81, 100) : randomInt(1, 80);
    contactHistoryData.push({
      id: i,
      companyId,
      contactDate: randomDate(new Date('2025-06-01'), new Date('2026-01-31')),
      contactMethodId: randomInt(1, 5),
      staffId: randomInt(1, 10),
      assignedTo: String(randomInt(1, 10)),
      meetingMinutes: Math.random() > 0.3 ? randomChoice(meetingMinutes) : null,
      note: randomChoice(noteTemplates),
    });
  }
  await prisma.contactHistory.createMany({ data: contactHistoryData });
  console.log('✓ Contact histories (200)');

  // 接触履歴ロール
  const contactHistoryRoleData = [];
  for (let i = 1; i <= 200; i++) {
    const companyId = contactHistoryData[i - 1].companyId;
    const isAgent = companyId >= 81;
    contactHistoryRoleData.push({
      contactHistoryId: i,
      customerTypeId: isAgent ? 2 : 1, // STP代理店 or STP企業
    });
  }
  await prisma.contactHistoryRole.createMany({ data: contactHistoryRoleData });
  console.log('✓ Contact history roles (200)');

  // ============================================
  // 9. ステージ変更履歴 (150件)
  // ============================================

  const eventTypes = ['commit', 'achieved', 'recommit', 'progress', 'back', 'cancel'];
  const staffNames = ['田中太郎', '鈴木花子', '山本次郎', '佐藤美咲', '伊藤健一', '渡辺優子', '高橋大輔', '小林理恵', '加藤誠', '管理者'];
  const stageHistoryData = [];
  for (let i = 1; i <= 150; i++) {
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
      id: i,
      stpCompanyId,
      eventType,
      fromStageId: eventType !== 'commit' ? fromStageId : null,
      toStageId,
      targetDate: ['commit', 'recommit'].includes(eventType) ? randomDate(new Date('2026-02-01'), new Date('2026-04-30')) : null,
      recordedAt: randomDate(new Date('2025-06-01'), new Date('2026-01-31')),
      changedBy: randomChoice(staffNames),
      note: eventType === 'back' ? '戦略見直しのため' : eventType === 'achieved' ? '目標達成' : null,
    });
  }
  await prisma.stpStageHistory.createMany({ data: stageHistoryData });
  console.log('✓ Stage histories (150)');

  // ============================================
  // 10. 契約履歴 (100件)
  // ============================================

  const jobMediaOptions = ['Indeed', 'Wantedly', 'リクナビ', 'マイナビ', 'doda'];
  const contractHistoryData = [];
  for (let i = 1; i <= 100; i++) {
    const companyId = randomInt(1, 80);
    const startDate = randomDate(new Date('2024-01-01'), new Date('2025-12-31'));
    const isActive = Math.random() > 0.3;
    contractHistoryData.push({
      id: i,
      companyId,
      industryType: randomChoice(['general', 'dispatch']),
      contractPlan: randomChoice(['monthly', 'performance']),
      jobMedia: randomChoice(jobMediaOptions),
      contractStartDate: startDate,
      contractEndDate: isActive ? null : randomDate(startDate, new Date('2026-01-31')),
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

  // 成果報酬テスト用: 企業61-65の専用契約履歴（求職者とマッチするよう確定データ）
  const perfContractHistories = [
    { id: 101, companyId: 61, industryType: 'general', contractPlan: 'performance', jobMedia: 'Indeed', contractStartDate: new Date('2025-01-01'), contractEndDate: null as Date | null, initialFee: 0, monthlyFee: 50000, performanceFee: 80000, salesStaffId: 1, operationStaffId: 2, status: 'active', note: '成果報酬テスト（企業61・一般・Indeed）', operationStatus: null as string | null, accountId: 'acc-61-perf', accountPass: 'pass1234' },
    { id: 102, companyId: 62, industryType: 'dispatch', contractPlan: 'performance', jobMedia: 'doda', contractStartDate: new Date('2025-01-01'), contractEndDate: null as Date | null, initialFee: 0, monthlyFee: 40000, performanceFee: 60000, salesStaffId: 2, operationStaffId: 3, status: 'active', note: '成果報酬テスト（企業62・派遣・doda）', operationStatus: null as string | null, accountId: 'acc-62-perf', accountPass: 'pass2345' },
    { id: 103, companyId: 63, industryType: 'general', contractPlan: 'performance', jobMedia: 'Wantedly', contractStartDate: new Date('2025-01-01'), contractEndDate: null as Date | null, initialFee: 0, monthlyFee: 60000, performanceFee: 100000, salesStaffId: 3, operationStaffId: 4, status: 'active', note: '成果報酬テスト（企業63・一般・Wantedly）', operationStatus: null as string | null, accountId: 'acc-63-perf', accountPass: 'pass3456' },
    { id: 104, companyId: 64, industryType: 'dispatch', contractPlan: 'performance', jobMedia: 'マイナビ', contractStartDate: new Date('2025-01-01'), contractEndDate: null as Date | null, initialFee: 0, monthlyFee: 45000, performanceFee: 50000, salesStaffId: 4, operationStaffId: 5, status: 'active', note: '成果報酬テスト（企業64・派遣・マイナビ）', operationStatus: null as string | null, accountId: 'acc-64-perf', accountPass: 'pass4567' },
    { id: 105, companyId: 65, industryType: 'general', contractPlan: 'performance', jobMedia: 'リクナビ', contractStartDate: new Date('2025-01-01'), contractEndDate: null as Date | null, initialFee: 0, monthlyFee: 55000, performanceFee: 70000, salesStaffId: 5, operationStaffId: 6, status: 'active', note: '成果報酬テスト（企業65・一般・リクナビ）', operationStatus: null as string | null, accountId: 'acc-65-perf', accountPass: 'pass5678' },
  ];
  await prisma.stpContractHistory.createMany({ data: perfContractHistories });
  console.log('✓ Performance fee contract histories (5)');

  // ============================================
  // 11. 契約書管理 (40件) + ステータス履歴 (80件)
  // ============================================

  const contractTypes = ['基本契約', '秘密保持契約', '業務委託契約', '保守契約', 'SLA契約'];
  const masterContractData = [];
  for (let i = 1; i <= 40; i++) {
    const projectId = i <= 20 ? 1 : i <= 32 ? 2 : 3; // STP:20, SRD:12, SLO:8
    const companyId = randomInt(1, 100);
    const statusId = randomInt(1, 8);
    const isActive = statusId === 7;
    const startDate = randomDate(new Date('2024-06-01'), new Date('2026-01-01'));
    masterContractData.push({
      id: i,
      companyId,
      projectId,
      contractNumber: `CTR-${['STP', 'SRD', 'SLO'][projectId - 1]}-${String(i).padStart(4, '0')}`,
      contractType: randomChoice(contractTypes),
      title: `${companyNames[companyId - 1]} ${randomChoice(contractTypes)}`,
      startDate,
      endDate: isActive ? randomDate(startDate, new Date('2027-03-31')) : null,
      currentStatusId: statusId,
      targetDate: statusId < 7 ? randomDate(new Date('2026-02-01'), new Date('2026-06-30')) : null,
      signedDate: statusId >= 7 ? randomDate(startDate, new Date('2026-01-31')) : null,
      isActive,
      signingMethod: randomChoice(['cloudsign', 'paper', 'cloudsign']),
      assignedTo: randomChoice(staffNames),
      note: `契約書テストデータ${i}`,
    });
  }
  await prisma.masterContract.createMany({ data: masterContractData });
  console.log('✓ Master contracts (40)');

  // 契約書ステータス変更履歴
  const statusHistoryData = [];
  let shId = 0;
  for (let contractId = 1; contractId <= 40; contractId++) {
    const numHistory = randomInt(1, 3);
    let prevStatusId: number | null = null;
    for (let j = 0; j < numHistory; j++) {
      shId++;
      const toStatusId: number = prevStatusId !== null ? Math.min(prevStatusId + randomInt(1, 2), 8) : randomInt(1, 3);
      statusHistoryData.push({
        id: shId,
        contractId,
        eventType: prevStatusId === null ? 'created' : 'status_changed',
        fromStatusId: prevStatusId,
        toStatusId,
        targetDate: randomDate(new Date('2026-02-01'), new Date('2026-06-30')),
        changedBy: randomChoice(staffNames),
        note: prevStatusId === null ? '契約書作成' : 'ステータス更新',
        recordedAt: randomDate(new Date('2025-06-01'), new Date('2026-01-31')),
      });
      prevStatusId = toStatusId;
    }
  }
  await prisma.masterContractStatusHistory.createMany({ data: statusHistoryData });
  console.log(`✓ Contract status histories (${shId})`);

  // ============================================
  // 12. 登録トークン (8件) + デフォルトビュー
  // ============================================

  const registrationTokenData = [];
  const tokenDefaultViewData: { registrationTokenId: number; displayViewId: number }[] = [];
  // 5件: クライアント企業向け (companies 1-5)
  for (let i = 1; i <= 5; i++) {
    registrationTokenData.push({
      id: i,
      token: generateToken(),
      companyId: i,
      name: `${companyNames[i - 1]}向けトークン`,
      note: 'クライアント向け登録トークン',
      expiresAt: new Date('2026-06-30'),
      maxUses: 3,
      useCount: randomInt(0, 2),
      status: 'active',
      issuedBy: 10, // 管理者
    });
    tokenDefaultViewData.push({ registrationTokenId: i, displayViewId: 1 }); // stp_client
  }
  // 3件: 代理店向け (companies 81-83)
  for (let i = 6; i <= 8; i++) {
    const companyId = 75 + i; // 81, 82, 83
    registrationTokenData.push({
      id: i,
      token: generateToken(),
      companyId,
      name: `${companyNames[companyId - 1]}向けトークン`,
      note: '代理店向け登録トークン',
      expiresAt: new Date('2026-06-30'),
      maxUses: 5,
      useCount: randomInt(0, 3),
      status: 'active',
      issuedBy: 10,
    });
    tokenDefaultViewData.push({ registrationTokenId: i, displayViewId: 2 }); // stp_agent
  }
  await prisma.registrationToken.createMany({ data: registrationTokenData });
  await prisma.registrationTokenDefaultView.createMany({ data: tokenDefaultViewData });
  console.log('✓ Registration tokens (8) + default views');

  // ============================================
  // 13. 外部ユーザー (15件) + 表示権限
  // ============================================

  const externalUserData = [];
  const displayPermData: { externalUserId: number; displayViewId: number }[] = [];

  // 5件: 代理店ユーザー (companies 81-85, contacts 171-175)
  for (let i = 1; i <= 5; i++) {
    const companyId = 80 + i;
    const contactId = primaryContactId(companyId);
    const status: string = i <= 3 ? 'active' : i === 4 ? 'pending_approval' : 'suspended';
    externalUserData.push({
      id: i,
      companyId,
      registrationTokenId: i <= 3 ? i + 5 : null, // tokens 6-8
      contactId,
      name: `代理店ユーザー${i}`,
      position: randomChoice(['代表取締役', '営業部長', '営業担当']),
      email: `agent-user${i}@external.co.jp`,
      passwordHash: DEFAULT_PASSWORD_HASH,
      status,
      emailVerifiedAt: status !== 'pending_email' ? new Date('2026-01-15') : null,
      approvedAt: status === 'active' ? new Date('2026-01-16') : null,
      approvedBy: status === 'active' ? 10 : null,
      lastLoginAt: status === 'active' ? randomDate(new Date('2026-01-20'), new Date('2026-02-04')) : null,
    });
    displayPermData.push({ externalUserId: i, displayViewId: 2 }); // stp_agent
  }

  // 10件: クライアントユーザー (companies 1-10, primary contacts)
  for (let i = 6; i <= 15; i++) {
    const companyId = i - 5; // 1-10
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
      emailVerifiedAt: status !== 'pending_email' ? new Date('2026-01-10') : null,
      approvedAt: status === 'active' ? new Date('2026-01-12') : null,
      approvedBy: status === 'active' ? 10 : null,
      lastLoginAt: status === 'active' ? randomDate(new Date('2026-01-15'), new Date('2026-02-04')) : null,
    });
    displayPermData.push({ externalUserId: i, displayViewId: 1 }); // stp_client
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
      agentId: i, // Agent 1-15
      status: i <= 12 ? 'active' : i <= 14 ? 'paused' : 'revoked',
      expiresAt: i <= 12 ? new Date('2027-03-31') : new Date('2026-01-01'),
    });
  }
  await prisma.stpLeadFormToken.createMany({ data: leadTokenData });
  console.log('✓ Lead form tokens (15)');

  const jobTypes = ['営業', '事務', 'エンジニア', 'デザイナー', '管理職', '製造', '接客', 'ドライバー', '医療', '介護'];
  const prefectureList = ['東京都', '大阪府', '愛知県', '神奈川県', '福岡県', '北海道', '宮城県', '広島県', '京都府', '兵庫県'];
  const submissionData = [];
  for (let i = 1; i <= 25; i++) {
    const tokenId = ((i - 1) % 12) + 1; // Token 1-12 (active tokens)
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
      processedAt: status === 'processed' ? randomDate(new Date('2026-01-01'), new Date('2026-01-31')) : null,
      processedBy: status === 'processed' ? randomInt(1, 10) : null,
      processingNote: status === 'rejected' ? '重複データのため不受理' : null,
      submittedAt: randomDate(new Date('2025-10-01'), new Date('2026-01-31')),
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
      stpCompanyId: i <= 15 ? randomInt(36, 70) : null, // 提案中〜受注のSTP企業
      submissionId: isAutoGenerated ? ((i - 1) % 15) + 1 : null, // processed submissions
      title: `提案書_${isAutoGenerated ? 'フォーム自動' : '手動作成'}_${i}`,
      proposalNumber: `PROP-${String(i).padStart(4, '0')}`,
      externalUrl: Math.random() > 0.5 ? `https://canva.com/design/proposal-${i}` : null,
      externalService: Math.random() > 0.5 ? 'canva' : null,
      status,
      sentAt: ['sent', 'viewed', 'accepted'].includes(status) ? randomDate(new Date('2026-01-01'), new Date('2026-01-31')) : null,
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
  // 17. KPIシート (12件) + 週次データ (~72件) + 共有リンク (8件)
  // ============================================

  // 受注ステージ (id 61-70) と見積提示 (id 51-60) の企業にKPIシート
  const kpiSheetData = [];
  const kpiMediaNames = ['Indeed', 'Wantedly', 'リクナビ', 'マイナビ', 'doda', 'エン転職'];
  for (let i = 1; i <= 12; i++) {
    const stpCompanyId = 50 + i; // companies 51-62
    kpiSheetData.push({
      id: i,
      stpCompanyId,
      name: randomChoice(kpiMediaNames),
    });
  }
  await prisma.stpKpiSheet.createMany({ data: kpiSheetData });
  console.log('✓ KPI sheets (12)');

  // 週次データ (6週間 × 12シート = 72件)
  const weeklyData = [];
  let wdId = 0;
  const baseDate = new Date('2025-12-29'); // 月曜始まり
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
        // 実績（最新週はnull=未入力）
        actualImpressions: week < 5 ? randomInt(Math.floor(tImpressions * 0.7), Math.floor(tImpressions * 1.3)) : null,
        actualClicks: week < 5 ? randomInt(Math.floor(tClicks * 0.7), Math.floor(tClicks * 1.3)) : null,
        actualApplications: week < 5 ? randomInt(Math.floor(tApps * 0.5), Math.floor(tApps * 1.5)) : null,
        actualCost: week < 5 ? randomInt(Math.floor(tCost * 0.8), Math.floor(tCost * 1.2)) : null,
      });
    }
  }
  await prisma.stpKpiWeeklyData.createMany({ data: weeklyData });
  console.log(`✓ KPI weekly data (${wdId})`);

  // KPI共有リンク (8件)
  const shareLinkData = [];
  for (let i = 1; i <= 8; i++) {
    shareLinkData.push({
      id: i,
      kpiSheetId: i, // sheets 1-8
      token: generateToken(),
      expiresAt: new Date('2026-03-31'),
      createdBy: randomInt(1, 10),
    });
  }
  await prisma.stpKpiShareLink.createMany({ data: shareLinkData });
  console.log('✓ KPI share links (8)');

  // ============================================
  // シーケンスリセット
  // ============================================

  await resetSequences();
  console.log('✓ Sequences reset');

  // ============================================
  // サマリー
  // ============================================

  console.log('\n=== Seed Summary ===');
  console.log('Projects: 3 (STP, SRD, SLO)');
  console.log('Staff: 13 members (10 test + 3 system admin)');
  console.log('Companies: 100 (1-80: STP clients, 81-100: agents)');
  console.log('Locations: ~200, Contacts: ~200');
  console.log('Agents: 20');
  console.log('Agent contracts: 40 (documents)');
  console.log(`Agent contract histories: ${achId} (commission terms)`);
  console.log(`Agent commission overrides: ${overrideData.length}`);
  console.log('Candidates: 20 (5 with performance fee matching)');
  console.log('STP Companies: 80');
  console.log('STP Company contracts: 120');
  console.log('Contact histories: 200');
  console.log('Stage histories: 150');
  console.log('Contract histories: 105 (100 random + 5 perf fee test)');
  console.log('※ 成果報酬の売上・経費は「一括生成」ボタンで生成してください');
  console.log('Master contracts: 40 + status histories');
  console.log('External users: 15');
  console.log('Registration tokens: 8');
  console.log('Lead form tokens: 15, Submissions: 25');
  console.log('Proposals: 20');
  console.log('Short URLs: 15');
  console.log('KPI sheets: 12, Weekly data: 72, Share links: 8');
  console.log('\nLogin (test): admin@example.com / password123');
  console.log('Login (system): loginId "admin", "test_user", or "stella001"');
  console.log('Login (master data edit): loginId "stella001" (固定データ編集権限あり)');
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
