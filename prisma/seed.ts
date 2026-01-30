import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 商談ステージの初期データ
  const stages = [
    { name: 'リード', displayOrder: 1 },
    { name: '商談化', displayOrder: 2 },
    { name: '提案中', displayOrder: 3 },
    { name: '見積提示', displayOrder: 4 },
    { name: '受注', displayOrder: 5 },
    { name: '失注', displayOrder: 6 },
    { name: '検討中', displayOrder: 7 },
  ];

  for (const stage of stages) {
    await prisma.stpStage.upsert({
      where: { id: stages.indexOf(stage) + 1 },
      update: {},
      create: stage,
    });
  }

  // 接触方法の初期データ
  const contactMethods = [
    { name: '電話', displayOrder: 1 },
    { name: 'メール', displayOrder: 2 },
    { name: '訪問', displayOrder: 3 },
    { name: 'Web会議', displayOrder: 4 },
    { name: 'その他', displayOrder: 5 },
  ];

  for (const method of contactMethods) {
    await prisma.stpContactMethod.upsert({
      where: { id: contactMethods.indexOf(method) + 1 },
      update: {},
      create: method,
    });
  }

  // 代理店マスタのテストデータ
  const agents = [
    { agentCode: 'SA-1', name: 'ABCエージェント', contactPerson: '木村一郎', email: 'kimura@abc-agent.co.jp', phone: '03-1111-2222', note: '主要パートナー。IT業界に強い。' },
    { agentCode: 'SA-2', name: 'XYZパートナーズ', contactPerson: '小林美香', email: 'kobayashi@xyz-partners.co.jp', phone: '03-3333-4444', note: '医療・ヘルスケア業界専門。' },
    { agentCode: 'SA-3', name: 'グローバルリクルート', contactPerson: '斎藤健', email: 'saito@global-recruit.co.jp', phone: '06-5555-6666', note: '関西エリア中心。製造業に強み。' },
  ];

  for (const agent of agents) {
    await prisma.stpAgent.upsert({
      where: { agentCode: agent.agentCode },
      update: {},
      create: agent,
    });
  }

  // 全顧客マスタのテストデータ
  const companies = [
    { companyCode: 'SC-1', name: '株式会社テックソリューション', contactPerson: '山田太郎', email: 'info@techsolution.co.jp', phone: '03-1234-5678', note: '大手IT企業。DX推進に積極的。' },
    { companyCode: 'SC-2', name: '山田製造株式会社', contactPerson: '佐藤花子', email: 'contact@yamada-mfg.co.jp', phone: '06-2345-6789', note: '老舗製造業。工場のIoT化に興味あり。' },
    { companyCode: 'SC-3', name: 'グローバルトレード株式会社', contactPerson: '鈴木一郎', email: 'sales@globaltrade.co.jp', phone: '03-3456-7890', note: '総合商社。海外展開支援に関心。' },
    { companyCode: 'SC-4', name: 'メディカルケア株式会社', contactPerson: '高橋美咲', email: 'info@medicalcare.co.jp', phone: '045-456-7890', note: '医療機器メーカー。人材採用に課題あり。' },
    { companyCode: 'SC-5', name: 'フードサービス株式会社', contactPerson: '田中健太', email: 'hr@foodservice.co.jp', phone: '092-567-8901', note: '外食チェーン。店舗スタッフの採用強化中。' },
    { companyCode: 'SC-6', name: 'エコエナジー株式会社', contactPerson: '伊藤直樹', email: 'contact@ecoenergy.co.jp', phone: '052-678-9012', note: '再生可能エネルギー事業。急成長中。' },
    { companyCode: 'SC-7', name: 'ファイナンシャルパートナーズ', contactPerson: '渡辺恵', email: 'info@finpartners.co.jp', phone: '03-4567-8901', note: '投資顧問会社。若手人材を求めている。' },
    { companyCode: 'SC-8', name: 'クリエイティブデザイン株式会社', contactPerson: '中村拓也', email: 'hello@creative-design.co.jp', phone: '03-5678-9012', note: 'デザイン会社。クリエイター採用に注力。' },
  ];

  for (const company of companies) {
    await prisma.masterStellaCompany.upsert({
      where: { companyCode: company.companyCode },
      update: {},
      create: company,
    });
  }

  // STPプロジェクト企業のテストデータ
  const stpCompanies = [
    { companyId: 1, currentStageId: 3, nextTargetStageId: 4, nextTargetDate: new Date('2026-02-15'), leadAcquiredDate: new Date('2026-01-05'), meetingDate: new Date('2026-01-15'), assignedTo: '田中太郎', priority: '高', agentId: 1, note: '提案書作成中。来週プレゼン予定。' },
    { companyId: 2, currentStageId: 2, nextTargetStageId: 3, nextTargetDate: new Date('2026-02-28'), leadAcquiredDate: new Date('2026-01-10'), meetingDate: new Date('2026-01-20'), assignedTo: '鈴木花子', priority: '中', agentId: 3, note: '初回商談完了。ニーズヒアリング済み。' },
    { companyId: 3, currentStageId: 1, nextTargetStageId: 2, nextTargetDate: new Date('2026-03-10'), leadAcquiredDate: new Date('2026-01-25'), meetingDate: null, assignedTo: '佐藤一郎', priority: '低', agentId: null, note: 'リード獲得。メール返信待ち。' },
    { companyId: 4, currentStageId: 4, nextTargetStageId: 5, nextTargetDate: new Date('2026-02-10'), leadAcquiredDate: new Date('2025-12-01'), meetingDate: new Date('2025-12-15'), assignedTo: '田中太郎', priority: '高', agentId: 2, note: '見積提示済み。決裁待ち。' },
    { companyId: 5, currentStageId: 2, nextTargetStageId: 3, nextTargetDate: new Date('2026-02-20'), leadAcquiredDate: new Date('2026-01-08'), meetingDate: new Date('2026-01-18'), assignedTo: '鈴木花子', priority: '中', agentId: null, note: '2回目商談予定。' },
    { companyId: 6, currentStageId: 1, nextTargetStageId: 2, nextTargetDate: new Date('2026-03-01'), leadAcquiredDate: new Date('2026-01-20'), meetingDate: null, assignedTo: '山本次郎', priority: '中', agentId: null, note: '問い合わせ対応中。' },
  ];

  for (let i = 0; i < stpCompanies.length; i++) {
    await prisma.stpCompany.upsert({
      where: { id: i + 1 },
      update: {},
      create: stpCompanies[i],
    });
  }

  // 接触履歴のテストデータ（企業）
  const companyContacts = [
    { stpCompanyId: 1, agentId: null, contactDate: new Date('2026-01-20T10:00:00'), contactMethodId: 4, assignedTo: '田中太郎', meetingMinutes: 'DX推進の課題についてヒアリング。採用計画について詳細確認。', note: '60分のWeb会議を実施' },
    { stpCompanyId: 1, agentId: null, contactDate: new Date('2026-01-25T14:30:00'), contactMethodId: 2, assignedTo: '田中太郎', meetingMinutes: null, note: '提案書のドラフトを送付' },
    { stpCompanyId: 2, agentId: null, contactDate: new Date('2026-01-15T13:00:00'), contactMethodId: 3, assignedTo: '鈴木花子', meetingMinutes: '工場見学を実施。現場の課題を確認。', note: '90分の訪問商談' },
    { stpCompanyId: 4, agentId: null, contactDate: new Date('2026-01-28T11:00:00'), contactMethodId: 1, assignedTo: '田中太郎', meetingMinutes: null, note: '見積内容について質問あり。回答済み。15分の電話' },
    { stpCompanyId: 5, agentId: null, contactDate: new Date('2026-01-22T15:00:00'), contactMethodId: 4, assignedTo: '鈴木花子', meetingMinutes: '人事部長と面談。採用課題について議論。', note: '45分のWeb会議' },
  ];

  // 接触履歴のテストデータ（代理店）
  const agentContacts = [
    { stpCompanyId: null, agentId: 1, contactDate: new Date('2026-01-10T10:00:00'), contactMethodId: 4, assignedTo: '田中太郎', meetingMinutes: '今月の案件状況について共有。3件の新規リード紹介あり。', note: '月次定例ミーティング' },
    { stpCompanyId: null, agentId: 2, contactDate: new Date('2026-01-18T14:00:00'), contactMethodId: 1, assignedTo: '田中太郎', meetingMinutes: null, note: 'メディカルケア社の進捗確認' },
    { stpCompanyId: null, agentId: 3, contactDate: new Date('2026-01-22T11:00:00'), contactMethodId: 2, assignedTo: '鈴木花子', meetingMinutes: null, note: '新規案件の提案依頼メール' },
  ];

  const allContacts = [...companyContacts, ...agentContacts];
  for (let i = 0; i < allContacts.length; i++) {
    await prisma.stpContactHistory.upsert({
      where: { id: i + 1 },
      update: {},
      create: allContacts[i],
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
