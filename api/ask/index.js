// api/ask  — Azure Function (Node) for the Business Licensing Consultant Portal.
const data = require("../content/articles.json");
const ARTICLES = data.articles || [];

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const MAX_ARTICLES = parseInt(process.env.MAX_ARTICLES || "4", 10);
const MAX_BODY_CHARS = parseInt(process.env.MAX_BODY_CHARS || "6000", 10);

const STOPWORDS = new Set("the a an of to in for and or is are do i we what which how need needs require required client business premises licence license my our with on at it".split(" "));

const SYNONYMS = {
  beer: ["liquor", "alcohol"], wine: ["liquor", "alcohol"], alcohol: ["liquor"],
  liquor: ["liquor"], spirits: ["liquor"], booze: ["liquor", "alcohol"],
  cafe: ["f&b", "food", "restaurant"], "café": ["f&b", "food", "restaurant"],
  restaurant: ["f&b", "food"], eatery: ["f&b", "food"], kopitiam: ["f&b", "food"],
  bar: ["f&b", "liquor"], pub: ["f&b", "liquor"], food: ["f&b"], fnb: ["f&b"],
  signboard: ["signboard", "advertising"], signage: ["signboard", "advertising"],
  music: ["music"], karaoke: ["music"], band: ["music"],
  pj: ["mbpj", "petaling"], mbpj: ["mbpj"], "petaling": ["mbpj"],
  kl: ["dbkl", "lumpur"], dbkl: ["dbkl"], "lumpur": ["dbkl"],
  "shah": ["mbsa"], mbsa: ["mbsa"], subang: ["mbsj"], mbsj: ["mbsj"],
  kajang: ["mpkj"], mpkj: ["mpkj"], selayang: ["selayang"],
  tuition: ["moe", "education"], kindergarten: ["moe", "tadika"], tadika: ["moe"],
  enrichment: ["moe"], school: ["moe", "education"], education: ["moe"],
  childcare: ["taska"], daycare: ["taska"], nursery: ["taska"], taska: ["taska"],
  trading: ["wrt"], retail: ["wrt"], wholesale: ["wrt"], distributive: ["wrt"], wrt: ["wrt"],
  import: ["import", "customs"], export: ["export", "customs"],
  tourism: ["motac", "tourism"], travel: ["motac", "tourism"], tour: ["motac"], motac: ["motac"],
  recruitment: ["jtk", "employment"], jtk: ["jtk"], aps: ["jtk"],
  halal: ["halal"],
};

function terms(q) {
  const base = (q.toLowerCase().match(/[a-z0-9&]+/g) || [])
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  const out = new Set(base);
  for (const t of base) { if (SYNONYMS[t]) for (const s of SYNONYMS[t]) out.add(s); }
  return [...out];
}

function count(haystack, term) {
  if (!haystack) return 0;
  let n = 0, i = 0;
  const h = haystack.toLowerCase();
  while ((i = h.indexOf(term, i)) !== -1) { n++; i += term.length; }
  return n;
}

function retrieve(question) {
  const ts = terms(question);
  if (ts.length === 0) return [];
  return ARTICLES.map((a) => {
    let score = 0;
    for (const t of ts) {
      score += count(a.title, t) * 6;
      score += count(a.summary, t) * 3;
      score += count(a.body, t) * 1;
    }
    return { a, score };
  }).filter((x) => x.score > 0).sort((x, y) => y.score - x.score).slice(0, MAX_ARTICLES).map((x) => x.a);
}

function buildContext(articles) {
  return articles.map((a) => {
    const body = a.body.length > MAX_BODY_CHARS ? a.body.slice(0, MAX_BODY_CHARS) + "\n…[truncated]" : a.body;
    return `<article slug="${a.slug}" title="${a.title}">\n${body}\n</article>`;
  }).join("\n\n");
}

const SYSTEM_PROMPT = `You are the MISHU Business Licensing assistant, helping MISHU's own sales consultants scope Malaysian business-licensing cases.

Rules:
- Answer ONLY from the <article> sources provided in the user message. Do not use outside knowledge about licensing.
- If the answer is not in the provided articles, say so plainly and suggest the consultant check the relevant local council/regulator or ask the licensing team in CoWork. Never guess or invent requirements, fees, or timelines.
- Never promise or guarantee an approval or a timeline — outcomes depend on the authorities. Frame timelines as estimates from the sources.
- Be accurate, clear, complete, and actionable. Where useful, structure the answer as: Licences needed / Key requirements / Documents to prepare / Indicative fees / Things to watch.
- Cite the source article title(s) you used at the end, under "Sources:".
- British English. Professional but warm. No hype.
- Fees and rules change and vary by council; remind the consultant to verify current figures with the authority where it matters.`;

module.exports = async function (context, req) {
  const question = (req.body && req.body.question || "").toString().trim();
  if (!question) {
    context.res = { status: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Please provide a question." }) };
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    context.res = { status: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Server is not configured with an API key yet." }) };
    return;
  }
  const articles = retrieve(question);
  if (articles.length === 0) {
    context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer: "I couldn't find anything in the knowledge base that matches that question. Try rephrasing (mention the business type, the local council, or the licence), or check with the licensing team in CoWork — this topic may not be covered yet.", citations: [] }) };
    return;
  }
  const userContent = `A MISHU sales consultant asks:\n\n"${question}"\n\nAnswer using ONLY these knowledge-base articles:\n\n${buildContext(articles)}`;
  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userContent }] }),
    });
    if (!r.ok) {
      const detail = await r.text();
      context.log.error("Anthropic error", r.status, detail);
      context.res = { status: 502, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "The AI service returned an error. Please try again shortly." }) };
      return;
    }
    const payload = await r.json();
    const answer = (payload.content || []).map((b) => b.text || "").join("").trim();
    context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer, citations: articles.map((a) => ({ slug: a.slug, title: a.title })) }) };
  } catch (err) {
    context.log.error("ask function failed", err);
    context.res = { status: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Something went wrong answering that. Please try again." }) };
  }
};
