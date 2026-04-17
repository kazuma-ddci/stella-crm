import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/staff-action";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ZoomIntegrationGuidePage() {
  await requireStaff();

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/staff/me/integrations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> ミーティング連携に戻る
      </Link>
      <h1 className="text-2xl font-bold">Zoom連携ガイド</h1>

      <Card>
        <CardHeader>
          <CardTitle>Zoom連携の概要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            予約時にお客様へ自動的にZoom URLを送るには、あなたのZoomアカウントをCRMに連携する必要があります。
          </p>
          <p>
            連携するとCRMは以下を自動で行います:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>予約確定・変更時にあなたのZoomアカウントで会議を発行</li>
            <li>発行した URL をお客様LINEへ自動送信（前日/1時間前リマインドも自動）</li>
            <li>商談終了後、録画と文字起こしを自動取得 → CRM議事録として保存</li>
          </ul>
          <p className="text-muted-foreground">
            ※ 録画データはVPS保存後、Zoom側からは自動削除されます。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>前提条件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ul className="list-disc ml-5 space-y-1">
            <li>Zoomアカウントに <strong>有料ライセンス（Pro以上）</strong> が付与されていること</li>
            <li>アカウントで <strong>Cloud Recording</strong> と <strong>AI Companion（Meeting Summary）</strong> が有効になっていること</li>
            <li>ログイン中のZoomアカウントが、社内業務用のアカウントであること</li>
          </ul>
          <p className="text-muted-foreground">
            上記が整っていない場合は、システム管理者にお問い合わせください。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>連携手順</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <section>
            <h3 className="font-semibold mb-1">STEP 1: ブラウザでZoomにログイン</h3>
            <p>
              ブラウザの別タブで{" "}
              <a
                href="https://zoom.us/signin"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                Zoom
              </a>
              {" "}にログインしておいてください。これから連携に使うZoomアカウントでログインしてください。
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">STEP 2: 「Zoomと連携する」ボタンを押す</h3>
            <p>
              ミーティング連携ページの「Zoomと連携する」ボタンを押すと、Zoomの認可画面へ移動します。
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">STEP 3: Zoomで「Allow」を押して承認</h3>
            <p>
              Zoomの画面で以下のような許可確認が表示されます。内容を確認して、下部の青い「Allow」ボタンを押してください。
            </p>
            <div className="my-3 rounded-lg border overflow-hidden">
              <Image
                src="/guide/zoom/step3-allow.png"
                alt="Zoom認可画面: Stella OS would like permission to..."
                width={600}
                height={750}
                className="w-full max-w-[500px] mx-auto"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              要求される権限: 会議の作成・更新・削除、録画の閲覧、参加者の取得、AI要約の閲覧、ユーザー情報の読み取り
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">STEP 4: CRMに自動で戻る</h3>
            <p>
              承認後、自動的にCRMのミーティング連携ページへ戻ります。「連携済み」と表示されれば完了です。
            </p>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>よくある質問</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <section>
            <h4 className="font-semibold">Q. すでにZapierなど他サービスでZoomを使っていても連携できる？</h4>
            <p>A. はい。Zoomは1アカウントで複数アプリと同時に連携できます。既存の連携には影響しません。</p>
          </section>
          <section>
            <h4 className="font-semibold">Q. 個人的に作ったZoom会議もCRMに記録される？</h4>
            <p>
              A. 記録されません。CRMで発行した会議のみが自動記録対象です。
              個人的に作成した会議や他サービスで作成した会議は一切干渉されません。
            </p>
          </section>
          <section>
            <h4 className="font-semibold">Q. 連携を解除したい場合は？</h4>
            <p>
              A. ミーティング連携ページから「連携を解除する」ボタンで解除できます。再度連携することで元に戻せます。
            </p>
          </section>
          <section>
            <h4 className="font-semibold">Q. 連携エラーが出た場合は？</h4>
            <p>
              A. もう一度「Zoomと連携する」ボタンを押してやり直してください。繰り返しエラーになる場合はシステム管理者までご連絡ください。
            </p>
          </section>
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Link
          href="/staff/me/integrations"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← ミーティング連携に戻る
        </Link>
      </div>
    </div>
  );
}
