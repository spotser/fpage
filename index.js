import { Resvg } from "@resvg/resvg-js";
import fs from "fs";

// =========================================================
// CONFIG
// =========================================================
const CONFIG = {
  HANDLE: "@Akhil",
  GROQ_MODEL: "llama-3.3-70b-versatile",
  SLIDE_COUNT: 6,
  WIDTH: 1080,
  HEIGHT: 1350,
};

// =========================================================
// SECRETS
// =========================================================
function loadSecrets() {
  let cfg = {};

  try {
    if (fs.existsSync("./wrangler.toml")) {
      const raw = fs.readFileSync("./wrangler.toml", "utf-8");

      const get = (k) => {
        const m = raw.match(new RegExp(`${k}\\s*=\\s*"([^"]+)"`));
        return m?.[1] ?? null;
      };

      cfg.PAGE_OR_IG_ID = get("PAGE_OR_IG_ID");
      cfg.PAGE_ACCESS_TOKEN = get("PAGE_ACCESS_TOKEN");
      cfg.GROQ_API_KEY = get("GROQ_API_KEY");
    }
  } catch {}

  return {
    PAGE_OR_IG_ID:
      process.env.PAGE_OR_IG_ID ?? cfg.PAGE_OR_IG_ID,

    PAGE_ACCESS_TOKEN:
      process.env.PAGE_ACCESS_TOKEN ?? cfg.PAGE_ACCESS_TOKEN,

    GROQ_API_KEY:
      process.env.GROQ_API_KEY ?? cfg.GROQ_API_KEY,
  };
}

const SECRETS = loadSecrets();

// =========================================================
// THEMES
// =========================================================
const THEMES = [
  {
    name: "Neon Dark",
    bg1: "#060d1f",
    bg2: "#0f1e3a",
    accent: "#38bdf8",
    accent2: "#818cf8",
    text: "#f1f5f9",
    sub: "#94a3b8",
  },
  {
    name: "Luxury Gold",
    bg1: "#0a0800",
    bg2: "#1a1200",
    accent: "#f59e0b",
    accent2: "#fbbf24",
    text: "#fff7e6",
    sub: "#fcd34d",
  },
  {
    name: "Cyber Pink",
    bg1: "#140019",
    bg2: "#240031",
    accent: "#ff4fd8",
    accent2: "#9f7aea",
    text: "#ffffff",
    sub: "#e9d5ff",
  },
];

function getThemeForNiche(niche) {
  const map = {
    STOICISM: "Luxury Gold",
    PSYCHOLOGY: "Cyber Pink",
    DISCIPLINE: "Neon Dark",
  };

  return (
    THEMES.find((t) => t.name === map[niche]) ||
    THEMES[Math.floor(Math.random() * THEMES.length)]
  );
}

// =========================================================
// FONT
// =========================================================
const HAS_FONT = fs.existsSync("./font.ttf");

const FONT_FAM = HAS_FONT
  ? "'CardFont','Arial Black',sans-serif"
  : "'Arial Black',sans-serif";

function getFontFaceCSS() {
  if (!HAS_FONT) return "";

  const b64 = fs.readFileSync("./font.ttf").toString("base64");

  return `
  @font-face {
    font-family:'CardFont';
    src:url('data:font/truetype;base64,${b64}') format('truetype');
  }
  `;
}

// =========================================================
// UTILITIES
// =========================================================
function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function estimateTextWidth(text, fs) {
  return text.length * fs * 0.58;
}

function splitHighlights(line, highlights) {
  const hls = [...(highlights ?? [])]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  let parts = [{ t: line, h: false }];

  for (const hl of hls) {
    const re = new RegExp(
      `(${hl.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")})`,
      "gi"
    );

    parts = parts.flatMap((p) => {
      if (p.h) return [p];

      return p.t
        .split(re)
        .filter(Boolean)
        .map((s) => ({
          t: s,
          h: s.toLowerCase() === hl.toLowerCase(),
        }));
    });
  }

  return parts;
}

function wordWrap(text, maxChars) {
  const words = text.split(" ");

  const lines = [];

  let cur = "";

  for (const w of words) {
    const next = cur ? cur + " " + w : w;

    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }

  if (cur) lines.push(cur);

  return lines;
}

