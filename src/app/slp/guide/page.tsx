import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Users,
  Building2,
  MessageSquare,
  Bell,
  FileText,
  AlertTriangle,
  Video,
  Shield,
  HelpCircle,
  Clock,
  ArrowDown,
  CheckCircle2,
} from "lucide-react";

export default function SlpGuidePage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          SLP OS 説明書
        </h1>
        <p className="text-muted-foreground mt-1">
          公的制度教育推進協会（SLP）プロジェクトのOS（運用システム）の使い方ガイドです。
        </p>
      </div>

      {/* 目次 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">目次</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1 text-sm">
            {[
              "全体の流れ",
              "お客様の操作フロー",
              "OS管理画面の機能",
              "プロラインとOSの自動連携",
              "電子契約書（CloudSign）",
              "自動通知（LINE通知）一覧",
              "自動化エラーの確認と対応",
              "よくあるトラブルと対処法",
              "資料（PDF）の管理",
              "動画の管理",
              "閲覧ログ（アクセスログ）",
            ].map((title, i) => (
              <li key={i} className="text-blue-700 hover:underline">
                <a href={`#section-${i + 1}`}>
                  {i + 1}. {title}
                </a>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* 1. 全体の流れ */}
      <Section id="section-1" icon={<ArrowDown />} title="1. 全体の流れ">
        <p>お客様が公式LINEを通じて以下のステップを進めます。</p>
        <div className="mt-4 space-y-3">
          {[
            { step: "①", text: "公式LINE友達追加", badge: null },
            { step: "②", text: "リッチメニュー「組合入会はこちら」→ 入会フォーム送信", badge: null },
            { step: "③", text: "電子契約書（CloudSign）がメールで届く → 締結", badge: "重要" },
            { step: "※", text: "締結後、リッチメニューが開放される（概要案内予約・お友達紹介URL等が使用可能に）", badge: null },
            { step: "④", text: "概要案内の予約", badge: null },
            { step: "⑤", text: "概要案内の実施 → 完了マーク", badge: null },
            { step: "⑥", text: "導入希望商談の予約", badge: null },
            { step: "⑦", text: "導入希望商談の実施 → 完了マーク", badge: null },
            { step: "⑧", text: "書類提出", badge: null },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                {item.step}
              </span>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-sm">{item.text}</span>
                {item.badge && (
                  <Badge variant="destructive" className="text-[10px]">
                    {item.badge}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>重要:</strong> 組合員入会（②③）が完了するまで、概要案内の予約やお友達紹介などの機能は使えません。
          リッチメニューは契約締結後に開放されます。
        </div>
      </Section>

      {/* 2. お客様の操作フロー */}
      <Section id="section-2" icon={<Users />} title="2. お客様の操作フロー">
        <SubSection title="2-1. 公式LINE友達追加">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>お客様が公式LINEを友達追加すると、OSのLINE友達一覧に自動登録されます</li>
            <li>紹介者がいる場合、紹介者にLINE通知が届きます</li>
            <li>この時点ではリッチメニューに「組合入会はこちら」のみ表示されます</li>
          </ul>
        </SubSection>

        <SubSection title="2-2. 組合員入会フォーム（最初にやること）">
          <p className="text-sm">リッチメニューの「組合入会はこちら」をタップして入会フォームを開きます。</p>
          <h4 className="font-semibold text-sm mt-3 mb-1">送信後の流れ:</h4>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>「送信確認中です...」と表示（約10秒間）</li>
            <li>メールが正常に送付された場合 → 「契約書を送付しました」</li>
            <li>メールが届かなかった場合 → 「メールアドレスが間違っている可能性があります」</li>
          </ol>
          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <strong>契約書の締結後</strong>、リッチメニューが開放され、概要案内予約・お友達紹介URL・動画閲覧などが使えるようになります。
          </div>
        </SubSection>

        <SubSection title="2-3. 概要案内の予約（契約締結後に利用可能）">
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>法人か個人事業主かを選択</li>
            <li>事業者名を入力（法人なら企業名、個人事業主なら屋号や個人名）</li>
            <li>プロラインの予約カレンダーが開き、日時を選択して予約確定</li>
          </ol>
          <p className="text-sm mt-2">予約確定後、OSの事業者名簿に新しいレコードが自動作成されます。</p>
        </SubSection>

        <SubSection title="2-4. 予約変更・キャンセル">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li><strong>変更:</strong> プロラインの予約履歴から日時を変更 → OSの予約日時が自動更新</li>
            <li><strong>キャンセル:</strong> プロラインの予約履歴からキャンセル → OSのステータスが「キャンセル」に変更</li>
            <li>キャンセル後は再度予約が可能です</li>
          </ul>
        </SubSection>

        <SubSection title="2-5. 導入希望商談の予約">
          <p className="text-sm">概要案内が「完了」になっている事業者のみ予約可能です。操作は概要案内と同じ流れです。</p>
        </SubSection>

        <SubSection title="2-6. 書類提出">
          <p className="text-sm">公式LINEから書類提出フォームを開き、各書類（PDF/Word/Excel/画像）をアップロードします。事業者ごとに書類が管理されます。</p>
        </SubSection>
      </Section>

      {/* 3. OS管理画面の機能 */}
      <Section id="section-3" icon={<Building2 />} title="3. OS管理画面の機能">
        <SubSection title="事業者名簿">
          <p className="text-sm">事業者の一覧・詳細を管理します。</p>
          <ul className="list-disc pl-5 space-y-1 text-sm mt-2">
            <li><strong>バッジ表示:</strong> 事業者名の横に「法人」「個人」のバッジが表示されます</li>
            <li><strong>フィルタ:</strong> 事業形態（全て/法人/個人事業主/未設定）でフィルタリング可能</li>
            <li><strong>事業形態の設定:</strong> 法人/個人事業主のラジオボタンで切り替え</li>
            <li><strong>代表者の設定:</strong> 担当者リストから代表者を選択すると、名前・電話・メールが自動入力されます</li>
            <li><strong>ステータス管理:</strong> 概要案内・商談のステータスを変更できます（変更理由の入力が必須）</li>
            <li><strong>完了処理:</strong> 完了ボタンからお客様にお礼メッセージを送信できます</li>
          </ul>
        </SubSection>

        <SubSection title="組合員名簿">
          <p className="text-sm">入会フォームから登録されたお客様の一覧です。契約書の送付状態（未送付/送付済/締結済/送付エラー）が確認できます。</p>
        </SubSection>

        <SubSection title="代理店管理">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>法人/個人事業主のSwitch切り替えで表示フィールドが変わります</li>
            <li>契約ステータスはスタッフが自由に追加・編集できます（マスタ管理）</li>
            <li>親子階層をツリー構造で管理できます</li>
          </ul>
        </SubSection>

        <SubSection title="プロライン担当者設定">
          <p className="text-sm mb-2">
            <strong>場所:</strong> 固有設定 → プロライン担当者
          </p>
          <p className="text-sm">
            プロラインの予約フォームで選択される担当者名と、OSのスタッフIDを紐付ける設定です。
          </p>
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            この設定がないと、予約時に担当者が自動入力されません。事業者詳細画面に「プロラインからの担当者名: ○○（マッピング未登録）」と表示された場合、ここでマッピングを追加してください。
          </div>
        </SubSection>

        <SubSection title="重複検出">
          <p className="text-sm mb-2">事業者名簿で重複の可能性があるレコードを自動検出します。</p>
          <Table
            headers={["検出条件", "説明"]}
            rows={[
              ["法人番号が一致", "最優先・確実な判定"],
              ["事業者名の類似", "3文字以上共通する場合"],
              ["電話番号の一致", "数字のみで比較"],
              ["住所の類似", "部分一致で判定"],
              ["個人事業主の代表者名+電話番号", "個人事業主同士の判定"],
            ]}
          />
        </SubSection>
      </Section>

      {/* 4. プロラインとOSの自動連携 */}
      <Section id="section-4" icon={<MessageSquare />} title="4. プロラインとOSの自動連携">
        <SubSection title="お客様の操作 → OSへの自動反映">
          <Table
            headers={["お客様の操作", "OSに起きること"]}
            rows={[
              ["公式LINEを友達追加", "LINE友達一覧に追加"],
              ["概要案内を予約", "事業者名簿にレコード作成、ステータス「予約中」"],
              ["概要案内を日時変更", "予約日時が更新"],
              ["概要案内をキャンセル", "ステータス「キャンセル」、予約情報クリア"],
              ["導入希望商談を予約", "商談ステータス「予約中」"],
              ["導入希望商談を日時変更", "商談日時が更新"],
              ["導入希望商談をキャンセル", "商談ステータス「キャンセル」、商談情報クリア"],
              ["入会フォームを送信", "組合員名簿にレコード追加"],
            ]}
          />
        </SubSection>

        <SubSection title="OSの操作 → お客様/紹介者への通知">
          <Table
            headers={["OSの操作", "届くもの"]}
            rows={[
              ["概要案内を「完了」にする", "受講者にお礼メッセージ(LINE)、紹介者に完了通知(LINE)"],
              ["商談を「完了」にする", "受講者にお礼メッセージ(LINE)"],
              ["入会フォーム送信（自動）", "お客様に電子契約書（メール）"],
              ["契約書メール不達（自動）", "お客様にLINE通知「メールが届きませんでした」"],
            ]}
          />
        </SubSection>
      </Section>

      {/* 5. 電子契約書（CloudSign） */}
      <Section id="section-5" icon={<FileText />} title="5. 電子契約書（CloudSign）">
        <SubSection title="送付の流れ">
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>お客様が入会フォームを送信</li>
            <li>OSがCloudSignのAPI経由で契約書を自動送付</li>
            <li>お客様のメアドに契約書が届く</li>
            <li>お客様が契約書に電子署名</li>
            <li>OSの組合員名簿のステータスが「組合員契約書締結」に自動更新</li>
          </ol>
        </SubSection>

        <SubSection title="メール不達時の流れ">
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>送信直後（10秒以内）に不達検知 → お客様にメアド確認画面を表示</li>
            <li>10秒以降に不達検知 → お客様にLINE通知で通知</li>
            <li>お客様がメアドを修正して再送付可能</li>
            <li>再度不達 → スタッフ対応</li>
          </ol>
        </SubSection>

        <SubSection title="メアド変更の回数制限">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li><strong>メール不達によるメアド修正:</strong> 回数制限なし</li>
            <li><strong>正常送付後のメアド変更:</strong> 2回まで（それ以上は公式LINEへお問い合わせ）</li>
          </ul>
        </SubSection>

        <SubSection title="リマインド">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li><strong>お客様自身:</strong> 入会フォームの「リマインド送付を希望する」ボタンから送信</li>
            <li><strong>自動:</strong> 毎日朝10時に、送付から一定日数経過した未締結者に自動リマインド</li>
          </ul>
        </SubSection>
      </Section>

      {/* 6. 自動通知一覧 */}
      <Section id="section-6" icon={<Bell />} title="6. 自動通知（LINE通知）一覧">
        <SubSection title="紹介者向け通知">
          <Table
            headers={["タイミング", "内容"]}
            rows={[
              ["お客様がLINE友達追加した時", "「○○さんが友達追加しました」"],
              ["お客様が契約締結した時", "「○○さんが契約を締結しました」"],
              ["概要案内が予約された時", "「○○さんが概要案内を予約しました」"],
              ["概要案内が日時変更された時", "「○○さんの概要案内日時が変更されました」"],
              ["概要案内がキャンセルされた時", "「○○さんの概要案内がキャンセルされました」"],
              ["概要案内が完了した時", "「○○さんの概要案内が完了しました」"],
            ]}
          />
        </SubSection>

        <SubSection title="お客様本人向け通知">
          <Table
            headers={["タイミング", "内容"]}
            rows={[
              ["概要案内が完了した時", "お礼メッセージ（自由テキスト）"],
              ["導入希望商談が完了した時", "お礼メッセージ（自由テキスト）"],
              ["契約書リマインド（自動）", "「契約書の締結をお願いします」"],
              ["契約書メール不達時", "「メールが届きませんでした」"],
            ]}
          />
        </SubSection>
      </Section>

      {/* 7. 自動化エラーの確認と対応 */}
      <Section id="section-7" icon={<AlertTriangle />} title="7. 自動化エラーの確認と対応">
        <p className="text-sm mb-3">
          <strong>場所:</strong> サイドバー → 自動化エラー
        </p>
        <p className="text-sm mb-4">プロラインやCloudSignとの連携で問題が発生した場合、ここに記録されます。</p>

        <Table
          headers={["エラーメッセージ", "意味", "対応方法"]}
          rows={[
            ["マッピング未登録のプロライン担当者名を受信", "プロラインの担当者名がスタッフと紐付いていない", "「固有設定 → プロライン担当者」からマッピングを追加"],
            ["紹介者が組合員名簿に未登録", "紹介者がまだ入会フォームを提出していない", "紹介者が登録完了後、組合員名簿の「紹介者」を手動で設定"],
            ["契約書送付失敗", "CloudSignのAPI設定エラーまたは一時的な障害", "CloudSignの設定を確認し、手動で再送付"],
            ["CloudSignメール送信失敗", "メアドのタイプミスやドメインの問題", "組合員名簿でメアドを修正し、手動で再送付"],
            ["プロラインフォーム送信失敗", "プロラインへの通知送信が失敗", "必要に応じて手動でLINEメッセージ送信"],
          ]}
        />
      </Section>

      {/* 8. よくあるトラブルと対処法 */}
      <Section id="section-8" icon={<HelpCircle />} title="8. よくあるトラブルと対処法">
        {[
          {
            q: "予約したのにOSに反映されない",
            a: "自動化エラーページを確認してください。エラーがなければ、プロラインの予約履歴を確認し、必要に応じてOS上で手動でステータスと日時を設定してください。",
          },
          {
            q: "担当者が自動入力されない",
            a: "プロラインの担当者名がOSのスタッフに紐付いていません。事業者詳細画面に「プロラインからの担当者名: ○○（マッピング未登録）」が表示されている場合、「固有設定 → プロライン担当者」からマッピングを追加してください。",
          },
          {
            q: "入会フォームを送信したのに組合員名簿にレコードがない",
            a: "自動化エラーページを確認してください。日本語のエラーメッセージが記録されています。",
          },
          {
            q: "契約書メールが届かない",
            a: "組合員名簿で「不達フラグ」がONになっていないか確認してください。ONの場合、正しいメアドに手動で契約書を再送付してください。",
          },
          {
            q: "概要案内が完了したのに商談予約画面に表示されない",
            a: "事業者詳細画面で概要案内ステータスが「完了」になっているか確認し、なっていなければ完了処理を実行してください。",
          },
          {
            q: "同じ事業者が2つ登録されてしまった",
            a: "事業者詳細画面に重複候補が表示されます。確認し、必要に応じて事業者の統合（マージ）を実行してください。",
          },
          {
            q: "法人/個人事業主の区分が未設定のレコードがある",
            a: "法人/個人事業主対応以前に登録されたレコードです。事業者詳細画面で事業形態を手動で設定してください。",
          },
        ].map((item, i) => (
          <div key={i} className="mb-4 last:mb-0">
            <h4 className="text-sm font-semibold text-slate-900 mb-1">
              Q. {item.q}
            </h4>
            <p className="text-sm text-muted-foreground pl-4">{item.a}</p>
          </div>
        ))}
      </Section>

      {/* 9. 資料（PDF）の管理 */}
      <Section id="section-9" icon={<FileText />} title="9. 資料（PDF）の管理">
        <SubSection title="アップロード方法">
          <p className="text-sm mb-2">
            <strong>場所:</strong> 固有設定 → 資料管理
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>「資料をアップロード」ボタンをクリック</li>
            <li>PDFファイルを選択（最大50MB）</li>
            <li>アップロードすると自動的に「アクティブな資料」に切り替わります</li>
          </ol>
          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            アクティブな資料は1つだけです。新しい資料をアップロードすると、前の資料は非アクティブになります。
          </div>
        </SubSection>

        <SubSection title="お客様への配信">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>お客様がLINEのリンクを開くと、認証を経て資料が表示されます</li>
            <li>お客様ごとにウォーターマーク（透かし）が入ります</li>
            <li>スクリーンショットや右クリック保存の抑制機能があります</li>
          </ul>
        </SubSection>
      </Section>

      {/* 10. 動画の管理 */}
      <Section id="section-10" icon={<Video />} title="10. 動画の管理">
        <SubSection title="アップロード方法">
          <p className="text-sm mb-2">
            <strong>場所:</strong> 固有設定 → 資料管理（動画タブ）
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>「動画をアップロード」ボタンをクリック</li>
            <li>動画ファイルを選択（MP4/WebM/MOV、最大1GB）</li>
            <li>アップロードすると自動的に「アクティブな動画」に切り替わります</li>
          </ol>
        </SubSection>

        <SubSection title="お客様への配信">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>ウォーターマーク付きのビデオプレーヤーで再生されます</li>
            <li>お客様のLINE名とIDが透かしとして表示されます（流出防止）</li>
            <li>ダウンロードボタンは非表示、右クリックも無効です</li>
          </ul>
        </SubSection>
      </Section>

      {/* 11. 閲覧ログ */}
      <Section id="section-11" icon={<Shield />} title="11. 閲覧ログ（アクセスログ）">
        <p className="text-sm mb-2">
          <strong>場所:</strong> 固有設定 → 資料管理 → 「アクセスログ」タブ
        </p>
        <p className="text-sm mb-3">
          資料（PDF）と動画を閲覧したお客様のログが記録されています。
        </p>

        <SubSection title="記録される情報">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>お客様のLINE友達ID・LINE名</li>
            <li>閲覧した種別（資料 or 動画）</li>
            <li>アクセス日時</li>
            <li>IPアドレス・ブラウザ情報</li>
          </ul>
        </SubSection>

        <SubSection title="活用方法">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>お客様が資料・動画を閲覧したかの確認</li>
            <li>万が一の流出時、ウォーターマーク+IPアドレスで流出元を特定</li>
            <li>直近100件が表示されます</li>
          </ul>
        </SubSection>
      </Section>

      {/* 定期処理 */}
      <Section id="section-cron" icon={<Clock />} title="補足: 定期自動処理">
        <Table
          headers={["処理名", "実行タイミング", "内容"]}
          rows={[
            ["LINE友達同期", "1日1回", "プロラインのLINE友達情報をOSに反映"],
            ["組合員リマインド", "毎日朝10時", "未締結者に自動リマインドメール送信"],
            ["ペンディング情報削除", "毎日深夜4時", "期限切れの予約一時情報を削除"],
          ]}
        />
      </Section>

      <p className="text-xs text-muted-foreground text-center pt-4 pb-8">
        最終更新: 2026年4月12日
      </p>
    </div>
  );
}

// ===============================
// 共通コンポーネント
// ===============================

function Section({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
        {title}
      </h3>
      <div className="pl-5">{children}</div>
    </div>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-slate-50">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 font-semibold text-slate-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-slate-600">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
