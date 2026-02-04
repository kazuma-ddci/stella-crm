import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Default password for test users: password123
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('password123', 10);

// Helper functions
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('Starting seed...');

  // 商談ステージの初期データ
  const stages: Array<{ name: string; displayOrder: number | null; stageType: string }> = [
    { name: 'リード', displayOrder: 1, stageType: 'progress' },
    { name: '商談化', displayOrder: 2, stageType: 'progress' },
    { name: '提案中', displayOrder: 3, stageType: 'progress' },
    { name: '見積提示', displayOrder: 4, stageType: 'progress' },
    { name: '受注', displayOrder: 5, stageType: 'closed_won' },
    { name: '失注', displayOrder: null, stageType: 'closed_lost' },
    { name: '検討中', displayOrder: null, stageType: 'pending' },
  ];

  for (const stage of stages) {
    await prisma.stpStage.upsert({
      where: { id: stages.indexOf(stage) + 1 },
      update: {
        stageType: stage.stageType,
        displayOrder: stage.displayOrder ?? undefined
      },
      create: stage,
    });
  }
  console.log('Stages seeded');

  // 接触方法の初期データ（接触履歴用）- 全プロジェクト共通
  const contactMethods = [
    { name: '電話', displayOrder: 1 },
    { name: 'メール', displayOrder: 2 },
    { name: '訪問', displayOrder: 3 },
    { name: 'Web会議', displayOrder: 4 },
    { name: 'その他', displayOrder: 5 },
  ];

  for (const method of contactMethods) {
    await prisma.contactMethod.upsert({
      where: { id: contactMethods.indexOf(method) + 1 },
      update: {},
      create: method,
    });
  }
  console.log('Contact methods seeded');

  // 流入経路マスタの初期データ
  const leadSources = [
    { name: '流入経路1', displayOrder: 1 },
    { name: '流入経路2', displayOrder: 2 },
    { name: '流入経路3', displayOrder: 3 },
    { name: '流入経路4', displayOrder: 4 },
    { name: '流入経路5', displayOrder: 5 },
  ];

  for (let i = 0; i < leadSources.length; i++) {
    await prisma.stpLeadSource.upsert({
      where: { id: i + 1 },
      update: {},
      create: leadSources[i],
    });
  }
  console.log('Lead sources seeded');

  // 連絡方法マスタの初期データ（企業との連絡方法）
  const communicationMethods = [
    { name: '連絡方法1', displayOrder: 1 },
    { name: '連絡方法2', displayOrder: 2 },
    { name: '連絡方法3', displayOrder: 3 },
    { name: '連絡方法4', displayOrder: 4 },
    { name: '連絡方法5', displayOrder: 5 },
  ];

  for (let i = 0; i < communicationMethods.length; i++) {
    await prisma.stpCommunicationMethod.upsert({
      where: { id: i + 1 },
      update: {},
      create: communicationMethods[i],
    });
  }
  console.log('Communication methods seeded');

  // スタッフ役割種別の初期データ
  const staffRoleTypes = [
    { code: 'AS', name: 'AS', description: 'アカウントセールス', displayOrder: 1 },
    { code: 'STP-運用', name: 'STP-運用', description: 'STP運用担当', displayOrder: 2 },
    { code: 'STP-CS', name: 'STP-CS', description: 'STPカスタマーサクセス', displayOrder: 3 },
  ];

  for (let i = 0; i < staffRoleTypes.length; i++) {
    await prisma.staffRoleType.upsert({
      where: { code: staffRoleTypes[i].code },
      update: {},
      create: staffRoleTypes[i],
    });
  }
  console.log('Staff role types seeded');

  // スタッフのテストデータ（15名）
  const staffMembers = [
    { name: '田中太郎', nameKana: 'タナカタロウ', email: 'tanaka@example.com', phone: '090-1111-1111', contractType: '正社員', loginId: 'tanaka', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '鈴木花子', nameKana: 'スズキハナコ', email: 'suzuki@example.com', phone: '090-2222-2222', contractType: '正社員', loginId: 'suzuki', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '山本次郎', nameKana: 'ヤマモトジロウ', email: 'yamamoto@example.com', phone: '090-3333-3333', contractType: '業務委託', loginId: 'yamamoto', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '管理者', nameKana: 'カンリシャ', email: 'admin@example.com', phone: '090-0000-0000', contractType: '正社員', loginId: 'admin', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '佐藤美咲', nameKana: 'サトウミサキ', email: 'sato@example.com', phone: '090-4444-4444', contractType: '正社員', loginId: 'sato', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '伊藤健一', nameKana: 'イトウケンイチ', email: 'ito@example.com', phone: '090-5555-5555', contractType: '正社員', loginId: 'ito', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '渡辺優子', nameKana: 'ワタナベユウコ', email: 'watanabe@example.com', phone: '090-6666-6666', contractType: '正社員', loginId: 'watanabe', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '高橋大輔', nameKana: 'タカハシダイスケ', email: 'takahashi@example.com', phone: '090-7777-7777', contractType: '正社員', loginId: 'takahashi', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '小林理恵', nameKana: 'コバヤシリエ', email: 'kobayashi@example.com', phone: '090-8888-8888', contractType: '業務委託', loginId: 'kobayashi', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '加藤誠', nameKana: 'カトウマコト', email: 'kato@example.com', phone: '090-9999-9999', contractType: '正社員', loginId: 'kato', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '吉田真由美', nameKana: 'ヨシダマユミ', email: 'yoshida@example.com', phone: '090-1234-5678', contractType: '正社員', loginId: 'yoshida', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '山田拓也', nameKana: 'ヤマダタクヤ', email: 'yamada@example.com', phone: '090-2345-6789', contractType: '業務委託', loginId: 'yamada', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '中村愛', nameKana: 'ナカムラアイ', email: 'nakamura@example.com', phone: '090-3456-7890', contractType: '正社員', loginId: 'nakamura', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '松本翔', nameKana: 'マツモトショウ', email: 'matsumoto@example.com', phone: '090-4567-8901', contractType: '正社員', loginId: 'matsumoto', passwordHash: DEFAULT_PASSWORD_HASH },
    { name: '井上さくら', nameKana: 'イノウエサクラ', email: 'inoue@example.com', phone: '090-5678-9012', contractType: '業務委託', loginId: 'inoue', passwordHash: DEFAULT_PASSWORD_HASH },
  ];

  for (let i = 0; i < staffMembers.length; i++) {
    await prisma.masterStaff.upsert({
      where: { id: i + 1 },
      update: {
        loginId: staffMembers[i].loginId,
        passwordHash: staffMembers[i].passwordHash,
      },
      create: staffMembers[i],
    });
  }
  console.log('Staff members seeded (15 members)');

  // スタッフ権限のテストデータ
  const staffPermissions = [
    // 田中太郎: Stella(admin), STP(edit)
    { staffId: 1, projectCode: 'stella', permissionLevel: 'admin' },
    { staffId: 1, projectCode: 'stp', permissionLevel: 'edit' },
    // 鈴木花子: Stella(view), STP(edit)
    { staffId: 2, projectCode: 'stella', permissionLevel: 'view' },
    { staffId: 2, projectCode: 'stp', permissionLevel: 'edit' },
    // 山本次郎: STP only (view)
    { staffId: 3, projectCode: 'stp', permissionLevel: 'view' },
    // 管理者: All admin
    { staffId: 4, projectCode: 'stella', permissionLevel: 'admin' },
    { staffId: 4, projectCode: 'stp', permissionLevel: 'admin' },
    // 佐藤美咲: STP(edit)
    { staffId: 5, projectCode: 'stp', permissionLevel: 'edit' },
    // 伊藤健一: Stella(edit), STP(edit)
    { staffId: 6, projectCode: 'stella', permissionLevel: 'edit' },
    { staffId: 6, projectCode: 'stp', permissionLevel: 'edit' },
    // 渡辺優子: STP(view)
    { staffId: 7, projectCode: 'stp', permissionLevel: 'view' },
    // 高橋大輔: Stella(view), STP(edit)
    { staffId: 8, projectCode: 'stella', permissionLevel: 'view' },
    { staffId: 8, projectCode: 'stp', permissionLevel: 'edit' },
  ];

  for (const permission of staffPermissions) {
    await prisma.staffPermission.upsert({
      where: {
        staffId_projectCode: {
          staffId: permission.staffId,
          projectCode: permission.projectCode,
        },
      },
      update: { permissionLevel: permission.permissionLevel },
      create: permission,
    });
  }
  console.log('Staff permissions seeded');

  // スタッフ役割割当のテストデータ
  const staffRoleAssignments = [
    { staffId: 1, roleTypeId: 1 }, // 田中太郎 - AS
    { staffId: 1, roleTypeId: 2 }, // 田中太郎 - STP-運用
    { staffId: 2, roleTypeId: 2 }, // 鈴木花子 - STP-運用
    { staffId: 2, roleTypeId: 3 }, // 鈴木花子 - STP-CS
    { staffId: 3, roleTypeId: 1 }, // 山本次郎 - AS
    { staffId: 5, roleTypeId: 2 }, // 佐藤美咲 - STP-運用
    { staffId: 6, roleTypeId: 1 }, // 伊藤健一 - AS
    { staffId: 8, roleTypeId: 3 }, // 高橋大輔 - STP-CS
    { staffId: 10, roleTypeId: 2 }, // 加藤誠 - STP-運用
  ];

  for (const assignment of staffRoleAssignments) {
    await prisma.staffRoleAssignment.upsert({
      where: {
        staffId_roleTypeId: {
          staffId: assignment.staffId,
          roleTypeId: assignment.roleTypeId,
        },
      },
      update: {},
      create: assignment,
    });
  }
  console.log('Staff role assignments seeded');

  // プロジェクトの初期データ
  const projects = [
    { id: 1, name: '採用ブースト', description: '採用支援サービス（STP）', displayOrder: 1 },
    { id: 2, name: 'コンサルティング', description: '経営・業務コンサルティングサービス', displayOrder: 2 },
    { id: 3, name: 'マーケティング支援', description: '広告・マーケティング支援サービス', displayOrder: 3 },
    { id: 4, name: 'システム開発', description: 'システム開発・DX支援サービス', displayOrder: 4 },
  ];

  for (const project of projects) {
    await prisma.masterProject.upsert({
      where: { id: project.id },
      update: {},
      create: project,
    });
  }
  console.log('Projects seeded');

  // スタッフプロジェクト割り当て（STPプロジェクトに全スタッフを割り当て）
  const STP_PROJECT_ID = 1;
  for (let staffId = 1; staffId <= 15; staffId++) {
    await prisma.staffProjectAssignment.upsert({
      where: {
        staffId_projectId: {
          staffId,
          projectId: STP_PROJECT_ID,
        },
      },
      update: {},
      create: {
        staffId,
        projectId: STP_PROJECT_ID,
      },
    });
  }
  console.log('Staff project assignments seeded');

  // 全顧客マスタのテストデータ（100件）
  const industries = ['IT・通信', '製造業', '商社', '医療機器', '外食', 'エネルギー', '金融', 'デザイン', '人材サービス', '不動産', '建設', '物流', '小売', '教育', 'コンサルティング'];
  const revenueScales = ['10億未満', '10億〜50億', '50億〜100億', '100億以上'];
  const companyNames = [
    '株式会社テックソリューション', '山田製造株式会社', 'グローバルトレード株式会社', 'メディカルケア株式会社',
    'フードサービス株式会社', 'エコエナジー株式会社', 'ファイナンシャルパートナーズ', 'クリエイティブデザイン株式会社',
    'ABCエージェント', 'XYZパートナーズ', 'グローバルリクルート',
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
    'ユニバースホールディングス', 'インフィニティシステムズ', 'エターナルサービス', 'フォーエバーIT',
    'タイムレスコーポレーション', 'エンドレステクノロジー', 'パーペチュアルサービス', 'コンスタントシステムズ',
    'ステディホールディングス', 'リライアブルIT', 'トラストコーポレーション', 'フェイスシステムズ',
    'ホープサービス', 'ドリームテクノロジー', 'ビジョンホールディングス', 'ミッションIT',
  ];

  const companies: { companyCode: string; name: string; websiteUrl: string; industry: string; revenueScale: string; note: string }[] = [];
  for (let i = 0; i < 100; i++) {
    const code = `SC-${i + 1}`;
    const name = companyNames[i] || `テスト企業${i + 1}`;
    const domain = name.toLowerCase().replace(/[株式会社\s・]/g, '').substring(0, 10);
    companies.push({
      companyCode: code,
      name: name,
      websiteUrl: `https://${domain}.co.jp`,
      industry: industries[i % industries.length],
      revenueScale: revenueScales[i % revenueScales.length],
      note: `テストデータ${i + 1}。`,
    });
  }

  for (const company of companies) {
    await prisma.masterStellaCompany.upsert({
      where: { companyCode: company.companyCode },
      update: {
        websiteUrl: company.websiteUrl,
        industry: company.industry,
        revenueScale: company.revenueScale,
      },
      create: company,
    });
  }
  console.log('Companies seeded (100 companies)');

  // 企業拠点のテストデータ（各企業に1-3拠点）
  const prefectures = ['東京都', '大阪府', '愛知県', '神奈川県', '福岡県', '北海道', '宮城県', '広島県', '京都府', '兵庫県'];
  const cities = ['千代田区', '中央区', '新宿区', '渋谷区', '港区', '品川区', '梅田', '難波', '栄', '博多'];

  let locationId = 1;
  for (let companyId = 1; companyId <= 50; companyId++) {
    // 各企業に1-3拠点を作成
    const numLocations = randomInt(1, 3);
    for (let j = 0; j < numLocations; j++) {
      const isPrimary = j === 0;
      const locationName = isPrimary ? '本社' : ['支社', '営業所', '事業所', '工場'][j - 1] || '支店';
      const prefecture = prefectures[randomInt(0, prefectures.length - 1)];
      const city = cities[randomInt(0, cities.length - 1)];

      await prisma.stellaCompanyLocation.upsert({
        where: { id: locationId },
        update: {},
        create: {
          companyId,
          name: locationName,
          address: `${prefecture}${city}${randomInt(1, 10)}-${randomInt(1, 20)}-${randomInt(1, 30)}`,
          phone: `0${randomInt(3, 9)}-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`,
          email: `${locationName.toLowerCase().replace(/[^\w]/g, '')}@company${companyId}.co.jp`,
          isPrimary,
          note: isPrimary ? '主要拠点' : null,
        },
      });
      locationId++;
    }
  }
  console.log(`Company locations seeded (${locationId - 1} locations)`);

  // 担当者のテストデータ（各企業に1-3名）
  const firstNames = ['太郎', '花子', '一郎', '美咲', '健太', '直樹', '恵', '拓也', '由美', '翔'];
  const lastNames = ['山田', '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '中村', '小林', '加藤'];
  const departments = ['人事部', '総務部', '営業部', '経営企画部', '経理部', '開発部', '代表'];

  let contactId = 1;
  for (let companyId = 1; companyId <= 50; companyId++) {
    const numContacts = randomInt(1, 3);
    for (let j = 0; j < numContacts; j++) {
      const isPrimary = j === 0;
      const lastName = lastNames[randomInt(0, lastNames.length - 1)];
      const firstName = firstNames[randomInt(0, firstNames.length - 1)];
      const department = departments[randomInt(0, departments.length - 1)];

      await prisma.stellaCompanyContact.upsert({
        where: { id: contactId },
        update: {},
        create: {
          companyId,
          name: `${lastName}${firstName}`,
          email: `${lastName.toLowerCase()}@company${companyId}.co.jp`,
          phone: `090-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`,
          department,
          isPrimary,
          note: isPrimary ? '採用担当責任者' : null,
        },
      });
      contactId++;
    }
  }
  console.log(`Company contacts seeded (${contactId - 1} contacts)`);

  // 代理店マスタのテストデータ（20社）
  // companyId 9-28 を代理店として使用
  const agentStatuses = ['アクティブ', '休止', '解約'];
  const category1Options = ['代理店', '顧問'];
  const contractStatusOptions = ['契約済み', '商談済み', '未商談', '日程調整中'];

  const agentCompanyIds = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];

  for (let i = 0; i < agentCompanyIds.length; i++) {
    const companyId = agentCompanyIds[i];
    await prisma.stpAgent.upsert({
      where: { companyId },
      update: {},
      create: {
        companyId,
        status: i < 15 ? 'アクティブ' : randomChoice(agentStatuses),
        category1: randomChoice(category1Options),
        contractStatus: randomChoice(contractStatusOptions),
        referrerCompanyId: i > 0 && Math.random() > 0.7 ? agentCompanyIds[randomInt(0, i - 1)] : null,
        note: `代理店テストデータ${i + 1}。${['IT業界に強い', '医療業界専門', '製造業中心', '関西エリア担当', '全国対応可能'][i % 5]}。`,
        minimumCases: randomChoice(category1Options) === '顧問' ? randomInt(3, 10) : null,
        monthlyFee: randomChoice(category1Options) === '顧問' ? randomInt(50, 200) * 1000 : null,
      },
    });
  }
  console.log('Agents seeded (20 agents)');

  // 代理店担当者の設定（StpAgentStaff中間テーブル）
  let agentStaffId = 1;
  for (let agentId = 1; agentId <= 20; agentId++) {
    // 各代理店に1-3名のスタッフを割り当て
    const numStaff = randomInt(1, 3);
    const assignedStaffIds = new Set<number>();

    for (let j = 0; j < numStaff; j++) {
      let staffId: number;
      do {
        staffId = randomInt(1, 15);
      } while (assignedStaffIds.has(staffId));
      assignedStaffIds.add(staffId);

      await prisma.stpAgentStaff.upsert({
        where: {
          agentId_staffId: { agentId, staffId },
        },
        update: {},
        create: { agentId, staffId },
      });
      agentStaffId++;
    }
  }
  console.log(`Agent staff assignments seeded (${agentStaffId - 1} assignments)`);

  // 代理店契約書のテストデータ（30件）
  const agentContractStatuses = ['draft', 'pending', 'signed', 'expired'];
  const contractTitles = ['業務委託基本契約書', '秘密保持契約書', '紹介手数料契約書', '代理店契約書', '顧問契約書'];

  for (let i = 1; i <= 30; i++) {
    const agentId = randomInt(1, 20);
    const status = randomChoice(agentContractStatuses);
    const isSigned = status === 'signed' || status === 'expired';

    await prisma.stpAgentContract.upsert({
      where: { id: i },
      update: {},
      create: {
        agentId,
        contractUrl: `https://cloudsign.example.com/contracts/agent-${agentId}-${i}`,
        signedDate: isSigned ? randomDate(new Date('2024-01-01'), new Date('2025-12-31')) : null,
        title: randomChoice(contractTitles),
        externalId: isSigned ? `CS-AGENT-${String(i).padStart(3, '0')}` : null,
        externalService: isSigned ? 'cloudsign' : null,
        status,
        note: status === 'pending' ? '署名待ち' : status === 'draft' ? '作成中' : null,
      },
    });
  }
  console.log('Agent contracts seeded (30 contracts)');

  // STPプロジェクト企業のテストデータ（80社）
  const forecasts = ['MIN', '落とし', 'MAX', '来月', '辞退'];
  const operationStatuses = ['テスト1', 'テスト2', null];
  const industryTypes = ['一般', '派遣'];
  const mediaOptions = ['Indeed', 'Wantedly', 'リクナビ', 'マイナビ', 'doda', null];
  const initialFees = [0, 100000, 150000];

  for (let i = 1; i <= 80; i++) {
    const companyId = i;
    const currentStageId = randomInt(1, 7);
    const isProgressStage = currentStageId >= 1 && currentStageId <= 4;

    // 進行中ステージの場合のみ目標を設定
    const hasTarget = isProgressStage && Math.random() > 0.3;
    const nextTargetStageId = hasTarget ? Math.min(currentStageId + 1, 5) : null;

    // 代理店経由かどうか（30%の確率で代理店経由）
    const hasAgent = Math.random() > 0.7;
    const agentId = hasAgent ? randomInt(1, 20) : null;

    // 日付生成
    const leadAcquiredDate = randomDate(new Date('2025-06-01'), new Date('2026-01-31'));
    const hasMeeting = currentStageId >= 2;
    const meetingDate = hasMeeting ? randomDate(leadAcquiredDate, new Date('2026-02-28')) : null;
    const hasKo = currentStageId >= 3 && Math.random() > 0.5;
    const firstKoDate = hasKo && meetingDate ? randomDate(meetingDate, new Date('2026-02-28')) : null;

    await prisma.stpCompany.upsert({
      where: { id: i },
      update: {},
      create: {
        companyId,
        agentId,
        currentStageId,
        nextTargetStageId,
        nextTargetDate: hasTarget ? randomDate(new Date('2026-02-01'), new Date('2026-04-30')) : null,
        leadAcquiredDate,
        meetingDate,
        firstKoDate,
        jobPostingStartDate: currentStageId >= 4 ? `2026-0${randomInt(1, 3)}-${randomInt(10, 28)}` : null,
        progressDetail: [
          'リード獲得。メール返信待ち。',
          '初回商談完了。ニーズヒアリング済み。',
          '提案書作成中。来週プレゼン予定。',
          '見積提示済み。決裁待ち。',
          '受注済み。契約手続き中。',
          '失注。競合に決定。',
          '検討中。予算調整中。',
        ][currentStageId - 1],
        forecast: isProgressStage ? randomChoice(forecasts) : null,
        operationStatus: currentStageId >= 4 ? randomChoice(operationStatuses) : null,
        industryType: randomChoice(industryTypes),
        plannedHires: randomInt(1, 30),
        leadSourceId: randomInt(1, 5),
        media: currentStageId >= 3 ? randomChoice(mediaOptions) : null,
        initialFee: currentStageId >= 4 ? randomChoice(initialFees) : null,
        monthlyFee: currentStageId >= 4 ? randomInt(3, 15) * 10000 : null,
        performanceFee: currentStageId >= 4 && Math.random() > 0.5 ? randomInt(2, 5) * 10000 : null,
        salesStaffId: randomInt(1, 15),
        operationStaffList: currentStageId >= 4 ? ['indeed', 'indeed,運用2', '運用2'][randomInt(0, 2)] : null,
        accountId: currentStageId >= 4 ? `account-${companyId}` : null,
        accountPass: currentStageId >= 4 ? `pass${randomInt(1000, 9999)}` : null,
        communicationMethodId: randomInt(1, 5),
        note: `STP企業テストデータ${i}。`,
        contractNote: currentStageId >= 4 ? `契約内容メモ${i}` : null,
        lostReason: currentStageId === 6 ? ['競合に決定', '予算不足', '時期尚早', '社内調整不可'][randomInt(0, 3)] : null,
        pendingReason: currentStageId === 7 ? ['予算調整中', '社内承認待ち', '人員確保待ち'][randomInt(0, 2)] : null,
      },
    });
  }
  console.log('STP Companies seeded (80 companies)');

  // STP企業契約書のテストデータ（100件）
  const companyContractStatuses = ['draft', '送付済み', '先方情報待ち', 'signed', 'expired'];
  const companyContractTitles = ['採用支援サービス利用契約書', '秘密保持契約書', '業務委託契約書', '求人広告掲載契約書', '成果報酬契約書'];

  for (let i = 1; i <= 100; i++) {
    const stpCompanyId = randomInt(1, 80);
    const status = randomChoice(companyContractStatuses);
    const isSigned = status === 'signed';

    await prisma.stpCompanyContract.upsert({
      where: { id: i },
      update: {},
      create: {
        stpCompanyId,
        contractUrl: status !== 'draft' ? `https://cloudsign.example.com/contracts/stp-${stpCompanyId}-${i}` : null,
        signedDate: isSigned ? randomDate(new Date('2025-01-01'), new Date('2026-01-31')) : null,
        title: randomChoice(companyContractTitles),
        externalId: status !== 'draft' ? `CS-STP-${String(i).padStart(4, '0')}` : null,
        externalService: status !== 'draft' ? 'cloudsign' : null,
        status,
        note: status === 'draft' ? '作成中' : status === '送付済み' ? '署名待ち' : null,
      },
    });
  }
  console.log('STP Company contracts seeded (100 contracts)');

  // 顧客種別マスタの初期データ（プロジェクトごと）（接触履歴より先に必要）
  const customerTypes = [
    // 採用ブースト（STP）
    { projectId: 1, name: '企業', displayOrder: 1 },
    { projectId: 1, name: '代理店', displayOrder: 2 },
    // コンサルティング
    { projectId: 2, name: 'クライアント', displayOrder: 1 },
    { projectId: 2, name: 'パートナー', displayOrder: 2 },
    { projectId: 2, name: '紹介元', displayOrder: 3 },
    // マーケティング支援
    { projectId: 3, name: '広告主', displayOrder: 1 },
    { projectId: 3, name: 'メディア', displayOrder: 2 },
    { projectId: 3, name: '代理店', displayOrder: 3 },
    // システム開発
    { projectId: 4, name: '発注元', displayOrder: 1 },
    { projectId: 4, name: '協力会社', displayOrder: 2 },
    { projectId: 4, name: 'ベンダー', displayOrder: 3 },
  ];

  for (let i = 0; i < customerTypes.length; i++) {
    await prisma.customerType.upsert({
      where: {
        projectId_name: {
          projectId: customerTypes[i].projectId,
          name: customerTypes[i].name,
        },
      },
      update: { displayOrder: customerTypes[i].displayOrder },
      create: customerTypes[i],
    });
  }
  console.log('Customer types seeded');

  // CustomerTypeのIDを動的に取得（接触履歴作成時に使用）
  const customerTypeCompany = await prisma.customerType.findUnique({
    where: { projectId_name: { projectId: 1, name: '企業' } },
  });
  const customerTypeAgent = await prisma.customerType.findUnique({
    where: { projectId_name: { projectId: 1, name: '代理店' } },
  });

  if (!customerTypeCompany || !customerTypeAgent) {
    throw new Error('CustomerType (企業/代理店) not found. Ensure customer types are seeded first.');
  }

  const CUSTOMER_TYPE_COMPANY_ID = customerTypeCompany.id;
  const CUSTOMER_TYPE_AGENT_ID = customerTypeAgent.id;
  console.log(`CustomerType IDs - 企業: ${CUSTOMER_TYPE_COMPANY_ID}, 代理店: ${CUSTOMER_TYPE_AGENT_ID}`);

  // STP企業のcompanyId一覧を取得（接触履歴を既存のSTP企業に限定するため）
  const stpCompanyRecords = await prisma.stpCompany.findMany({
    select: { companyId: true },
  });
  const validStpCompanyIds = stpCompanyRecords.map(c => c.companyId);
  console.log(`Valid STP company IDs: ${validStpCompanyIds.length} companies`);

  // 接触履歴のテストデータ（100件）
  const meetingMinutesTemplates = [
    'ヒアリングを実施。採用課題について詳細確認。',
    '提案内容について説明。前向きな反応あり。',
    '見積内容について質問あり。回答済み。',
    '契約条件について調整中。',
    '月次定例ミーティング。進捗共有。',
    '新規案件について相談。',
    '課題整理を実施。',
    'サービス説明を実施。興味を示している。',
    'フォローアップの電話。好感触。',
    '資料送付後の確認連絡。',
  ];

  const noteTemplates = [
    '60分のWeb会議を実施',
    '15分の電話',
    '90分の訪問商談',
    '45分のオンラインミーティング',
    'メールでの確認',
    '30分の電話会議',
    '資料送付',
    'フォローアップ連絡',
    '問い合わせ対応',
    '定期連絡',
  ];

  for (let i = 1; i <= 100; i++) {
    // 企業か代理店かランダムに決定
    const isAgent = Math.random() > 0.7;
    // companyIdを既存のSTP企業/代理店に限定
    const companyId = isAgent
      ? agentCompanyIds[randomInt(0, agentCompanyIds.length - 1)]  // 代理店のcompanyId
      : validStpCompanyIds[randomInt(0, validStpCompanyIds.length - 1)];  // STP企業のcompanyId

    // 動的に取得したcustomerTypeIdを使用
    const customerTypeId = isAgent ? CUSTOMER_TYPE_AGENT_ID : CUSTOMER_TYPE_COMPANY_ID;

    const historyData = {
      companyId,
      contactDate: randomDate(new Date('2025-06-01'), new Date('2026-01-31')),
      contactMethodId: randomInt(1, 5),
      staffId: randomInt(1, 15),
      assignedTo: String(randomInt(1, 15)),
      meetingMinutes: Math.random() > 0.3 ? randomChoice(meetingMinutesTemplates) : null,
      note: randomChoice(noteTemplates),
    };

    const history = await prisma.contactHistory.upsert({
      where: { id: i },
      update: {},
      create: historyData,
    });

    // 接触履歴ロールを作成
    await prisma.contactHistoryRole.upsert({
      where: {
        contactHistoryId_customerTypeId: {
          contactHistoryId: history.id,
          customerTypeId,
        },
      },
      update: {},
      create: {
        contactHistoryId: history.id,
        customerTypeId,
      },
    });
  }
  console.log('Contact histories seeded (100 histories)');

  // ステージ変更履歴のテストデータ（100件）
  const eventTypes = ['commit', 'achieved', 'recommit', 'progress', 'back', 'cancel'];
  const changedByNames = staffMembers.map(s => s.name);

  for (let i = 1; i <= 100; i++) {
    const stpCompanyId = randomInt(1, 80);
    const eventType = randomChoice(eventTypes);
    const fromStageId = randomInt(1, 7);
    let toStageId = fromStageId;

    switch (eventType) {
      case 'progress':
      case 'achieved':
        toStageId = Math.min(fromStageId + 1, 5);
        break;
      case 'back':
        toStageId = Math.max(fromStageId - 1, 1);
        break;
      case 'commit':
      case 'recommit':
        toStageId = Math.min(fromStageId + randomInt(1, 2), 5);
        break;
    }

    await prisma.stpStageHistory.upsert({
      where: { id: i },
      update: {},
      create: {
        stpCompanyId,
        eventType,
        fromStageId: eventType !== 'commit' ? fromStageId : null,
        toStageId,
        targetDate: ['commit', 'recommit'].includes(eventType)
          ? randomDate(new Date('2026-02-01'), new Date('2026-04-30'))
          : null,
        recordedAt: randomDate(new Date('2025-06-01'), new Date('2026-01-31')),
        changedBy: randomChoice(changedByNames),
        note: eventType === 'back' ? '戦略見直しのため' : null,
        lostReason: eventType === 'back' && toStageId === 6 ? '競合に決定' : null,
        pendingReason: eventType === 'back' && toStageId === 7 ? '予算調整中' : null,
      },
    });
  }
  console.log('Stage histories seeded (100 histories)');

  // 契約履歴のテストデータ（50件）
  const contractStatuses = ['active', 'cancelled', 'dormant'];
  const jobMediaOptions = ['Indeed', 'Wantedly', 'リクナビ', 'マイナビ'];

  for (let i = 1; i <= 50; i++) {
    const companyId = randomInt(1, 80);
    const startDate = randomDate(new Date('2024-01-01'), new Date('2025-12-31'));
    const isActive = Math.random() > 0.3;

    await prisma.stpContractHistory.upsert({
      where: { id: i },
      update: {},
      create: {
        companyId,
        industryType: randomChoice(['general', 'dispatch']),
        contractPlan: randomChoice(['monthly', 'performance']),
        jobMedia: randomChoice(jobMediaOptions),
        contractStartDate: startDate,
        contractEndDate: isActive ? null : randomDate(startDate, new Date('2026-01-31')),
        initialFee: randomChoice(initialFees),
        monthlyFee: randomInt(3, 15) * 10000,
        performanceFee: Math.random() > 0.5 ? randomInt(2, 5) * 10000 : 0,
        salesStaffId: randomInt(1, 15),
        operationStaffId: randomInt(1, 15),
        status: isActive ? 'active' : randomChoice(contractStatuses),
        note: `契約履歴テストデータ${i}`,
        operationStatus: randomChoice(operationStatuses),
        accountId: `acc-${companyId}-${i}`,
        accountPass: `pass${randomInt(1000, 9999)}`,
      },
    });
  }
  console.log('Contract histories seeded (50 histories)');

  // 契約書ステータスマスタの初期データ
  const masterContractStatuses = [
    { name: '雛形作成中', displayOrder: 1, isTerminal: false },
    { name: '内容確認中', displayOrder: 2, isTerminal: false },
    { name: '合意待ち', displayOrder: 3, isTerminal: false },
    { name: '修正対応中', displayOrder: 4, isTerminal: false },
    { name: '送付情報確認中', displayOrder: 5, isTerminal: false },
    { name: '送付済み', displayOrder: 6, isTerminal: false },
    { name: '締結済み', displayOrder: 7, isTerminal: true },
    { name: '破棄', displayOrder: 8, isTerminal: true },
  ];

  for (let i = 0; i < masterContractStatuses.length; i++) {
    await prisma.masterContractStatus.upsert({
      where: { id: i + 1 },
      update: {},
      create: masterContractStatuses[i],
    });
  }
  console.log('Contract statuses seeded');

  // 表示ビュー定義の初期データ（外部ユーザー向け画面）
  const displayViews = [
    {
      viewKey: 'stp_client',
      viewName: '採用ブースト（クライアント版）',
      projectCode: 'stp',
      description: 'クライアント企業が自社の採用ブーストデータを閲覧する画面',
    },
    {
      viewKey: 'stp_agent',
      viewName: '採用ブースト（紹介者版）',
      projectCode: 'stp',
      description: '紹介者（代理店）が紹介先企業の採用ブーストデータを閲覧する画面',
    },
    {
      viewKey: 'srd_agent',
      viewName: '開発（紹介者版）',
      projectCode: 'srd',
      description: '紹介者（代理店）が紹介先企業の開発データを閲覧する画面',
    },
  ];

  for (const view of displayViews) {
    await prisma.displayView.upsert({
      where: { viewKey: view.viewKey },
      update: { viewName: view.viewName, description: view.description },
      create: view,
    });
  }
  console.log('Display views seeded');

  console.log('');
  console.log('=== Seed Summary ===');
  console.log('Staff: 15 members');
  console.log('Companies: 100 companies');
  console.log('Company Locations: ~100 locations');
  console.log('Company Contacts: ~100 contacts');
  console.log('Agents: 20 agents');
  console.log('Agent Contracts: 30 contracts');
  console.log('STP Companies: 80 companies');
  console.log('STP Company Contracts: 100 contracts');
  console.log('Contact Histories: 100 histories');
  console.log('Stage Histories: 100 histories');
  console.log('Contract Histories: 50 histories');
  console.log('');
  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
