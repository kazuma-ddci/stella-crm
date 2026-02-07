/**
 * 本番環境初期化用シード
 *
 * 投入内容：
 * - システムユーザー3名（admin, test_user, stella001）+ 権限
 * - 接触方法マスタ 5件
 * - 契約ステータスマスタ 8件
 *
 * 実行方法：
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-prod.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// システム管理者用パスワードハッシュ（bcrypt一方向ハッシュ、復元不可）
const SYSTEM_ADMIN_HASH = '$2b$10$5oyNNVor8xnqPL0O2QMpMOxXrO.dXO6Q5Mxt9yj04lsBnxt5G81Z.';
const SYSTEM_TEST_HASH = '$2b$10$BhWcBuEJ4k1I0Iq0jbDbJOlK8UrZ.YuZ5TCfoJpF/eYWeeiFi/vU6';
const STELLA001_HASH = '$2b$10$1f0KgxORLo8aJzsCECaBveCTt.bfgLNNFd1L6jiwZo8FKuFfVvYam';

async function main() {
  console.log('=== 本番環境 初期データ投入 ===\n');

  // ============================================
  // 1. システムユーザー（3名）
  // ============================================

  const existingStaff = await prisma.masterStaff.findFirst({
    where: { loginId: 'admin' },
  });

  if (existingStaff) {
    console.log('⚠ システムユーザーは既に存在します。スキップします。');
  } else {
    await prisma.masterStaff.createMany({
      data: [
        {
          name: 'システム管理者',
          nameKana: 'システムカンリシャ',
          email: 'sysadmin@stella-crm.local',
          loginId: 'admin',
          passwordHash: SYSTEM_ADMIN_HASH,
          contractType: '正社員',
          isSystemUser: true,
        },
        {
          name: 'テストユーザー',
          nameKana: 'テストユーザー',
          email: 'testuser@stella-crm.local',
          loginId: 'test_user',
          passwordHash: SYSTEM_TEST_HASH,
          contractType: '正社員',
          isSystemUser: true,
        },
        {
          name: '固定データ管理者',
          nameKana: 'コテイデータカンリシャ',
          email: 'stella001@stella-crm.local',
          loginId: 'stella001',
          passwordHash: STELLA001_HASH,
          contractType: '正社員',
          canEditMasterData: true,
          isSystemUser: true,
        },
      ],
    });

    // 権限を設定（admin, test_user は全プロジェクトadmin）
    const adminUser = await prisma.masterStaff.findUnique({ where: { loginId: 'admin' } });
    const testUser = await prisma.masterStaff.findUnique({ where: { loginId: 'test_user' } });

    if (adminUser && testUser) {
      const permissionData = [];
      for (const staffId of [adminUser.id, testUser.id]) {
        for (const projectCode of ['stella', 'stp', 'srd', 'slo']) {
          permissionData.push({ staffId, projectCode, permissionLevel: 'admin' });
        }
      }
      await prisma.staffPermission.createMany({ data: permissionData });
    }

    console.log('✓ システムユーザー 3名 + 権限');
  }

  // ============================================
  // 2. 接触方法マスタ（5件）
  // ============================================

  const existingContactMethods = await prisma.contactMethod.count();
  if (existingContactMethods > 0) {
    console.log('⚠ 接触方法は既に存在します。スキップします。');
  } else {
    await prisma.contactMethod.createMany({
      data: [
        { name: '電話', displayOrder: 1 },
        { name: 'メール', displayOrder: 2 },
        { name: '訪問', displayOrder: 3 },
        { name: 'Web会議', displayOrder: 4 },
        { name: 'その他', displayOrder: 5 },
      ],
    });
    console.log('✓ 接触方法 5件');
  }

  // ============================================
  // 3. 契約ステータスマスタ（8件）
  // ============================================

  const existingStatuses = await prisma.masterContractStatus.count();
  if (existingStatuses > 0) {
    console.log('⚠ 契約ステータスは既に存在します。スキップします。');
  } else {
    await prisma.masterContractStatus.createMany({
      data: [
        { name: '雛形作成中', displayOrder: 1, isTerminal: false },
        { name: '内容確認中', displayOrder: 2, isTerminal: false },
        { name: '合意待ち', displayOrder: 3, isTerminal: false },
        { name: '修正対応中', displayOrder: 4, isTerminal: false },
        { name: '送付情報確認中', displayOrder: 5, isTerminal: false },
        { name: '送付済み', displayOrder: 6, isTerminal: false },
        { name: '締結済み', displayOrder: 7, isTerminal: true },
        { name: '破棄', displayOrder: 8, isTerminal: true },
      ],
    });
    console.log('✓ 契約ステータス 8件');
  }

  console.log('\n=== 本番初期データ投入完了 ===');
  console.log('');
  console.log('ログイン情報:');
  console.log('  loginId: "admin"     - システム管理者（全権限）');
  console.log('  loginId: "test_user" - テストユーザー（全権限）');
  console.log('  loginId: "stella001" - 固定データ管理者（マスターデータ編集権限）');
  console.log('');
  console.log('残りのマスターデータはWebアプリから入力してください:');
  console.log('  - 商談ステージ (/stp/settings/stages)');
  console.log('  - スタッフ役割種別 (/staff/role-types)');
  console.log('  - プロジェクト (/settings/projects)');
  console.log('  - 顧客種別 (/settings/customer-types)');
  console.log('  - 流入経路（設定画面を作成予定）');
}

main()
  .catch((e) => {
    console.error('エラーが発生しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
