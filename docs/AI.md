# 将来AI拡張方針

## 目的

将来的に、来場者と運営者の両方を支援するAI機能を追加できる構造にします。

想定機能:

- AIチャット
- 資料検索
- 特別協賛申込案内
- 出演申込案内
- ボランティア募集案内
- 歴代開催情報検索

## 資料ディレクトリ

`src/data/documents/` をAI検索の元資料置き場として使います。

```text
src/data/documents/
  minutes/    議事録
  financial/  予算、決算、見積
  planning/   企画書、進行表
  rules/      規約、注意事項
  manual/     運営マニュアル
```

## 推奨構成

```text
JSONデータ / PDF / Markdown
  ↓
取り込みスクリプト
  ↓
Cloudflare Vectorize
  ↓
Cloudflare Workers API
  ↓
AIチャットUI
```

構造化データはCloudflare D1、画像やPDFなどのファイルはCloudflare R2、意味検索はCloudflare Vectorizeを想定します。

## AI回答の制御

公開してよい情報には `aiVisible: true` を付けます。

内部資料はカテゴリ単位で公開範囲を分けます。

- 来場者向け: 開催概要、アクセス、お知らせ、FAQ
- 特別協賛企業向け: 特別協賛プラン、申込手順、締切
- 運営者向け: 議事録、予算、マニュアル

## 実装時の注意

- 個人情報や未公開の金額情報はAIの公開回答に含めない
- 回答には参照元の資料名を付ける
- 毎年のデータを年度別に検索できるようにする
- 申込フォームは認証、スパム対策、通知先を設計してから実装する
