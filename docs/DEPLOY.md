# Cloudflare Pages公開手順

## 初回公開

1. GitHubにリポジトリを作成する
2. このプロジェクトをGitHubへpushする
3. Cloudflare Dashboardで `Workers & Pages` を開く
4. `Create application` から `Pages` を選ぶ
5. `Connect to Git` でGitHubリポジトリを選択する
6. ビルド設定を入力する

```text
Framework preset: Astro
Node.js version: 22.16.0
Install command: npm install
Build command: npm run build
Build output directory: dist
Production branch: main
```

## 更新公開

`main` ブランチへ変更が入ると、Cloudflare Pagesが自動で本番デプロイします。

Pull Requestを使う場合は、Cloudflare PagesのプレビューURLで確認してから `main` にマージします。

## 独自ドメインへ移行する場合

1. Cloudflare Pagesの対象プロジェクトを開く
2. `Custom domains` からドメインを追加する
3. DNSをCloudflareに向ける
4. `src/data/config.json` の `site.baseUrl` を新しいURLへ変更する

`astro.config.mjs` は `src/data/config.json` を参照するため、URLの変更箇所は設定ファイルに集約しています。
