// build-content.mjs
// Snapshots the business_licensing_kb Wiki markdown into api/content/articles.json,
// which the portal's serverless function searches at query time.
//
// Usage:
//   CONTENT_SRC="/path/to/Wiki" node scripts/build-content.mjs
// If CONTENT_SRC is not set, it defaults to ./content-source/wiki (the repo refresh flow).
//
// Refresh flow: copy the latest KNOWLEDGE/business_licensing_kb/Wiki/*.md into
// content-source/wiki/, run this script, then redeploy.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const srcDir = process.env.CONTENT_SRC || join(repoRoot, "content-source", "wiki");
const outFile = join(repoRoot, "api", "content", "articles.json");

// Navigation / system files that are not knowledge articles.
const SKIP = new Set(["INDEX.md", "QUESTIONS.md", "CHANGELOG.md", "_INGESTED.md", "CLAUDE.md"]);

function extractTitle(md, slug) {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : slug;
}

function extractField(md, label) {
  const m = md.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
  return m ? m[1].trim() : "";
}

function extractSection(md, heading) {
  // grabs text under "## <heading>" up to the next "## "
  const re = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?:\\n##\\s|$)`, "i");
  const m = md.match(re);
  return m ? m[1].trim() : "";
}

const files = readdirSync(srcDir).filter((f) => f.endsWith(".md") && !SKIP.has(f));
const articles = files.map((f) => {
  const md = readFileSync(join(srcDir, f), "utf8");
  const slug = basename(f, ".md");
  return {
    slug,
    title: extractTitle(md, slug),
    status: extractField(md, "Status"),
    summary: extractSection(md, "Summary"),
    body: md, // full markdown; the function trims per-answer to control tokens
  };
});

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), count: articles.length, articles }, null, 2));
console.log(`Wrote ${articles.length} articles to ${outFile}`);
