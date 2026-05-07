# 本番データを localhost:3001 で確認する手順

## 目的

通常のローカル開発環境 `http://localhost:3000` はそのまま残し、同じコードを使った本番データ確認用のローカル環境を `http://localhost:3001` に作る。

違いは接続先DBだけ。

- `localhost:3000`: 通常のローカルDB
- `localhost:3001`: 本番DBのコピーを入れたローカル専用DB

コードはどちらも同じ作業ツリーをマウントするため、編集内容は 3000/3001 の両方に反映される。

## 初回セットアップ

```bash
cp .env.prod-local.example .env.prod-local
```

その後、本番データを同期してから `localhost:3001` を起動する。

```bash
scripts/sync-prod-db-to-local.sh user@your-vps-host
```

ブラウザで確認:

```text
http://localhost:3001
```

Prisma Studio:

```bash
docker compose --env-file .env.prod-local -f docker-compose.prod-local.yml up -d prisma-studio
```

```text
http://localhost:5556
```

## 最新の本番データを localhost:3001 へ反映する

安全で一番楽な運用は、ローカルから次の1コマンドを実行する方法。
VPSからMacの `localhost` へ直接書き込むにはMac側をSSH待受にする必要があるため、ここではローカルからVPSへ取りに行く。

```bash
scripts/sync-prod-db-to-local.sh user@your-vps-host
```

確認なしで実行する場合:

```bash
scripts/sync-prod-db-to-local.sh --yes user@your-vps-host
```

このコマンドが行うこと:

1. VPS上の本番DBを `pg_dump` する
2. dumpをSSH経由でローカルへ取得する
3. `localhost:3001` 用DBだけを削除して復元する
4. ローカルの未デプロイ差分に合わせて `prisma migrate deploy` を実行する
5. `localhost:3001` のアプリを起動する

通常の `localhost:3000` のDBやコンテナは触らない。

## VPS上でdumpだけ作る場合

VPS側で1コマンドだけ打ってdumpファイルを作る場合:

```bash
cd ~/stella-crm
scripts/export-prod-db-for-local.sh
```

出力された `.dump` ファイルをローカルにコピーし、ローカルで復元する。

```bash
scripts/sync-prod-db-to-local.sh --dump-file /path/to/prod-db-YYYYMMDDHHMMSS.dump
```

## テスト運用フロー

```text
1. scripts/sync-prod-db-to-local.sh user@your-vps-host
2. http://localhost:3001 で本番データを使って確認
3. 問題なければ stg にデプロイ
4. stg 確認OKなら prod に本番公開デプロイ
```

## 注意

`localhost:3001` は本番データのコピーを持つため、顧客情報を含む。dumpファイルはGit管理外、かつ不要になったら削除する。

`.env.prod-local` ではメール、Zoom、CloudSign、Google系の値を空にしている。外部通知や本番連携の送信テスト用途では使わない。

本番DBへローカルアプリから直接接続しない。必ずdumpをローカル専用DBへ復元して使う。
