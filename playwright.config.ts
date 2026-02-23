import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // スクリーンショット、動画などの出力先
  outputDir: './playwright/test-results',

  // スクリーンショットの保存先（相対パス）
  use: {
    // スクリーンショット設定
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true,
    },

    // ベースURL（必要に応じて設定）
    baseURL: 'http://localhost:3000',

    // トレース設定
    trace: 'retain-on-failure',

    // 動画録画設定（デモ検証用）
    video: 'on',

    // ビューポートを広めに設定（デモ用）
    viewport: { width: 1440, height: 900 },
  },

  // プロジェクト設定
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  // テストディレクトリ
  testDir: './playwright/tests',

  // 並列実行の設定
  workers: 1,

  // タイムアウト設定
  timeout: 30000,
});
