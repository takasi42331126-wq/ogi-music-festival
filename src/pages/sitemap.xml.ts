import { config, news } from "@lib/content/repository";

const staticPages = [
  "",
  "about/",
  "artists/",
  "timetable/",
  "map/",
  "access/",
  "sponsors/",
  "news/",
  "gallery/",
  "contact/"
];

const urls = [
  ...staticPages.map((path) => ({
    loc: new URL(path, config.site.baseUrl).toString(),
    priority: path === "" ? "1.0" : "0.8"
  })),
  ...news.map((item) => ({
    loc: new URL(`news/${item.slug}/`, config.site.baseUrl).toString(),
    lastmod: item.publishedAt,
    priority: "0.7"
  }))
];

export const GET = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ""}
    <priority>${url.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8"
      }
    }
  );
