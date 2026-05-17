import { Resvg } from "@resvg/resvg-js";
import fs from "fs";

// =========================================================
// CONFIG
// =========================================================
const CONFIG = {
  HANDLE: "@Akhil",
  GROQ_MODEL: "openai/gpt-oss-120b",
  SLIDE_COUNT: 6,
};

// =========================================================
// SECRETS LOADER
// =========================================================
function loadSecrets() {
  let cfg = {};
  try {
    if (fs.existsSync("./wrangler.toml")) {
      const raw = fs.readFileSync("./wrangler.toml", "utf-8");
      const get = (k) => { const m = raw.match(new RegExp(`${k}\\s*=\\s*"([^"]+)"`)); return m?.[1] ?? null; };
      cfg.PAGE_OR_IG_ID     = get("PAGE_OR_IG_ID");
      cfg.PAGE_ACCESS_TOKEN = get("PAGE_ACCESS_TOKEN");
      cfg.GROQ_API_KEY      = get("GROQ_API_KEY");
    }
  } catch { console.warn("wrangler.toml unreadable — using env vars."); }
  return {
    PAGE_OR_IG_ID:     process.env.PAGE_OR_IG_ID     ?? cfg.PAGE_OR_IG_ID,
    PAGE_ACCESS_TOKEN: process.env.PAGE_ACCESS_TOKEN ?? cfg.PAGE_ACCESS_TOKEN,
    GROQ_API_KEY:      process.env.GROQ_API_KEY      ?? cfg.GROQ_API_KEY,
  };
}
const SECRETS = loadSecrets();

// =========================================================
// THEMES — 6 distinct multicoloured
// =========================================================
const THEMES = [
  { name:"Neon Dark",      bg1:"#060d1f", bg2:"#0f1e3a", accent:"#38bdf8", accent2:"#818cf8", glow1:"#1e40af", glow2:"#4f46e5", text:"#f1f5f9", sub:"#94a3b8" },
  { name:"Luxury Gold",    bg1:"#0a0800", bg2:"#1a1200", accent:"#f59e0b", accent2:"#fbbf24", glow1:"#78350f", glow2:"#92400e", text:"#fef9f0", sub:"#d97706" },
  { name:"Cyber Pink",     bg1:"#0d0016", bg2:"#1a0030", accent:"#e879f9", accent2:"#a78bfa", glow1:"#6b21a8", glow2:"#7c3aed", text:"#fdf4ff", sub:"#c084fc" },
  { name:"Emerald Luxury", bg1:"#010f08", bg2:"#001a0e", accent:"#34d399", accent2:"#fbbf24", glow1:"#064e3b", glow2:"#065f46", text:"#ecfdf5", sub:"#6ee7b7" },
  { name:"Sunset Aura",    bg1:"#0f0500", bg2:"#1e0a00", accent:"#fb923c", accent2:"#f43f5e", glow1:"#7c2d12", glow2:"#881337", text:"#fff7ed", sub:"#fdba74" },
  { name:"Royal Velvet",   bg1:"#05030f", bg2:"#0e0824", accent:"#818cf8", accent2:"#c084fc", glow1:"#1e1b4b", glow2:"#3b0764", text:"#f5f3ff", sub:"#a5b4fc" },
];

// =========================================================
// FONT SETUP
// font.ttf — drop any TTF (e.g. Inter-Bold.ttf) as font.ttf in project root.
// GitHub Actions: add a step to download the font before running the bot.
// Without font.ttf, resvg falls back to system fonts (usually DejaVu on Linux).
// =========================================================
const HAS_FONT  = fs.existsSync("./font.ttf");
const FONT_FAM  = HAS_FONT ? "'CardFont','Arial Black',sans-serif" : "'Arial Black','Liberation Sans','DejaVu Sans',sans-serif";

function getFontFaceCSS() {
  if (!HAS_FONT) return "";
  const b64 = fs.readFileSync("./font.ttf").toString("base64");
  return `@font-face{font-family:'CardFont';src:url('data:font/truetype;base64,${b64}') format('truetype');font-weight:700 900;}`;
}

// =========================================================
// TEXT UTILITIES
// =========================================================
function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

// Avg bold char width coefficient for Arial Black / DejaVu Bold
const CHAR_W_COEF = 0.62;
const TEXT_BOX_PX = 820; // usable width inside text rect
const MAX_LINES   = 4;

