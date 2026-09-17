# 来場者チェックイン＋抽選システム

## 構成

- 来場者ページ: `/checkin`
- 管理ページ: `/admin/checkin`
- API: Cloudflare Pages Functions `/api/checkin/*`
- データベース: Cloudflare D1
- D1 binding名: `CHECKIN_DB`
- 管理APIトークン: `CHECKIN_ADMIN_TOKEN`

既存HPはAstroの静的出力のまま維持し、チェックインと抽選に必要な処理だけPages Functionsで実行します。

## D1作成

CloudflareのプロジェクトでD1データベースを作成します。

```sh
npx wrangler d1 create ogi-dx2026-checkin
```

作成後、初期スキーマを適用します。

```sh
npx wrangler d1 execute ogi-dx2026-checkin --file=./migrations/0001_checkin_lottery.sql --remote
```

## Cloudflare Pages設定

Cloudflare Dashboardで対象Pagesプロジェクトを開き、以下を設定します。

- Settings > Bindings > D1 database bindings
  - Variable name: `CHECKIN_DB`
  - D1 database: 作成した `ogi-dx2026-checkin`
- Settings > Variables and Secrets
  - Secret name: `CHECKIN_ADMIN_TOKEN`
  - Value: 推測されにくい長い文字列

設定後、Pagesを再デプロイしてください。

## 管理画面

`/admin/checkin` を開き、`CHECKIN_ADMIN_TOKEN` と同じ値を入力すると管理APIに接続できます。
ページ表示時のBasic認証も同じトークンを使います。ユーザー名は `admin`、パスワードは `CHECKIN_ADMIN_TOKEN` です。

管理画面でできること:

- 総来場者数、チェックイン件数の確認
- 会場別集計の確認
- 会場別チェックインURLの確認とコピー
- 景品名、当選本数、有効/無効、表示順の設定
- 抽選受付ON/OFF、当選確率の設定（本番/テストで別管理）
- 当選者一覧の確認
- 景品受取済み/未受取の変更
- テストモードのデータ削除

当選確率の初期値は本番/テストともに `0%` です。景品設定後、管理画面から当日用の確率に変更してください。

## 会場別チェックインと抽選

- 同じ端末でも、会場が異なれば各会場で1回ずつチェックイン・抽選できます。
- 同じ端末・同じ会場・同じモードでは、2回目以降は新しいチェックインや再抽選を行わず、最初の結果を再表示します。
- 5会場すべてを回った場合、同じ端末でも最大5回、各会場1回ずつ抽選できます。
- 景品の `total_winners` は会場別ではなくイベント全体の上限です。例えば10本なら、全5会場合計で最大10本です。
- live/testモードは別集計です。

## QRコード用URL

チェックインURLは会場別に発行します。`venue` がないURLや未登録の会場IDはエラー表示になります。

管理画面の会場別来場者数テーブルからも確認・コピーできます。

```text
https://ogi-music-festival.pages.dev/checkin?venue=park
https://ogi-music-festival.pages.dev/checkin?venue=yumeplat
https://ogi-music-festival.pages.dev/checkin?venue=highschool
https://ogi-music-festival.pages.dev/checkin?venue=university
https://ogi-music-festival.pages.dev/checkin?venue=sakuraoka
```

テスト用URL:

```text
https://ogi-music-festival.pages.dev/checkin?mode=test&venue=park
```

会場別テストも本番と同じ `venue` を付けます。

```text
https://ogi-music-festival.pages.dev/checkin?mode=test&venue=park
```

## テストデータ削除

管理画面で表示データを「テスト」に切り替え、確認文字列に以下を入力して削除します。

```text
DELETE TEST DATA
```

削除対象はテストモードの `checkins` と `draw_results` のみです。景品設定と本番データは削除しません。

## 注意

- 来場者の氏名、電話番号、メールアドレス、住所は保存しません。
- 同じ端末からの通常の重複チェックインはLocalStorageで抑止します。抑止は会場別のため、同じ端末でも別会場では別チェックイン・別抽選として集計します。
- 別端末やLocalStorage削除による完全な不正防止までは行いません。
- 管理画面HTMLはBasic認証、管理APIはBearerトークン必須です。どちらも `CHECKIN_ADMIN_TOKEN` を使用します。
