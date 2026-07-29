import { config } from "@lib/content/repository";

export const GET = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap.xml", config.site.baseUrl)}`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
