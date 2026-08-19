import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "src/data/config.json",
  "src/data/theme.json",
  "src/data/site.json",
  "src/data/current.json",
  "src/data/years/2026/applications.json",
  "src/data/years/2026/event.json",
  "src/data/years/2026/artists.json",
  "src/data/years/2026/mascots.json",
  "src/data/years/2026/timetable.json",
  "src/data/years/2026/sponsors.json",
  "src/data/years/2026/news.json",
  "src/data/years/2026/gallery.json",
  "src/data/years/2026/venue.json"
];

const requiredDocumentDirs = [
  "src/data/documents/minutes",
  "src/data/documents/financial",
  "src/data/documents/planning",
  "src/data/documents/rules",
  "src/data/documents/manual"
];

const readJson = async (relativePath) => {
  const content = await readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(content);
};

for (const file of requiredFiles) {
  await readJson(file);
}

for (const directory of requiredDocumentDirs) {
  await access(path.join(root, directory));
  await readdir(path.join(root, directory));
}

const current = await readJson("src/data/current.json");
const config = await readJson("src/data/config.json");

if (current.year !== config.content.currentYear) {
  throw new Error("current.json and config.json current year values do not match.");
}

process.stdout.write("Data files are valid JSON and required document directories exist.\n");
