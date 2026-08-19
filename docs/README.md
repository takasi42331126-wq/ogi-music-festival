# 第35回おぎアマチュア音楽祭DX2026 公式ホームページ

小城商工会議所 青年部（小城YEG）が毎年開催する「第35回おぎアマチュア音楽祭DX2026」の公式ホームページです。

## Phase1の範囲

- Astroによる静的サイト
- GitHubとCloudflare Pagesで公開できる構成
- 年度別JSONによる掲載情報管理
- `config.json` と `theme.json` による運用・デザイン設定
- スマートフォン優先のTOP、下層ページ、ニュース詳細、管理画面デモ
- SEO、OGP画像、favicon、sitemap、robots
- 将来のAI検索に備えた `src/data/documents` 配下の資料分類

## 主な更新場所

- サイト設定: `src/data/config.json`
- デザイン設定: `src/data/theme.json`
- 現在年度: `src/data/current.json`
- 年度別データ: `src/data/years/2026/`
- 画像: `public/assets/years/2026/`
- OGP画像: `public/ogp.jpg`
- favicon: `public/favicon.svg`
- 資料: `src/data/documents/`

## ローカルコマンド

Node.jsは `.node-version` の `22.16.0` を推奨します。

```bash
npm install
npm run dev
npm run build
npm run validate:data
```

## 公開ページ

- `/`
- `/about/`
- `/artists/`
- `/timetable/`
- `/applications/`
- `/map/`
- `/access/`
- `/sponsors/`
- `/news/`
- `/gallery/`
- `/contact/`
- `/admin/`

`/admin/` はPhase1ではUIデモです。公開前に必要であればBasic認証、Cloudflare Access、またはルーティング制限を検討してください。