function computeLayout(text) {
  // Try sizes from large to small until text fits in MAX_LINES lines
  for (const fs of [84, 76, 68, 60, 54, 48]) {
    const maxChars = Math.floor(TEXT_BOX_PX / (fs * CHAR_W_COEF));
    const lines    = wordWrap(text, maxChars);
    if (lines.length <= MAX_LINES) return { fs, lines, lh: fs * 1.52 };
  }
  const fs = 48;
  return { fs, lines: wordWrap(text, Math.floor(TEXT_BOX_PX / (fs * CHAR_W_COEF))), lh: fs * 1.52 };
}

function wordWrap(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (next.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Regex-safe highlight split — longer highlights first to avoid substring clobber
function splitHighlights(line, highlights) {
  const hls = [...(highlights ?? [])].filter(Boolean).sort((a,b) => b.length - a.length);
  let parts = [{ t: line, h: false }];
  for (const hl of hls) {
    const re = new RegExp(`(${hl.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`, "gi");
    parts = parts.flatMap(p => {
      if (p.h) return [p];
      return p.t.split(re).filter(s=>s.length>0).map(s =>
        s.toLowerCase() === hl.toLowerCase() ? { t:s, h:true } : { t:s, h:false }
      );
    });
  }
  return parts;
}

// =========================================================
// SVG SLIDE BUILDER
// =========================================================
const W = 1080, H = 1350;

// Card bounds
const CARD = { x:54, y:108, w:972, h:1134, rx:36 };

// Text zone — vertically centred between header pill bottom and CTA top
// Header pill bottom: CARD.y + 32 + 56 + a little gap = CARD.y + 110
// CTA top:            CARD.y + CARD.h - 110
const TZ_TOP    = CARD.y + 110;   // just below header divider
const TZ_BOTTOM = CARD.y + CARD.h - 110; // just above CTA bar
const TZ_CY     = (TZ_TOP + TZ_BOTTOM) / 2;
const TZ_CX     = W / 2;

// Text rect geometry helpers (computed each slide)
function textRectGeometry(lines, fs, lh) {
  const blockH  = lines.length * lh;
  const rectTop = TZ_CY - blockH / 2 - fs * 0.55 - 24;
  const rectH   = blockH + fs * 0.55 + 48;
  const rectX   = TZ_CX - TEXT_BOX_PX / 2 - 28;
  const rectW   = TEXT_BOX_PX + 56;
  return { rectTop, rectH, rectX, rectW, firstLineY: TZ_CY - blockH / 2 + fs * 0.72 };
}

function buildSlide(slide, idx, total, theme, catTitle) {
  const { fs, lines, lh } = computeLayout(slide.text);
  const { rectTop, rectH, rectX, rectW, firstLineY } = textRectGeometry(lines, fs, lh);

  const fontCSS = getFontFaceCSS();

  // Build text lines SVG
  let lineY = firstLineY;
  const textLines = lines.map(line => {
    const parts  = splitHighlights(line, slide.highlight);
    const tspans = parts.map(p =>
      `<tspan fill="${p.h ? theme.accent : theme.text}" font-weight="900"${p.h ? ' text-decoration="underline"':''} >${escapeXml(p.t)}</tspan>`
    ).join("");
    const y = lineY; lineY += lh;
    return `<text x="${TZ_CX}" y="${y.toFixed(1)}" font-size="${fs}" font-family="${FONT_FAM}" font-weight="900" text-anchor="middle" dominant-baseline="auto">${tspans}</text>`;
  });

  // Progress dots
  const DOT_Y   = CARD.y + CARD.h - 50;
  const DOT_GAP = 18, DOT_R = 4.5;
  const dotsW   = total * DOT_R * 2 + (total - 1) * (DOT_GAP - DOT_R * 2);
  const dotX0   = TZ_CX - dotsW / 2 + DOT_R;
  const dots    = Array.from({ length: total }, (_, i) => {
    const cx = dotX0 + i * DOT_GAP;
    return i === idx
      ? `<circle cx="${cx}" cy="${DOT_Y}" r="${DOT_R + 2.5}" fill="${theme.accent}"/>`
      : `<circle cx="${cx}" cy="${DOT_Y}" r="${DOT_R}" fill="rgba(255,255,255,0.2)"/>`;
  }).join("");

  // Bullet (Unicode filled circle — renders everywhere, no emoji fallback needed)
  const BULLET = "&#x25CF;"; // ●

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  ${fontCSS ? `<style>${fontCSS}</style>` : ""}
  <radialGradient id="g1" cx="18%" cy="16%" r="52%">
    <stop offset="0%" stop-color="${theme.glow1}" stop-opacity="0.95"/>
    <stop offset="100%" stop-color="${theme.bg1}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="g2" cx="82%" cy="82%" r="52%">
    <stop offset="0%" stop-color="${theme.glow2}" stop-opacity="0.90"/>
    <stop offset="100%" stop-color="${theme.bg2}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="g3" cx="80%" cy="16%" r="36%">
    <stop offset="0%" stop-color="${theme.accent2}" stop-opacity="0.28"/>
    <stop offset="100%" stop-color="${theme.bg1}" stop-opacity="0"/>
  </radialGradient>
  <filter id="bigblur" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="75"/>
  </filter>
  <filter id="softblur" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="14"/>
  </filter>
</defs>

<!-- BASE -->
<rect width="${W}" height="${H}" fill="${theme.bg1}"/>
<rect width="${W}" height="${H}" fill="url(#g1)" filter="url(#bigblur)"/>
<rect width="${W}" height="${H}" fill="url(#g2)" filter="url(#bigblur)"/>
<rect width="${W}" height="${H}" fill="url(#g3)" filter="url(#bigblur)"/>
<rect width="${W}" height="${H}" fill="rgba(255,255,255,0.016)"/>

<!-- DECORATIVE GEOMETRY -->
<circle cx="980" cy="92"   r="130" fill="${theme.accent}"  opacity="0.075"/>
<circle cx="980" cy="92"   r="66"  fill="${theme.accent}"  opacity="0.10"/>
<circle cx="96"  cy="1270" r="88"  fill="none" stroke="${theme.accent2}" stroke-width="1.5" opacity="0.18"/>
<circle cx="96"  cy="1270" r="44"  fill="${theme.accent2}" opacity="0.06"/>
<!-- subtle diagonal rule -->
<line x1="0" y1="${(H*0.73).toFixed(0)}" x2="${W}" y2="${(H*0.63).toFixed(0)}"
  stroke="${theme.accent}" stroke-width="1" opacity="0.05"/>

<!-- CARD OUTER GLOW -->
<rect x="${CARD.x-2}" y="${CARD.y-2}" width="${CARD.w+4}" height="${CARD.h+4}"
  rx="${CARD.rx+2}" ry="${CARD.rx+2}"
  fill="none" stroke="${theme.accent}" stroke-width="1" opacity="0.16"
  filter="url(#softblur)"/>

<!-- GLASS CARD -->
<rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}"
  rx="${CARD.rx}" ry="${CARD.rx}"
  fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.09)" stroke-width="1.5"/>

<!-- HEADER PILL -->
<rect x="${CARD.x+28}" y="${CARD.y+32}" width="${CARD.w-56}" height="56"
  rx="14" ry="14"
  fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.065)" stroke-width="1"/>
