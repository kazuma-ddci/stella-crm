import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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

  // スタッフのテストデータ
  const staffMembers = [
    { name: '田中太郎', nameKana: 'タナカタロウ', email: 'tanaka@example.com', phone: '090-1111-1111', contractType: '正社員' },
    { name: '鈴木花子', nameKana: 'スズキハナコ', email: 'suzuki@example.com', phone: '090-2222-2222', contractType: '正社員' },
    { name: '山本次郎', nameKana: 'ヤマモトジロウ', email: 'yamamoto@example.com', phone: '090-3333-3333', contractType: '業務委託' },
  ];

  for (let i = 0; i < staffMembers.length; i++) {
    await prisma.masterStaff.upsert({
      where: { id: i + 1 },
      update: {},
      create: staffMembers[i],
    });
  }

  // スタッフ役割割当のテストデータ
  const staffRoleAssignments = [
    { staffId: 1, roleTypeId: 1 }, // 田中太郎 - AS
    { staffId: 1, roleTypeId: 2 }, // 田中太郎 - STP-運用
    { staffId: 2, roleTypeId: 2 }, // 鈴木花子 - STP-運用
    { staffId: 2, roleTypeId: 3 }, // 鈴木花子 - STP-CS
    { staffId: 3, roleTypeId: 1 }, // 山本次郎 - AS
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

  // 全顧客マスタのテストデータ（新カラム追加）
  const companies = [
    { companyCode: 'SC-1', name: '株式会社テックソリューション', websiteUrl: 'https://techsolution.co.jp', industry: 'IT・通信', revenueScale: '10億〜50億', note: '大手IT企業。DX推進に積極的。' },
    { companyCode: 'SC-2', name: '山田製造株式会社', websiteUrl: 'https://yamada-mfg.co.jp', industry: '製造業', revenueScale: '50億〜100億', note: '老舗製造業。工場のIoT化に興味あり。' },
    { companyCode: 'SC-3', name: 'グローバルトレード株式会社', websiteUrl: 'https://globaltrade.co.jp', industry: '商社', revenueScale: '100億以上', note: '総合商社。海外展開支援に関心。' },
    { companyCode: 'SC-4', name: 'メディカルケア株式会社', websiteUrl: 'https://medicalcare.co.jp', industry: '医療機器', revenueScale: '10億〜50億', note: '医療機器メーカー。人材採用に課題あり。' },
    { companyCode: 'SC-5', name: 'フードサービス株式会社', websiteUrl: 'https://foodservice.co.jp', industry: '外食', revenueScale: '50億〜100億', note: '外食チェーン。店舗スタッフの採用強化中。' },
    { companyCode: 'SC-6', name: 'エコエナジー株式会社', websiteUrl: 'https://ecoenergy.co.jp', industry: 'エネルギー', revenueScale: '10億未満', note: '再生可能エネルギー事業。急成長中。' },
    { companyCode: 'SC-7', name: 'ファイナンシャルパートナーズ', websiteUrl: 'https://finpartners.co.jp', industry: '金融', revenueScale: '10億〜50億', note: '投資顧問会社。若手人材を求めている。' },
    { companyCode: 'SC-8', name: 'クリエイティブデザイン株式会社', websiteUrl: 'https://creative-design.co.jp', industry: 'デザイン', revenueScale: '10億未満', note: 'デザイン会社。クリエイター採用に注力。' },
    // 代理店用の企業（SC-9〜SC-11）
    { companyCode: 'SC-9', name: 'ABCエージェント', websiteUrl: 'https://abc-agent.co.jp', industry: '人材サービス', revenueScale: '10億未満', note: '人材紹介代理店。IT業界に強い。' },
    { companyCode: 'SC-10', name: 'XYZパートナーズ', websiteUrl: 'https://xyz-partners.co.jp', industry: '人材サービス', revenueScale: '10億未満', note: '人材紹介代理店。医療・ヘルスケア業界専門。' },
    { companyCode: 'SC-11', name: 'グローバルリクルート', websiteUrl: 'https://global-recruit.co.jp', industry: '人材サービス', revenueScale: '10億〜50億', note: '人材紹介代理店。関西エリア中心。製造業に強み。' },
  ];

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

  // 企業拠点のテストデータ
  const companyLocations = [
    // SC-1: 株式会社テックソリューション
    { companyId: 1, name: '本社', address: '東京都千代田区丸の内1-1-1', phone: '03-1234-5678', email: 'info@techsolution.co.jp', isPrimary: true, note: null },
    { companyId: 1, name: '大阪支社', address: '大阪府大阪市北区梅田2-2-2', phone: '06-1234-5678', email: 'osaka@techsolution.co.jp', isPrimary: false, note: null },
    // SC-2: 山田製造株式会社
    { companyId: 2, name: '本社工場', address: '大阪府大阪市北区梅田2-2-2', phone: '06-2345-6789', email: 'contact@yamada-mfg.co.jp', isPrimary: true, note: '本社併設の主力工場' },
    // SC-3: グローバルトレード株式会社
    { companyId: 3, name: '本社', address: '東京都中央区銀座3-3-3', phone: '03-3456-7890', email: 'info@globaltrade.co.jp', isPrimary: true, note: null },
    { companyId: 3, name: '名古屋支店', address: '愛知県名古屋市中区栄4-4-4', phone: '052-3456-7890', email: 'nagoya@globaltrade.co.jp', isPrimary: false, note: null },
    // SC-4: メディカルケア株式会社
    { companyId: 4, name: '本社', address: '神奈川県横浜市中区1-2-3', phone: '045-456-7890', email: 'info@medicalcare.co.jp', isPrimary: true, note: null },
    // SC-5: フードサービス株式会社
    { companyId: 5, name: '本社', address: '福岡県福岡市博多区4-4-4', phone: '092-567-8901', email: 'hr@foodservice.co.jp', isPrimary: true, note: null },
    // SC-6: エコエナジー株式会社
    { companyId: 6, name: '本社', address: '愛知県名古屋市中区5-5-5', phone: '052-678-9012', email: 'contact@ecoenergy.co.jp', isPrimary: true, note: null },
    // SC-7: ファイナンシャルパートナーズ
    { companyId: 7, name: '本社', address: '東京都港区六本木6-6-6', phone: '03-4567-8901', email: 'info@finpartners.co.jp', isPrimary: true, note: null },
    // SC-8: クリエイティブデザイン株式会社
    { companyId: 8, name: '本社', address: '東京都渋谷区神宮前7-7-7', phone: '03-5678-9012', email: 'hello@creative-design.co.jp', isPrimary: true, note: null },
    // SC-9: ABCエージェント
    { companyId: 9, name: '本社', address: '東京都新宿区西新宿8-8-8', phone: '03-1111-2222', email: 'info@abc-agent.co.jp', isPrimary: true, note: null },
    // SC-10: XYZパートナーズ
    { companyId: 10, name: '本社', address: '東京都品川区東品川9-9-9', phone: '03-3333-4444', email: 'info@xyz-partners.co.jp', isPrimary: true, note: null },
    // SC-11: グローバルリクルート
    { companyId: 11, name: '本社', address: '大阪府大阪市中央区本町10-10-10', phone: '06-5555-6666', email: 'info@global-recruit.co.jp', isPrimary: true, note: null },
  ];

  for (let i = 0; i < companyLocations.length; i++) {
    const location = companyLocations[i];
    await prisma.stellaCompanyLocation.upsert({
      where: { id: i + 1 },
      update: {},
      create: location,
    });
  }

  // 担当者のテストデータ（addressを削除）
  const companyContacts = [
    // SC-1: 株式会社テックソリューション
    { companyId: 1, name: '山田太郎', email: 'yamada@techsolution.co.jp', phone: '03-1234-5678', department: '人事部', isPrimary: true, note: '採用担当部長' },
    { companyId: 1, name: '田村花子', email: 'tamura@techsolution.co.jp', phone: '03-1234-5679', department: '人事部', isPrimary: false, note: '採用担当' },
    // SC-2: 山田製造株式会社
    { companyId: 2, name: '佐藤花子', email: 'sato@yamada-mfg.co.jp', phone: '06-2345-6789', department: '総務部', isPrimary: true, note: '採用責任者' },
    // SC-3: グローバルトレード株式会社
    { companyId: 3, name: '鈴木一郎', email: 'suzuki@globaltrade.co.jp', phone: '03-3456-7890', department: '経営企画部', isPrimary: true, note: null },
    { companyId: 3, name: '高橋二郎', email: 'takahashi@globaltrade.co.jp', phone: '03-3456-7891', department: '人事部', isPrimary: false, note: '採用窓口' },
    // SC-4: メディカルケア株式会社
    { companyId: 4, name: '高橋美咲', email: 'takahashi-m@medicalcare.co.jp', phone: '045-456-7890', department: '人事部', isPrimary: true, note: '人事部長' },
    // SC-5: フードサービス株式会社
    { companyId: 5, name: '田中健太', email: 'tanaka@foodservice.co.jp', phone: '092-567-8901', department: '人事部', isPrimary: true, note: null },
    // SC-6: エコエナジー株式会社
    { companyId: 6, name: '伊藤直樹', email: 'ito@ecoenergy.co.jp', phone: '052-678-9012', department: '経営企画室', isPrimary: true, note: '代表取締役' },
    // SC-7: ファイナンシャルパートナーズ
    { companyId: 7, name: '渡辺恵', email: 'watanabe@finpartners.co.jp', phone: '03-4567-8901', department: '人事総務部', isPrimary: true, note: null },
    // SC-8: クリエイティブデザイン株式会社
    { companyId: 8, name: '中村拓也', email: 'nakamura@creative-design.co.jp', phone: '03-5678-9012', department: '代表', isPrimary: true, note: '代表取締役' },
    // SC-9: ABCエージェント
    { companyId: 9, name: '木村一郎', email: 'kimura@abc-agent.co.jp', phone: '03-1111-2222', department: '営業部', isPrimary: true, note: '営業部長' },
    // SC-10: XYZパートナーズ
    { companyId: 10, name: '小林美香', email: 'kobayashi@xyz-partners.co.jp', phone: '03-3333-4444', department: '代表', isPrimary: true, note: '代表取締役' },
    // SC-11: グローバルリクルート
    { companyId: 11, name: '斎藤健', email: 'saito@global-recruit.co.jp', phone: '06-5555-6666', department: '営業本部', isPrimary: true, note: '営業本部長' },
  ];

  for (let i = 0; i < companyContacts.length; i++) {
    const contact = companyContacts[i];
    await prisma.stellaCompanyContact.upsert({
      where: { id: i + 1 },
      update: {},
      create: contact,
    });
  }

  // 代理店マスタのテストデータ（MasterStellaCompanyと連携）
  const agents = [
    {
      companyId: 9, // ABCエージェント
      status: 'アクティブ',
      category1: '代理店',
      category2: '法人',
      meetingDate: new Date('2025-06-15'),
      contractStatus: '契約済み',
      contractNote: '基本契約締結済み。成果報酬型。',
      referrerCompanyId: null,
      note: '主要パートナー。IT業界に強い。',
    },
    {
      companyId: 10, // XYZパートナーズ
      status: 'アクティブ',
      category1: '代理店',
      category2: '法人',
      meetingDate: new Date('2025-08-01'),
      contractStatus: '契約済み',
      contractNote: '月額固定+成果報酬型。',
      referrerCompanyId: 9, // ABCエージェントからの紹介
      note: '医療・ヘルスケア業界専門。',
    },
    {
      companyId: 11, // グローバルリクルート
      status: '休止',
      category1: '顧問',
      category2: '個人',
      meetingDate: new Date('2025-10-20'),
      contractStatus: '商談済み',
      contractNote: '契約条件を調整中。',
      referrerCompanyId: null,
      note: '関西エリア中心。製造業に強み。',
    },
  ];

  for (let i = 0; i < agents.length; i++) {
    await prisma.stpAgent.upsert({
      where: { companyId: agents[i].companyId },
      update: {},
      create: agents[i],
    });
  }

  // 代理店担当者の設定（StpAgentStaff中間テーブル）
  const agentStaffAssignments = [
    { agentId: 1, staffId: 1 }, // ABCエージェント - 田中太郎
    { agentId: 1, staffId: 2 }, // ABCエージェント - 鈴木花子
    { agentId: 2, staffId: 1 }, // XYZパートナーズ - 田中太郎
    { agentId: 3, staffId: 3 }, // グローバルリクルート - 山本次郎
  ];

  for (let i = 0; i < agentStaffAssignments.length; i++) {
    const assignment = agentStaffAssignments[i];
    await prisma.stpAgentStaff.upsert({
      where: {
        agentId_staffId: {
          agentId: assignment.agentId,
          staffId: assignment.staffId,
        },
      },
      update: {},
      create: assignment,
    });
  }

  // 代理店契約書のテストデータ
  const agentContracts = [
    {
      agentId: 1,
      contractUrl: 'https://cloudsign.example.com/contracts/abc-001',
      signedDate: new Date('2025-07-01'),
      title: '業務委託基本契約書',
      externalId: 'CS-ABC-001',
      externalService: 'cloudsign',
      status: 'signed',
      note: '2025年度契約',
    },
    {
      agentId: 1,
      contractUrl: 'https://cloudsign.example.com/contracts/abc-002',
      signedDate: new Date('2025-07-01'),
      title: '秘密保持契約書',
      externalId: 'CS-ABC-002',
      externalService: 'cloudsign',
      status: 'signed',
      note: null,
    },
    {
      agentId: 2,
      contractUrl: 'https://cloudsign.example.com/contracts/xyz-001',
      signedDate: new Date('2025-08-15'),
      title: '業務委託基本契約書',
      externalId: 'CS-XYZ-001',
      externalService: 'cloudsign',
      status: 'signed',
      note: null,
    },
    {
      agentId: 3,
      contractUrl: 'https://example.com/drafts/global-001',
      signedDate: null,
      title: '業務委託基本契約書（案）',
      externalId: null,
      externalService: null,
      status: 'pending',
      note: '署名待ち',
    },
  ];

  for (let i = 0; i < agentContracts.length; i++) {
    await prisma.stpAgentContract.upsert({
      where: { id: i + 1 },
      update: {},
      create: agentContracts[i],
    });
  }

  // STPプロジェクト企業のテストデータ
  const stpCompanies = [
    {
      companyId: 1,
      agentId: 1,
      currentStageId: 3,
      nextTargetStageId: 4,
      nextTargetDate: new Date('2026-02-15'),
      leadAcquiredDate: new Date('2026-01-05'),
      meetingDate: new Date('2026-01-15'),
      firstKoDate: new Date('2026-01-20'),
      jobPostingStartDate: '2026-01-25',
      progressDetail: '提案書作成中。来週プレゼン予定。',
      forecast: 'MAX',
      operationStatus: 'テスト1',
      industryType: '一般',
      plannedHires: 5,
      leadSourceId: 1,
      media: 'Indeed',
      initialFee: 100000,
      monthlyFee: 50000,
      performanceFee: 0,
      salesStaffId: 1,
      operationStaffList: 'indeed,運用2',
      accountId: 'tech-sol-001',
      accountPass: 'pass1234',
      jobInfoFolderLink: 'https://drive.google.com/folder/tech-solution',
      operationReportLink: 'https://docs.google.com/spreadsheets/tech-solution',
      proposalLink: 'https://docs.google.com/presentation/tech-solution',
      billingLocationId: 1,
      billingContactId: 1,
      billingCompanyName: '株式会社テックソリューション',
      billingAddress: '東京都千代田区丸の内1-1-1',
      billingRepresentative: '山田太郎',
      billingEmail: 'billing@techsolution.co.jp',
      paymentTerms: '月末締め翌月末払い',
      communicationMethodId: 1,
      note: 'DX推進に積極的な企業',
      contractNote: '初期費用10万円、月額5万円',
    },
    {
      companyId: 2,
      agentId: 3,
      currentStageId: 2,
      nextTargetStageId: 3,
      nextTargetDate: new Date('2026-02-28'),
      leadAcquiredDate: new Date('2026-01-10'),
      meetingDate: new Date('2026-01-20'),
      firstKoDate: null,
      jobPostingStartDate: null,
      progressDetail: '初回商談完了。ニーズヒアリング済み。',
      forecast: '来月',
      operationStatus: null,
      industryType: '一般',
      plannedHires: 10,
      leadSourceId: 2,
      communicationMethodId: 3,
      note: '工場のIoT化に興味あり',
    },
    {
      companyId: 3,
      agentId: null,
      currentStageId: 1,
      nextTargetStageId: 2,
      nextTargetDate: new Date('2026-03-10'),
      leadAcquiredDate: new Date('2026-01-25'),
      meetingDate: null,
      progressDetail: 'リード獲得。メール返信待ち。',
      forecast: 'MIN',
      operationStatus: null,
      industryType: '一般',
      plannedHires: 3,
      leadSourceId: 3,
      communicationMethodId: 2,
      note: '海外展開支援に関心',
    },
    {
      companyId: 4,
      agentId: 2,
      currentStageId: 4,
      nextTargetStageId: 5,
      nextTargetDate: new Date('2026-02-10'),
      leadAcquiredDate: new Date('2025-12-01'),
      meetingDate: new Date('2025-12-15'),
      firstKoDate: new Date('2026-01-05'),
      jobPostingStartDate: '2026-01-10',
      progressDetail: '見積提示済み。決裁待ち。',
      forecast: 'MAX',
      operationStatus: 'テスト2',
      industryType: '一般',
      plannedHires: 8,
      leadSourceId: 2,
      media: 'Indeed',
      initialFee: 150000,
      monthlyFee: 0,
      performanceFee: 30000,
      salesStaffId: 1,
      operationStaffList: 'indeed',
      accountId: 'medical-care-001',
      accountPass: 'medpass456',
      billingLocationId: 6,
      billingContactId: 6,
      billingCompanyName: 'メディカルケア株式会社',
      billingAddress: '神奈川県横浜市中区1-2-3',
      billingRepresentative: '高橋美咲',
      billingEmail: 'billing@medicalcare.co.jp',
      paymentTerms: '月末締め翌々月末払い',
      communicationMethodId: 2,
      note: '人材採用に課題あり',
      contractNote: '成果報酬型プラン',
    },
    {
      companyId: 5,
      agentId: null,
      currentStageId: 2,
      nextTargetStageId: 3,
      nextTargetDate: new Date('2026-02-20'),
      leadAcquiredDate: new Date('2026-01-08'),
      meetingDate: new Date('2026-01-18'),
      progressDetail: '2回目商談予定。',
      forecast: '来月',
      operationStatus: null,
      industryType: '派遣',
      plannedHires: 20,
      leadSourceId: 4,
      communicationMethodId: 4,
      note: '店舗スタッフの採用強化中',
    },
    {
      companyId: 6,
      agentId: null,
      currentStageId: 1,
      nextTargetStageId: 2,
      nextTargetDate: new Date('2026-03-01'),
      leadAcquiredDate: new Date('2026-01-20'),
      meetingDate: null,
      progressDetail: '問い合わせ対応中。',
      forecast: 'MIN',
      operationStatus: null,
      industryType: '一般',
      plannedHires: 2,
      leadSourceId: 5,
      communicationMethodId: 2,
      note: '再生可能エネルギー事業。急成長中。',
    },
  ];

  for (let i = 0; i < stpCompanies.length; i++) {
    await prisma.stpCompany.upsert({
      where: { id: i + 1 },
      update: {},
      create: stpCompanies[i],
    });
  }

  // プロジェクトマスタの初期データ（接触履歴より先に必要）
  const projects = [
    { name: '採用ブースト', description: '採用支援サービス（STP）', displayOrder: 1 },
    { name: 'コンサルティング', description: '経営・業務コンサルティングサービス', displayOrder: 2 },
    { name: 'マーケティング支援', description: '広告・マーケティング支援サービス', displayOrder: 3 },
    { name: 'システム開発', description: 'システム開発・DX支援サービス', displayOrder: 4 },
  ];

  for (let i = 0; i < projects.length; i++) {
    await prisma.masterProject.upsert({
      where: { id: i + 1 },
      update: { name: projects[i].name, description: projects[i].description, displayOrder: projects[i].displayOrder },
      create: projects[i],
    });
  }

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

  // 接触履歴のテストデータ（企業）- 新構造
  // companyId: MasterStellaCompany.id を直接参照
  // customerTypeId: 1=企業, 2=代理店（採用ブーストの場合）
  const companyContactHistories = [
    { companyId: 1, contactDate: new Date('2026-01-20T10:00:00'), contactMethodId: 4, assignedTo: '1', meetingMinutes: 'DX推進の課題についてヒアリング。採用計画について詳細確認。', note: '60分のWeb会議を実施', customerTypeId: 1 },
    { companyId: 1, contactDate: new Date('2026-01-25T14:30:00'), contactMethodId: 2, assignedTo: '1', meetingMinutes: null, note: '提案書のドラフトを送付', customerTypeId: 1 },
    { companyId: 2, contactDate: new Date('2026-01-15T13:00:00'), contactMethodId: 3, assignedTo: '2', meetingMinutes: '工場見学を実施。現場の課題を確認。', note: '90分の訪問商談', customerTypeId: 1 },
    { companyId: 4, contactDate: new Date('2026-01-28T11:00:00'), contactMethodId: 1, assignedTo: '1', meetingMinutes: null, note: '見積内容について質問あり。回答済み。15分の電話', customerTypeId: 1 },
    { companyId: 5, contactDate: new Date('2026-01-22T15:00:00'), contactMethodId: 4, assignedTo: '2', meetingMinutes: '人事部長と面談。採用課題について議論。', note: '45分のWeb会議', customerTypeId: 1 },
  ];

  // 接触履歴のテストデータ（代理店）- 新構造
  // 代理店はMasterStellaCompanyと1:1で紐づいている（SC-9, SC-10, SC-11）
  const agentContactHistories = [
    { companyId: 9, contactDate: new Date('2026-01-10T10:00:00'), contactMethodId: 4, assignedTo: '1', meetingMinutes: '今月の案件状況について共有。3件の新規リード紹介あり。', note: '月次定例ミーティング', customerTypeId: 2 },
    { companyId: 10, contactDate: new Date('2026-01-18T14:00:00'), contactMethodId: 1, assignedTo: '1', meetingMinutes: null, note: 'メディカルケア社の進捗確認', customerTypeId: 2 },
    { companyId: 11, contactDate: new Date('2026-01-22T11:00:00'), contactMethodId: 2, assignedTo: '2', meetingMinutes: null, note: '新規案件の提案依頼メール', customerTypeId: 2 },
  ];

  const allContactHistories = [...companyContactHistories, ...agentContactHistories];
  for (let i = 0; i < allContactHistories.length; i++) {
    const { customerTypeId, ...historyData } = allContactHistories[i];

    // 接触履歴を作成
    const history = await prisma.contactHistory.upsert({
      where: { id: i + 1 },
      update: {},
      create: historyData,
    });

    // 接触履歴ロールを作成（プロジェクト×顧客種別の紐付け）
    await prisma.contactHistoryRole.upsert({
      where: {
        contactHistoryId_customerTypeId: {
          contactHistoryId: history.id,
          customerTypeId: customerTypeId,
        },
      },
      update: {},
      create: {
        contactHistoryId: history.id,
        customerTypeId: customerTypeId,
      },
    });
  }

  // 契約書ステータスマスタの初期データ
  const contractStatuses = [
    { name: '雛形作成中', displayOrder: 1, isTerminal: false },
    { name: '内容確認中', displayOrder: 2, isTerminal: false },
    { name: '合意待ち', displayOrder: 3, isTerminal: false },
    { name: '修正対応中', displayOrder: 4, isTerminal: false },
    { name: '送付情報確認中', displayOrder: 5, isTerminal: false },
    { name: '送付済み', displayOrder: 6, isTerminal: false },
    { name: '締結済み', displayOrder: 7, isTerminal: true },
    { name: '破棄', displayOrder: 8, isTerminal: true },
  ];

  for (let i = 0; i < contractStatuses.length; i++) {
    await prisma.masterContractStatus.upsert({
      where: { id: i + 1 },
      update: {},
      create: contractStatuses[i],
    });
  }

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