function computeLayout(text) {
  for (const fs of [82, 74, 66, 58, 50]) {
    const maxChars = Math.floor(820 / (fs * 0.62));

    const lines = wordWrap(text, maxChars);

    if (lines.length <= 4) {
      return {
        fs,
        lines,
        lh: fs * 1.5,
      };
    }
  }

  return {
    fs: 48,
    lines: wordWrap(text, 18),
    lh: 72,
  };
}

// =========================================================
// AI VALIDATION
// =========================================================
function cleanHighlights(slide) {
  const textLower = slide.text.toLowerCase();

  slide.highlight = (slide.highlight || []).filter((h) =>
    textLower.includes(String(h).toLowerCase())
  );

  if (slide.highlight.length === 0) {
    const words = slide.text
      .split(/\\s+/)
      .filter((w) => w.length > 5);

    if (words.length) {
      slide.highlight = [
        words[Math.floor(words.length / 2)],
      ];
    }
  }

  return slide;
}

function validateSlide(slide) {
  const banned = [
    "believe in yourself",
    "never give up",
    "success takes time",
    "stay positive",
  ];

  return !banned.some((b) =>
    slide.text.toLowerCase().includes(b)
  );
}

// =========================================================
// SVG RENDERING
// =========================================================
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;
const TZ_CX = W / 2;

function renderStyledLine(parts, y, fs, theme) {
  let x = TZ_CX;

  const totalWidth = parts.reduce((acc, p) => {
    return acc + estimateTextWidth(p.t, fs);
  }, 0);

  x -= totalWidth / 2;

  let svg = "";

  for (const p of parts) {
    const w = estimateTextWidth(p.t, fs);

    if (p.h) {
      svg += `
      <rect
        x="${x - 14}"
        y="${y - fs + 18}"
        width="${w + 28}"
        height="${fs + 22}"
        rx="18"
        fill="${theme.accent}"
        opacity="0.94"
        stroke="rgba(255,255,255,0.18)"
        stroke-width="1.2"
        style="filter: drop-shadow(0 0 16px ${theme.accent})"
      />
      `;
    }

    svg += `
    <text
      x="${x}"
      y="${y}"
      font-size="${fs}"
      font-family="${FONT_FAM}"
      font-weight="900"
      fill="${p.h ? theme.bg1 : theme.text}"
    >${escapeXml(p.t)}</text>
    `;

    x += w;
  }

  return svg;
}

function buildSlide(slide, idx, total, theme, catTitle) {
  const { fs, lines, lh } = computeLayout(slide.text);

  const isInterrupt = idx === Math.floor(total / 2);

  let lineY = 510;

  const textLines = [];

  for (const line of lines) {
    const parts = splitHighlights(
      line,
      slide.highlight
    );

    textLines.push(
      renderStyledLine(
        parts,
        lineY,
        isInterrupt ? fs * 1.18 : fs,
        theme
      )
    );

    lineY += lh;
  }

  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">

<defs>
${getFontFaceCSS()}
</defs>

<rect width="100%" height="100%" fill="${
    isInterrupt ? "#000000" : theme.bg1
  }"/>

<circle
cx="${980 - idx * 8}"
cy="${92 + idx * 4}"
r="130"
fill="${theme.accent}"
opacity="0.08"
/>

<circle
cx="${96 + idx * 10}"
cy="${1270 - idx * 5}"
r="88"
fill="${theme.accent2}"
opacity="0.06"
/>

<text
x="80"
y="120"
font-size="26"
fill="${theme.sub}"
font-family="${FONT_FAM}"
font-weight="900"
letter-spacing="4"
>
${escapeXml(catTitle)}
</text>

${textLines.join("\n")}

<text
x="540"
y="1220"
font-size="28"
text-anchor="middle"
fill="${theme.sub}"
font-family="${FONT_FAM}"
>
${idx + 1}/${total}
</text>

<text
x="540"
y="1280"
font-size="30"
text-anchor="middle"
fill="${theme.text}"
font-family="${FONT_FAM}"
font-weight="900"
>
${CONFIG.HANDLE}
</text>