<!-- Bullet -->
<text x="${CARD.x+56}" y="${CARD.y+62}"
  font-size="20" fill="${theme.accent}" font-family="sans-serif" dominant-baseline="middle"
>${BULLET}</text>
<!-- Category -->
<text x="${CARD.x+80}" y="${CARD.y+62}"
  font-size="23" fill="${theme.sub}" font-family="${FONT_FAM}" font-weight="900"
  letter-spacing="3" dominant-baseline="middle"
>${escapeXml(catTitle.toUpperCase())}</text>
<!-- Counter -->
<text x="${CARD.x+CARD.w-52}" y="${CARD.y+62}"
  font-size="21" fill="${theme.sub}" font-family="${FONT_FAM}" font-weight="700"
  text-anchor="end" dominant-baseline="middle" opacity="0.50"
>${idx+1}/${total}</text>
<!-- Header rule -->
<line x1="${CARD.x+28}" y1="${CARD.y+94}" x2="${CARD.x+CARD.w-28}" y2="${CARD.y+94}"
  stroke="rgba(255,255,255,0.065)" stroke-width="1"/>

<!-- QUOTE MARK DECORATION -->
<text x="${CARD.x+32}" y="${CARD.y+240}"
  font-size="190" fill="${theme.accent}" opacity="0.07"
  font-family="Georgia,serif" dominant-baseline="auto">&#x201C;</text>

