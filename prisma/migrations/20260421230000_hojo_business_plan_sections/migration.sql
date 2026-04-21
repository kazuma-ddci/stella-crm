-- 事業計画書20セクション定義テーブル（DB化）。
-- section_key は BusinessPlanSectionKey 型と対応しコード側で固定管理、
-- title / target_chars / instruction のみ画面から編集可能。

CREATE TABLE "hojo_business_plan_sections" (
    "id" SERIAL NOT NULL,
    "section_key" VARCHAR(60) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "target_chars" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "updated_by_staff_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojo_business_plan_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hojo_business_plan_sections_section_key_key" ON "hojo_business_plan_sections" ("section_key");

ALTER TABLE "hojo_business_plan_sections" ADD CONSTRAINT "hojo_business_plan_sections_updated_by_staff_id_fkey" FOREIGN KEY ("updated_by_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 20セクションの初期データ投入
INSERT INTO "hojo_business_plan_sections" ("section_key", "title", "target_chars", "instruction", "display_order", "updated_at") VALUES
('executiveSummary', '1. エグゼクティブサマリー', 900, '事業計画書全体を俯瞰する要約。事業者の屋号・代表者・事業内容の核心・支援制度を活用する目的・期待される成果を簡潔にまとめる。', 1, NOW()),
('companyProfile', '2. 事業者情報', 700, '屋号・代表者氏名・開業年月日・所在地・連絡先・従業員数・ホームページ（あれば）を紹介し、事業者のプロフィールとして読みやすくまとめる。', 2, NOW()),
('businessContent', '3. 事業内容', 1200, 'どのような事業を展開しているか、提供価値・事業モデル・業界での立ち位置を詳しく説明する。', 3, NOW()),
('mainProductService', '4. 主力商品・サービス', 1100, '主力商品・サービスの内容と特徴、価格帯、顧客にもたらす価値を具体的に記述する。', 4, NOW()),
('businessStrength', '5. 事業の強みと差別化ポイント', 1100, '他社と比較した際の優位性、独自の仕組みやノウハウ、継続受注につながる仕掛けを記述する。', 5, NOW()),
('openingBackground', '6. 開業の経緯と事業にかける想い', 900, 'なぜこの事業を始めたのか、原体験・想い・ビジョンをストーリー仕立てで書く。未記入の場合は事業内容や強みから推測して肯定的に補完する。', 6, NOW()),
('businessScale', '7. 事業規模の現状', 700, '昨年度の売上高・月間売上の目安・顧客数など現状の事業規模を客観的に記載する。', 7, NOW()),
('targetMarket', '8. ターゲット市場', 900, 'ターゲットとしている市場の規模感、成長性、マクロ動向、この市場を選ぶ理由を記述する。', 8, NOW()),
('targetCustomerProfile', '9. ターゲット顧客層', 1000, '属性（年齢・性別・地域・職業）、課題・ニーズ、情報収集手段、意思決定の傾向を詳述する。', 9, NOW()),
('competitors', '10. 競合分析', 800, '主な競合（店舗・サービス・企業）を挙げ、自社と競合の差異点を比較する。未記入の場合は業界一般論で補完する。', 10, NOW()),
('strengthsAndChallenges', '11. 自社の強みと今後の課題', 1000, '自社の優位性と、現在認識している課題（人材・体制・集客・オペレーション）、課題に対する改善方針を記述する。', 11, NOW()),
('supportPurpose', '12. 支援制度活用の目的', 900, 'なぜこの支援制度を活用するのか、自社課題との結びつきを明確に書く。', 12, NOW()),
('supportGoal', '13. 支援制度で実現したいこと', 1100, '具体的な取り組み内容、業務・体制・サービスの改善点、期待される成果、事業への波及効果を記述する。', 13, NOW()),
('investmentPlan', '14. 投資・設備導入計画', 1100, '支援制度を活用した投資内容・導入スケジュール・自社課題との関連性・実行体制を記述する。', 14, NOW()),
('expectedOutcome', '15. 期待される成果', 1000, '売上増加の見込み、業務効率化、雇用・組織への影響、中長期的な波及効果を具体的数値や根拠と共に述べる。', 15, NOW()),
('businessStructure', '16. 事業体制とご経歴', 1000, '事業主の経歴・スキル・資格、スタッフがいれば役割、今後必要な人材・採用計画を記述する。', 16, NOW()),
('goalsShortMidLong', '17. 事業計画（短期・中期・長期目標）', 1300, '短期（1年以内）・中期（3年）・長期（5年）の目標をそれぞれサブ見出し付きで記述する。', 17, NOW()),
('salesStrategy', '18. 販売戦略とPR計画', 1100, 'ターゲット顧客への販売戦略、具体的な集客・マーケティング手法、強みの訴求方法、継続売上の仕組みを記述する。', 18, NOW()),
('financialPlan', '19. 財務計画', 1300, '過去の事業実績・今後の投資計画と必要資金・資金調達方法（自己資金・借入・補助金）・借入状況・担保・保証情報を整理する。', 19, NOW()),
('conclusion', '20. まとめ', 700, '事業計画全体を総括し、この事業と支援制度活用を通じて実現したい未来像を力強く締める。', 20, NOW());
