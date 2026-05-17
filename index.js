import { Resvg } from "@resvg/resvg-js";
import fs from "fs";

// =========================================================
// CONFIG
// =========================================================
const CONFIG = {
  HANDLE: "@Akhil",

  GROQ_MODEL: "openai/gpt-oss-120b",

  WIDTH: 1080,

  HEIGHT: 1350,
};

// =========================================================
// FALLBACK
// =========================================================
const FALLBACK = {
  theme_title: "PSYCHOLOGY",

  slides: [
    {
      text:
        "People become emotionally dangerous when attention matters more than honesty.",

      highlight: [
        "emotionally dangerous",
        "honesty",
      ],
    },
  ],

  caption:
    "Most people miss this.\n\n.\n.\n.\n#psychology #mindset #relationships #selfrespect #humanbehavior",
};

// =========================================================
// SECRETS
// =========================================================
function loadSecrets() {
  let cfg = {};

  try {
    if (fs.existsSync("./wrangler.toml")) {
      const raw = fs.readFileSync(
        "./wrangler.toml",
        "utf-8"
      );

      const get = (k) => {
        const m = raw.match(
          new RegExp(
            `${k}\\s*=\\s*\"([^\"]+)\"`
          )
        );

        return m?.[1] ?? null;
      };

      cfg.PAGE_OR_IG_ID =
        get("PAGE_OR_IG_ID");

      cfg.PAGE_ACCESS_TOKEN = get(
        "PAGE_ACCESS_TOKEN"
      );

      cfg.GROQ_API_KEY =
        get("GROQ_API_KEY");

      cfg.APP_ID = get("APP_ID");

      cfg.APP_SECRET =
        get("APP_SECRET");

      cfg.USER_ACCESS_TOKEN =
        get("USER_ACCESS_TOKEN");
    }
  } catch {}

  return {
    PAGE_OR_IG_ID:
      process.env.PAGE_OR_IG_ID ??
      cfg.PAGE_OR_IG_ID,

    PAGE_ACCESS_TOKEN:
      process.env.PAGE_ACCESS_TOKEN ??
      cfg.PAGE_ACCESS_TOKEN,

    GROQ_API_KEY:
      process.env.GROQ_API_KEY ??
      cfg.GROQ_API_KEY,

    APP_ID:
      process.env.APP_ID ??
      cfg.APP_ID,

    APP_SECRET:
      process.env.APP_SECRET ??
      cfg.APP_SECRET,

    USER_ACCESS_TOKEN:
      process.env
        .USER_ACCESS_TOKEN ??
      cfg.USER_ACCESS_TOKEN,
  };
}

const SECRETS = loadSecrets();

// =========================================================
// THEMES
// =========================================================
const THEMES = [
  {
    name: "Midnight Luxury",

    bg1: "#050816",

    accent: "#8b5cf6",

    accent2: "#ec4899",

    text: "#f8fafc",

    sub: "#94a3b8",
  },

  {
    name: "Luxury Gold",

    bg1: "#0b0800",

    accent: "#f59e0b",

    accent2: "#fcd34d",

    text: "#fff7e6",

    sub: "#fbbf24",
  },

  {
    name: "Cyber Dark",

    bg1: "#070b14",

    accent: "#38bdf8",

    accent2: "#22d3ee",

    text: "#f1f5f9",

    sub: "#94a3b8",
  },

  {
    name: "Crimson Noir",

    bg1: "#120609",

    accent: "#ef4444",

    accent2: "#f43f5e",

    text: "#fff1f2",

    sub: "#fda4af",
  },

  {
    name: "Emerald Elite",

    bg1: "#04120d",

    accent: "#10b981",

    accent2: "#34d399",

    text: "#ecfdf5",

    sub: "#6ee7b7",
  },

  {
    name: "Royal Violet",

    bg1: "#14051f",

    accent: "#a855f7",

    accent2: "#d946ef",

    text: "#faf5ff",

    sub: "#d8b4fe",
  },
];