</svg>
`;
}

// =========================================================
// PNG
// =========================================================
async function renderPng(
  slide,
  idx,
  total,
  theme,
  title
) {
  const svg = buildSlide(
    slide,
    idx,
    total,
    theme,
    title
  );

  const opts = {
    fitTo: {
      mode: "width",
      value: W,
    },
    font: {
      loadSystemFonts: true,
    },
  };

  if (HAS_FONT) {
    opts.font.fontFiles = ["./font.ttf"];
    opts.font.defaultFontFamily = "CardFont";
  }

  const resvg = new Resvg(svg, opts);

  return resvg.render().asPng();
}

// =========================================================
// CONTENT GENERATION
// =========================================================
const NICHES = [
  "PSYCHOLOGY",
  "DISCIPLINE",
  "STOICISM",
  "WEALTH MINDSET",
];

async function generateContent(niche) {
  const prompt = `You are an elite viral Instagram carousel strategist.

Create a ${CONFIG.SLIDE_COUNT}-slide carousel for niche: ${niche}.

RULES:
- Every slide must connect emotionally.
- Avoid generic motivation.
- Make content psychologically deep.

Slide 1:
Curiosity hook.

Slide 2:
Hidden pain.

Slide 3:
Psychological explanation.

Slide 4:
Mindset shift.

Slide 5:
Practical action.

Slide 6:
Powerful emotional conclusion.

Slides 2-6 must be 10-15 words.

"highlight" must contain EXACT words from slide text.

Caption must be short and curiosity-driven.

Return ONLY valid JSON.
`;

  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SECRETS.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CONFIG.GROQ_MODEL,
        temperature: 0.85,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const raw = (
    await res.json()
  ).choices[0].message.content.trim();

  const clean = raw
    .replace(/^```json/, "")
    .replace(/```$/, "")
    .trim();

  const data = JSON.parse(clean);

  data.slides = data.slides
    .map(cleanHighlights)
    .filter(validateSlide);

  if (data.slides.length < CONFIG.SLIDE_COUNT) {
    throw new Error("Weak AI response");
  }

  return data;
}

// =========================================================
// CTA ROTATION
// =========================================================
const CTA_POOL = [
  "Read this again tomorrow.",
  "Most people realize this too late.",
  "Your habits silently become your identity.",
  "This changes once your thinking changes.",
  "Your future depends on your invisible routines.",
];

// =========================================================
// FACEBOOK POSTING
// =========================================================
async function uploadSlide(buf, i, pid, token) {
  const fd = new FormData();

  fd.append("access_token", token);
  fd.append("published", "false");

  fd.append(
    "source",
    new Blob([buf], {
      type: "image/png",
    }),
    `slide_${i}.png`
  );

  const r = await fetch(
    `https://graph.facebook.com/v20.0/${pid}/photos`,
    {
      method: "POST",
      body: fd,
    }
  );

  if (!r.ok) {
    throw new Error(await r.text());
  }

  const d = await r.json();

  return {
    media_fbid: d.id,
  };
}

async function postCarousel(pngs, caption) {
  const pid = SECRETS.PAGE_OR_IG_ID;

  const token = SECRETS.PAGE_ACCESS_TOKEN;

  const ids = await Promise.all(
    pngs.map((b, i) => uploadSlide(b, i, pid, token))
  );

  const r = await fetch(
    `https://graph.facebook.com/v20.0/${pid}/feed`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        message: caption,
        attached_media: JSON.stringify(ids),
        access_token: token,
      }),
    }
  );

  if (!r.ok) {
    throw new Error(await r.text());
  }

  const d = await r.json();

  console.log("Posted:", d.id);
}

// =========================================================
// MAIN
// =========================================================
async function run() {
  console.log("━━━━━━━━━━━━━━━━━━━━━");
  console.log("AI CAROUSEL ENGINE");
  console.log("━━━━━━━━━━━━━━━━━━━━━");

  const niche =
    NICHES[Math.floor(Math.random() * NICHES.length)];

  console.log("Niche:", niche);

  const theme = getThemeForNiche(niche);

  console.log("Theme:", theme.name);

  const content = await generateContent(niche);

  content.slides[
    content.slides.length - 1
  ].text =
    CTA_POOL[
      Math.floor(Math.random() * CTA_POOL.length)
    ];

  const pngs = [];

  for (let i = 0; i < content.slides.length; i++) {
    try {
      console.log(
        `Rendering ${i + 1}/${content.slides.length}`
      );

      pngs.push(
        await renderPng(
          content.slides[i],
          i,
          content.slides.length,
          theme,
          content.theme_title
        )
      );
    } catch (e) {
      console.error(
        `Render failed slide ${i + 1}`,
        e.message
      );
    }
  }

  await postCarousel(
    pngs,
    content.caption
  );

  console.log("DONE ✅");
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