<!-- TEXT RECTANGLE (blurred tinted bg for rectangular text alignment) -->
<rect x="${rectX.toFixed(1)}" y="${rectTop.toFixed(1)}"
  width="${rectW.toFixed(1)}" height="${rectH.toFixed(1)}"
  rx="16" ry="16"
  fill="${theme.accent}" opacity="0.06"/>
<!-- Left accent border on text rect -->
<rect x="${rectX.toFixed(1)}" y="${(rectTop+12).toFixed(1)}"
  width="5" height="${(rectH-24).toFixed(1)}"
  rx="3" ry="3"
  fill="${theme.accent}" opacity="0.75"/>

<!-- MAIN TEXT -->
${textLines.join("\n")}

<!-- PROGRESS DOTS -->
${dots}

<!-- CTA BAR -->
<rect x="${CARD.x+28}"   y="${CARD.y+CARD.h-98}" width="262" height="52" rx="26" fill="${theme.accent}" opacity="0.14"/>
<rect x="${CARD.x+30}"   y="${CARD.y+CARD.h-96}" width="258" height="48" rx="24" fill="rgba(0,0,0,0.32)"/>
<text x="${CARD.x+28+131}" y="${CARD.y+CARD.h-72}"
  font-size="25" fill="${theme.text}" font-family="${FONT_FAM}" font-weight="900"
  text-anchor="middle" dominant-baseline="middle"
>${escapeXml(CONFIG.HANDLE)}</text>

<!-- BOTTOM ACCENT LINE -->
<rect x="${CARD.x+28}" y="${CARD.y+CARD.h-24}" width="170" height="5" rx="2.5" fill="${theme.accent2}" opacity="0.5"/>
</svg>`;
}

// =========================================================
// PNG RENDERER
// =========================================================
async function renderPng(slide, idx, total, theme, catTitle) {
  const svg = buildSlide(slide, idx, total, theme, catTitle);
  const fontOpts = { loadSystemFonts: true };
  if (HAS_FONT) { fontOpts.fontFiles = ["./font.ttf"]; fontOpts.defaultFontFamily = "CardFont"; }
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: fontOpts });
  return resvg.render().asPng();
}

// =========================================================
// GROQ — CONTENT GENERATION
// =========================================================
const NICHES = [
  "STOICISM", "WEALTH MINDSET", "MOTIVATION", "PSYCHOLOGY",
  "DISCIPLINE", "SUCCESS HABITS", "EMOTIONAL INTELLIGENCE", "FOCUS & PRODUCTIVITY",
];

async function generateContent(niche) {
  if (!SECRETS.GROQ_API_KEY) throw new Error("GROQ_API_KEY missing!");

  const prompt = `You are a viral Instagram carousel copywriter. Create a ${CONFIG.SLIDE_COUNT}-slide carousel for: "${niche}".

RULES:
1. Exactly ${CONFIG.SLIDE_COUNT} slides.
2. Slide 1: hook question, 8-12 words, start with "What if", "Why do", "How does", "Did you know", etc.
3. Slides 2-${CONFIG.SLIDE_COUNT}: each MUST be exactly 10-14 words — a deep psychological truth or actionable insight. No shorter. No longer.
4. "highlight": array of 1-2 exact words/phrases from that slide's text to emphasise.
5. "emoji": one relevant emoji per slide.
6. "theme_title": catchy 2-4 word heading e.g. "MINDSET SHIFT", "WEALTH SECRET #1".
7. "caption": unique, curiosity-driven hook UNDER 12 words + 1-2 emojis, then two newlines, then three dots each on a new line, then 5 viral hashtags.
   Caption MUST be unique and niche-specific. Do NOT use generic phrases.
   Format exactly:
   [hook under 12 words] [emoji][emoji]\\n\\n.\\n.\\n.\\n#tag1 #tag2 #tag3 #tag4 #tag5

