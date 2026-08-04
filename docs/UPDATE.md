# 更新手順

## 年度を更新する

1. `src/data/years/2026/` をコピーして `src/data/years/2027/` を作成する
2. `event.json` の `year`、`title`、`dateText`、`dateStart`、`dateEnd`、`venueName` を更新する
3. `artists.json`、`timetable.json`、`sponsors.json`、`news.json`、`gallery.json` を更新する
4. `public/assets/years/2027/` に画像を配置する
5. `src/data/current.json` の `year` を新年度へ変更する
6. `src/data/config.json` の `content.currentYear` も同じ年度に変更する
7. `npm run validate:data` と `npm run build` で確認する

## 画像を更新する

- トップバナー: `public/assets/years/YYYY/hero/main.webp`
- スマホ用トップバナー: `public/assets/years/YYYY/hero/main-mobile.webp`
- 出演者: `public/assets/years/YYYY/artists/`
- ギャラリー: `public/assets/years/YYYY/gallery/`
- 特別協賛・後援ロゴ: `public/assets/years/YYYY/sponsors/`
- 会場マップ: `public/assets/years/YYYY/map/`
- OGP画像: `public/ogp.jpg`
- favicon: `public/favicon.svg`

JSON内の画像パスは `/assets/years/YYYY/...` の形式にします。

## お知らせを追加する

`src/data/years/YYYY/news.json` に記事を追加します。

```json
{
  "id": "news-003",
  "slug": "sample-news",
  "title": "記事タイトル",
  "category": "お知らせ",
  "publishedAt": "2026-08-01",
  "excerpt": "一覧に表示する短い説明",
  "body": "詳細ページに表示する本文",
  "visible": true,
  "aiVisible": true
}
```

`slug` はURLになるため、半角英数字とハイフンを推奨します。

## 確認

```bash
npm run validate:data
npm run build
```
