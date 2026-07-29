import { defineConfig } from "astro/config";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("./src/data/config.json", import.meta.url), "utf8"));

export default defineConfig({
  output: "static",
  site: config.site.baseUrl
});