Return ONLY raw JSON. No markdown fences. No explanation.
{
  "theme_title": "...",
  "slides": [{"text":"...","highlight":["..."],"emoji":"..."}],
  "caption": "..."
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization:`Bearer ${SECRETS.GROQ_API_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({ model:CONFIG.GROQ_MODEL, messages:[{role:"user",content:prompt}], temperature:0.82 }),
  });
  if (!res.ok) throw new Error(`Groq: ${await res.text()}`);

  const raw   = (await res.json()).choices[0].message.content.trim();
  const clean = raw.replace(/^```json\s*/,"").replace(/\s*```$/,"").trim();
  const data  = JSON.parse(clean);

  // Warn on word count drift — don't block
  data.slides.forEach((s, i) => {
    if (i === 0) return;
    const wc = s.text.trim().split(/\s+/).length;
    if (wc < 9 || wc > 15) console.warn(`  ⚠ Slide ${i+1} word count ${wc} (target 10-14)`);
  });
  return data;
}

// =========================================================
// FALLBACK
// =========================================================
const FALLBACK = {
  theme_title: "MINDSET SHIFT",
  slides: [
    { text:"What if one decision today could reshape your entire future?",         highlight:["one decision"],     emoji:"🧠" },
    { text:"Most people never start because they wait to feel completely ready.",   highlight:["wait","ready"],      emoji:"⚠️" },
    { text:"Your brain silently becomes whatever you choose to repeatedly think.",  highlight:["repeatedly","brain"],emoji:"🔁" },
    { text:"True discipline means doing the hard work before you feel motivated.",  highlight:["discipline","work"], emoji:"🎯" },
    { text:"Write three small wins every single morning to rewire your mindset.",   highlight:["three wins","rewire"],emoji:"⚡" },
    { text:"Shift your inner narrative daily and you will shift your whole world.", highlight:["narrative","world"], emoji:"🚀" },
  ],
  caption:"This is the mindset shift that changes everything. 🧠👇\n\n.\n.\n.\n#mindset #psychology #success #stoicism #viral",
};

// =========================================================
// FACEBOOK
// =========================================================
async function getPageToken(pid, token) {
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${pid}?fields=access_token&access_token=${token}`);
    if (r.ok) { const j = await r.json(); if (j.access_token) return j.access_token; }
    console.warn(`Token exchange failed (${r.status}) — using provided token.`);
  } catch (e) { console.warn("Token exchange error:", e.message); }
  return token;
}

async function uploadSlide(buf, i, pid, token) {
  const fd = new FormData();
  fd.append("access_token", token);
  fd.append("published", "false");
  fd.append("source", new Blob([buf],{type:"image/png"}), `slide_${i}.png`);
  console.log(`  Uploading slide ${i+1}…`);
  const r = await fetch(`https://graph.facebook.com/v20.0/${pid}/photos`,{method:"POST",body:fd});
  if (!r.ok) throw new Error(`Slide ${i+1} upload failed: ${await r.text()}`);
  const d = await r.json();
  if (!d.id) throw new Error(`Slide ${i+1}: no ID in response`);
  return { media_fbid: d.id };
}

async function postCarousel(pngs, caption) {
  if (!SECRETS.PAGE_OR_IG_ID || !SECRETS.PAGE_ACCESS_TOKEN) throw new Error("Missing credentials!");
  const pid   = SECRETS.PAGE_OR_IG_ID;
  const token = await getPageToken(pid, SECRETS.PAGE_ACCESS_TOKEN);
  const ids   = await Promise.all(pngs.map((b,i) => uploadSlide(b,i,pid,token)));
  console.log("Publishing…");
  const r = await fetch(`https://graph.facebook.com/v20.0/${pid}/feed`,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body: new URLSearchParams({message:caption, attached_media:JSON.stringify(ids), access_token:token}),
  });
  if (!r.ok) throw new Error(`Post failed: ${await r.text()}`);
  const d = await r.json();
  console.log("✅ Posted! ID:", d.id);
}

// =========================================================
// MAIN
// =========================================================
async function run() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  FB Carousel Bot");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const niche = NICHES[Math.floor(Math.random() * NICHES.length)];
  console.log("Niche:", niche);

  let content = FALLBACK;
  try {
    console.log("Generating via Groq…");
    content = await generateContent(niche);
    console.log(`Theme: "${content.theme_title}"  Slides: ${content.slides.length}`);
  } catch (e) {
    console.error("Groq failed — using fallback:", e.message);
  }

  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  console.log("Visual theme:", theme.name);

  const pngs = [];
  for (let i = 0; i < content.slides.length; i++) {
    process.stdout.write(`  Rendering ${i+1}/${content.slides.length}… `);
    pngs.push(await renderPng(content.slides[i], i, content.slides.length, theme, content.theme_title));
    console.log("done");
  }

  console.log("Caption:", content.caption.split("\n")[0]);
  await postCarousel(pngs, content.caption);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  All done! ✅");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
  