function getTheme() {
  return THEMES[
    Math.floor(
      Math.random() *
        THEMES.length
    )
  ];
}

// =========================================================
// FONT
// =========================================================
const HAS_FONT = fs.existsSync(
  "./font.ttf"
);

const FONT_FAM = HAS_FONT
  ? "'CardFont','Arial Black',sans-serif"
  : "'Arial Black',sans-serif";

function getFontFaceCSS() {
  if (!HAS_FONT) return "";

  const b64 = fs
    .readFileSync("./font.ttf")
    .toString("base64");

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
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function estimateTextWidth(
  text,
  fs
) {
  return text.length * fs * 0.58;
}

function splitHighlights(
  line,
  highlights
) {
  const hls = [
    ...(highlights ?? []),
  ]
    .filter(Boolean)
    .sort(
      (a, b) => b.length - a.length
    );

  let parts = [
    {
      t: line,
      h: false,
    },
  ];

  for (const hl of hls) {
    const safe = hl.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const re = new RegExp(
      `(${safe})`,
      "gi"
    );

    parts = parts.flatMap((p) => {
      if (p.h) return [p];

      return p.t
        .split(re)
        .filter(Boolean)
        .map((s) => ({
          t: s,

          h:
            s.toLowerCase() ===
            hl.toLowerCase(),
        }));
    });
  }

  return parts;
}

function wordWrap(
  text,
  maxChars
) {
  const words = text.split(" ");

  const lines = [];

  let cur = "";

  for (const w of words) {
    const next = cur
      ? cur + " " + w
      : w;

    if (
      next.length > maxChars &&
      cur
    ) {
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
  for (const fs of [
    110,
    96,
    84,
    74,
    64,
  ]) {
    const maxChars = Math.floor(
      760 / (fs * 0.62)
    );

    const lines = wordWrap(
      text,
      maxChars
    );

    if (lines.length <= 4) {
      return {
        fs,

        lines,

        lh: fs * 1.45,
      };
    }
  }

  return {
    fs: 58,

    lines: wordWrap(text, 16),

    lh: 84,
  };
}

// =========================================================
// AI VALIDATION
// =========================================================
function cleanHighlights(slide) {
  const textLower =
    slide.text.toLowerCase();

  slide.highlight = (
    slide.highlight || []
  ).filter((h) =>
    textLower.includes(
      String(h).toLowerCase()
    )
  );

  if (
    slide.highlight.length === 0
  ) {
    const words = slide.text
      .split(/\s+/)
      .filter(
        (w) => w.length > 5
      );

    if (words.length) {
      slide.highlight = [
        words[
          Math.floor(
            words.length / 2
          )
        ],
      ];
    }
  }

  return slide;
}

// =========================================================
// SVG
// =========================================================
const W = CONFIG.WIDTH;

const H = CONFIG.HEIGHT;

const CENTER_X = W / 2;

function renderStyledLine(
  parts,
  y,
  fs,
  theme
) {
  let x = CENTER_X;

  const totalWidth =
    parts.reduce(
      (acc, p) =>
        acc +
        estimateTextWidth(
          p.t,
          fs
        ),

      0
    );

  x -= totalWidth / 2;

  let svg = "";

  for (const p of parts) {
    const w = estimateTextWidth(
      p.t,
      fs
    );

    if (p.h) {
      svg += `
      <rect
        x="${x - 18}"

        y="${y - fs + 18}"

        width="${w + 36}"

        height="${fs + 24}"

        rx="22"

        fill="${theme.accent}"

        opacity="0.95"

        style="filter: drop-shadow(0 0 20px ${theme.accent})"
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

      fill="${
        p.h
          ? theme.bg1
          : theme.text
      }"
    >
      ${escapeXml(p.t)}
    </text>
    `;

    x += w;
  }

  return svg;
}

function buildImage(
  slide,
  theme,
  title
) {
  const { fs, lines, lh } =
    computeLayout(slide.text);

  let lineY = 520;

  const textLines = [];

  for (const line of lines) {
    const parts =
      splitHighlights(
        line,
        slide.highlight
      );

    textLines.push(
      renderStyledLine(
        parts,
        lineY,
        fs,
        theme
      )
    );

    lineY += lh;
  }

  return `
<svg
width="${W}"
height="${H}"
xmlns="http://www.w3.org/2000/svg"
>

<defs>
${getFontFaceCSS()}
</defs>

<rect
width="100%"
height="100%"
fill="${theme.bg1}"
/>

<circle
cx="980"
cy="90"
r="160"
fill="${theme.accent}"
opacity="0.08"
/>

<circle
cx="90"
cy="1260"
r="110"
fill="${theme.accent2}"
opacity="0.08"
/>

<text
x="540"
y="120"
font-size="28"
fill="${theme.sub}"
font-family="${FONT_FAM}"
font-weight="900"
letter-spacing="5"
text-anchor="middle"
>
${escapeXml(title)}
</text>

${textLines.join("\n")}

<text
x="540"
y="1260"
font-size="32"
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
  theme,
  title
) {
  const svg = buildImage(
    slide,
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
    opts.font.fontFiles = [
      "./font.ttf",
    ];

    opts.font.defaultFontFamily =
      "CardFont";
  }

  const resvg = new Resvg(
    svg,
    opts
  );

  return resvg.render().asPng();
}

// =========================================================
// AI CONTENT
// =========================================================
const NICHES = [
  "PSYCHOLOGY",

  "WEALTH",

  "MONEY",

  "RELATIONSHIPS",

  "DISCIPLINE",

  "SELF RESPECT",

  "EMOTIONAL INTELLIGENCE",

  "HUMAN BEHAVIOR",
];

async function generateContent(
  niche
) {
  const prompt = `
You are an elite viral quote writer for modern psychology and self-awareness pages.

Create ONE short emotionally powerful quote.

TOPICS:
- psychology
- money
- wealth
- relationships
- discipline
- self respect
- emotional intelligence
- human behavior

STYLE:
- emotionally sharp
- psychologically accurate
- socially intelligent
- realistic
- introspective
- slightly uncomfortable
- premium and modern

RULES:
- 20-25 words maximum
- must feel human-written
- must feel relatable instantly
- should trigger reflection
- avoid generic motivation
- avoid fake hustle culture
- avoid spiritual clichés
- avoid therapy language
- avoid fake alpha male tone
- avoid sounding like AI

DO NOT USE:
- "believe in yourself"
- "never give up"
- "success takes time"
- "stay positive"
- "great things take time"
- "you are enough"

The quote should sound like:
- a painful realization
- a deep social observation
- emotional intelligence
- hidden truth about people

highlight:
- MUST contain exact words from quote

caption:
- under 10 words
- curiosity-driven
- emotionally intriguing

Return ONLY raw JSON.

{
  "theme_title":"SHORT POWER TITLE",
  "slides":[
    {
      "text":"...",
      "highlight":["..."]
    }
  ],
  "caption":"..."
}
`;

  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",

    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${SECRETS.GROQ_API_KEY}`,

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        model:
          CONFIG.GROQ_MODEL,

        temperature: 1,

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
    throw new Error(
      await res.text()
    );
  }

  const raw = (
    await res.json()
  ).choices[0].message.content.trim();

  const clean = raw
    .replace(/^```json/, "")
    .replace(/```$/, "")
    .trim();

  let data;

  try {
    data = JSON.parse(clean);
  } catch (e) {
    console.error(
      "Invalid AI JSON"
    );

    throw new Error(
      "Malformed JSON"
    );
  }

  if (
    !data ||
    !Array.isArray(
      data.slides
    )
  ) {
    throw new Error(
      "Invalid AI structure"
    );
  }

  data.slides = data.slides.map(
    cleanHighlights
  );

  if (!data.slides.length) {
    throw new Error(
      "No valid slides"
    );
  }

  return data;
}

// =========================================================
// TOKEN EXCHANGE
// =========================================================
async function getPageAccessToken() {
  if (
    SECRETS.PAGE_ACCESS_TOKEN &&
    SECRETS.PAGE_ACCESS_TOKEN.startsWith(
      "EA"
    )
  ) {
    console.log(
      "Using direct PAGE_ACCESS_TOKEN"
    );

    return SECRETS.PAGE_ACCESS_TOKEN;
  }

  if (
    !SECRETS.APP_ID ||
    !SECRETS.APP_SECRET ||
    !SECRETS.USER_ACCESS_TOKEN
  ) {
    throw new Error(
      "Missing APP_ID / APP_SECRET / USER_ACCESS_TOKEN"
    );
  }

  console.log(
    "Generating long-lived user token..."
  );

  const tokenRes = await fetch(
    `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${SECRETS.APP_ID}&client_secret=${SECRETS.APP_SECRET}&fb_exchange_token=${SECRETS.USER_ACCESS_TOKEN}`
  );

  const tokenData =
    await tokenRes.json();

  if (!tokenData.access_token) {
    throw new Error(
      JSON.stringify(tokenData)
    );
  }

  console.log(
    "Fetching managed pages..."
  );

  const pagesRes = await fetch(
    `https://graph.facebook.com/v20.0/me/accounts?access_token=${tokenData.access_token}`
  );

  const pagesData =
    await pagesRes.json();

  if (
    !pagesData.data ||
    !pagesData.data.length
  ) {
    throw new Error(
      "No managed pages found"
    );
  }

  const selectedPage =
    pagesData.data.find(
      (p) =>
        p.id ===
        SECRETS.PAGE_OR_IG_ID
    ) || pagesData.data[0];

  if (
    !selectedPage.access_token
  ) {
    throw new Error(
      "No page access token found"
    );
  }

  console.log(
    `Using page: ${selectedPage.name}`
  );

  return selectedPage.access_token;
}

// =========================================================
// FACEBOOK
// =========================================================
async function uploadPhoto(
  png,
  caption
) {
  const pid =
    SECRETS.PAGE_OR_IG_ID;

  if (!pid) {
    throw new Error(
      "Missing PAGE_OR_IG_ID"
    );
  }

  const token =
    await getPageAccessToken();

  if (!token) {
    throw new Error(
      "Missing valid token"
    );
  }

  const fd = new FormData();

  fd.append(
    "access_token",
    token
  );

  fd.append(
    "message",
    caption
  );

  fd.append(
    "source",

    new Blob([png], {
      type: "image/png",
    }),

    "quote.png"
  );

  const r = await fetch(
    `https://graph.facebook.com/v20.0/${pid}/photos`,
    {
      method: "POST",

      body: fd,
    }
  );

  const text = await r.text();

  if (!r.ok) {
    throw new Error(text);
  }

  const d = JSON.parse(text);

  console.log(
    "Posted:",
    d.id
  );
}

// =========================================================
// MAIN
// =========================================================
async function run() {
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━"
  );

  console.log(
    "AI QUOTE ENGINE"
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━"
  );

  const niche =
    NICHES[
      Math.floor(
        Math.random() *
          NICHES.length
      )
    ];

  console.log(
    "Niche:",
    niche
  );

  const theme = getTheme();

  console.log(
    "Theme:",
    theme.name
  );

  let content;

  try {
    content =
      await generateContent(
        niche
      );
  } catch (e) {
    console.error(
      "AI failed:",
      e.message
    );

    content = FALLBACK;
  }

  const slide =
    content.slides[0];

  const png =
    await renderPng(
      slide,
      theme,
      content.theme_title
    );

  fs.writeFileSync(
    "quote.png",
    png
  );

  await uploadPhoto(
    png,
    content.caption
  );

  console.log("DONE ✅");
}

run().catch((e) => {
  console.error(
    "Fatal:",
    e
  );

  process.exit(1);
});
