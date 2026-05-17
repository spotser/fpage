import { Resvg } from "@resvg/resvg-js";
import fs from "fs";

// =========================================================
// ENVIRONMENT & SECRETS LOADER
// =========================================================
function loadSecrets() {
  let config = {};
  try {
    if (fs.existsSync('./wrangler.toml')) {
      const content = fs.readFileSync('./wrangler.toml', 'utf-8');
      const getVal = (key) => {
        const match = content.match(new RegExp(`${key}\\s*=\\s*"([^"]+)"`));
        return match ? match[1] : null;
      };
      config.PAGE_OR_IG_ID = getVal('PAGE_OR_IG_ID');
      config.PAGE_ACCESS_TOKEN = getVal('PAGE_ACCESS_TOKEN');
      config.GROQ_API_KEY = getVal('GROQ_API_KEY');
    }
  } catch(e) {
    console.warn("Could not read wrangler.toml, relying on environment variables.");
  }
  
  return {
    PAGE_OR_IG_ID: process.env.PAGE_OR_IG_ID || config.PAGE_OR_IG_ID,
    PAGE_ACCESS_TOKEN: process.env.PAGE_ACCESS_TOKEN || config.PAGE_ACCESS_TOKEN,
    GROQ_API_KEY: process.env.GROQ_API_KEY || config.GROQ_API_KEY,
  };
}

const SECRETS = loadSecrets();
const GROQ_MODEL = "llama-3.3-70b-versatile";

// =========================================================
// SVG CAROUSEL TEMPLATE CONSTANTS
// =========================================================
const WIDTH = 1080;
const HEIGHT = 1350;

const THEMES = [
  {
    name: "Neon Dark",
    bg1: "#0f172a",
    bg2: "#1e293b",
    accent: "#38bdf8",
    accent2: "#a855f7",
    text: "#ffffff",
    sub: "#cbd5e1"
  },
  {
    name: "Luxury Gold",
    bg1: "#0f0f0f",
    bg2: "#1e1b16",
    accent: "#fbbf24",
    accent2: "#f59e0b",
    text: "#ffffff",
    sub: "#e5e7eb"
  },
  {
    name: "Cyber Pink",
    bg1: "#1e1b4b",
    bg2: "#312e81",
    accent: "#ec4899",
    accent2: "#8b5cf6",
    text: "#ffffff",
    sub: "#ddd6fe"
  }
];

function getFontSize(text) {
  const len = text.length;
  if (len < 35) return 82;
  if (len < 55) return 72;
  if (len < 75) return 62;
  if (len < 100) return 54;
  return 46;
}

function wrapText(text, maxChars = 16) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + word).length > maxChars) {
      lines.push(line.trim());
      line = word + " ";
    } else {
      line += word + " ";
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function renderHighlightedText(lines, highlights, fontSize, theme) {
  const totalHeight = lines.length * (fontSize * 1.5);
  let y = 320 - (totalHeight / 2) + (fontSize / 2);

  return lines.map(line => {
    let modified = line;
    const hl = Array.isArray(highlights) ? highlights : [];
    hl.forEach(h => {
      // Basic string replace for exact matches
      if (h) modified = modified.split(h).join(`|||${h}|||`);
    });

    const parts = modified.split("|||");
    const tspans = parts.map((part, i) => {
      const isHighlight = hl.includes(part);
      const span = `
        <tspan
          fill="${isHighlight ? theme.accent : theme.text}"
          font-weight="${isHighlight ? 900 : 700}"
          text-decoration="${isHighlight ? "underline" : "none"}"
        >${part}</tspan>
      `;
      return span;
    }).join("");

    const textSvg = `
      <text
        x="540"
        y="${y}"
        font-size="${fontSize}"
        font-family="'Outfit', 'Noto Sans Devanagari', sans-serif"
        text-anchor="middle"
        line-height="1.4"
        stroke="currentColor"
        stroke-width="1.5"
      >
        ${tspans}
      </text>
    `;
    y += fontSize * 1.5;
    return textSvg;
  }).join("");
}

function generateSlide(slide, index, theme, category, totalSlides) {
  const fontSize = getFontSize(slide.text);
  const lines = wrapText(slide.text);
  const renderedText = renderHighlightedText(lines, slide.highlight, fontSize, theme);

  return `
  <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g1">
        <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="${theme.bg1}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g2">
        <stop offset="0%" stop-color="${theme.accent2}" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="${theme.bg2}" stop-opacity="0"/>
      </radialGradient>
      <filter id="blur">
        <feGaussianBlur stdDeviation="50"/>
      </filter>
    </defs>

    <!-- BACKGROUND -->
    <rect width="100%" height="100%" fill="${theme.bg1}"/>

    <!-- Animated Blobs (Static capture in resvg, but visually pleasing) -->
    <circle cx="250" cy="250" r="300" fill="url(#g1)" filter="url(#blur)" />
    <circle cx="850" cy="950" r="350" fill="url(#g2)" filter="url(#blur)" />

    <!-- Noise Overlay -->
    <rect width="100%" height="100%" fill="rgba(255,255,255,0.02)"/>

    <!-- Decorative Shapes -->
    <circle cx="950" cy="120" r="80" fill="${theme.accent}" opacity="0.15"/>
    <rect x="70" y="1100" width="200" height="10" rx="5" fill="${theme.accent2}" opacity="0.4"/>

    <!-- Quote Marks -->
    <text x="70" y="180" font-size="160" fill="${theme.accent}" opacity="0.18" font-family="serif">“</text>

    <!-- Glass Card -->
    <rect x="60" y="120" rx="42" ry="42" width="960" height="1080" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>

    <!-- Emoji -->
    <text x="120" y="260" font-size="72">${slide.emoji || '✨'}</text>

    <!-- CATEGORY -->
    <text x="210" y="250" font-size="36" fill="${theme.sub}" font-family="sans-serif" letter-spacing="4" font-weight="700">
      ${category.toUpperCase()}
    </text>

    <!-- SLIDE INDICATOR -->
    <text x="780" y="250" font-size="28" fill="${theme.sub}" font-family="sans-serif" font-weight="700" opacity="0.6">
      ${index + 1} / ${totalSlides}
    </text>

    <!-- MAIN TEXT -->
    <g transform="translate(0,420)">
      ${renderedText}
    </g>

    <!-- CTA BAR -->
    <rect x="100" y="1120" width="320" height="70" rx="35" fill="${theme.accent}" opacity="0.18"/>
    <text x="135" y="1165" font-size="30" fill="${theme.text}" font-family="sans-serif" font-weight="700">
      @Akhil
    </text>
  </svg>
  `;
}

async function renderSlidePng(slide, index, theme, category, totalSlides) {
  const svg = generateSlide(slide, index, theme, category, totalSlides);
  
  const fontConfig = { loadSystemFonts: true };
  // Check if downloaded font is available
  if (fs.existsSync('./font.ttf')) {
    fontConfig.fontFiles = ['./font.ttf'];
    fontConfig.defaultFontFamily = 'Montserrat';
  }

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: fontConfig
  });

  return resvg.render().asPng();
}

// =========================================================
// CONTENT GENERATION VIA GROQ
// =========================================================
function getRandomNiche() {
  const niches = ["STOICISM", "WEALTH", "MOTIVATION", "PSYCHOLOGY"];
  return niches[Math.floor(Math.random() * niches.length)];
}

async function generateCarouselContent(niche) {
  const prompt = `
Generate a highly viral, swipe-worthy multi-slide Instagram-style carousel post in English.
The niche/theme is: "${niche}".

Rules:
- Strictly generate exactly 6 slides.
- Slide 1 MUST be a highly compelling, irresistible curiosity hook.
- Slides 2, 3, 4, 5, and 6 MUST each contain a highly meaningful, deep psychological lesson or secret. EACH of these slides (2 to 6) MUST have a minimum of 10 words. Do not give short half-baked sentences. Provide extreme value.
- For each slide, provide an array of 1 to 2 exact words/phrases from the text to be highlighted.
- Provide a relevant emoji for each slide.
- Generate a "theme_title" that is a catchy, user-centric heading (e.g., "MINDSET SHIFT", "WEALTH SECRET #01") instead of just the niche name.
- Text must be in perfect, highly engaging English.

Return strictly in the following JSON format:
{
  "theme_title": "Catchy Heading Here",
  "slides": [
    {
      "text": "Slide 1 Text in English",
      "highlight": ["word1", "word2"],
      "emoji": "🧠"
    }
  ],
  "caption": "An irresistible hook sentence that forces them to read the carousel.\\n\\n.\\n.\\n.\\n#hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5"
}

Respond ONLY with valid JSON.
`;

  if (!SECRETS.GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing!");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRETS.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.75
    })
  });

  if (!res.ok) {
    throw new Error(`Groq API Error: ${await res.text()}`);
  }

  const json = await res.json();
  const content = json.choices[0].message.content.trim();
  const cleanStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleanStr);
}

// =========================================================
// FACEBOOK API (MULTIPART FORM DATA)
// =========================================================
async function getPageAccessToken(pageId, token) {
  if (!token) return token;
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${pageId}?fields=access_token&access_token=${token}`);
    if (res.ok) {
      const json = await res.json();
      if (json.access_token) return json.access_token;
    }
  } catch (e) {}
  return token;
}

async function uploadCarouselToFacebook(pngBuffers, caption) {
  if (!SECRETS.PAGE_OR_IG_ID || !SECRETS.PAGE_ACCESS_TOKEN) {
    throw new Error("Missing Facebook Page ID or Token!");
  }

  const pageId = SECRETS.PAGE_OR_IG_ID;
  const pageAccessToken = await getPageAccessToken(pageId, SECRETS.PAGE_ACCESS_TOKEN);

  const mediaIds = [];
  
  // 1. Upload all slides as unpublished photos
  for (let i = 0; i < pngBuffers.length; i++) {
    const formData = new FormData();
    formData.append('access_token', pageAccessToken);
    formData.append('published', 'false');
    formData.append('source', new Blob([pngBuffers[i]], { type: 'image/png' }), `slide_${i}.png`);

    console.log(`Uploading slide ${i + 1}...`);
    const res = await fetch(`https://graph.facebook.com/v20.0/${pageId}/photos`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Failed to upload slide ${i}: ${await res.text()}`);
    }

    const data = await res.json();
    if (data.id) {
      mediaIds.push({ media_fbid: data.id });
    }
  }

  // 2. Publish multi-photo feed post
  console.log("Publishing carousel post...");
  const feedRes = await fetch(`https://graph.facebook.com/v20.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      message: caption,
      attached_media: JSON.stringify(mediaIds),
      access_token: pageAccessToken
    })
  });

  if (!feedRes.ok) {
    throw new Error(`Facebook Carousel Post failed: ${await feedRes.text()}`);
  }

  const feedData = await feedRes.json();
  console.log("✅ Successfully posted carousel! Post ID:", feedData.id);
}

// =========================================================
// MAIN RUNNER
// =========================================================
async function run() {
  try {
    console.log("Starting Carousel Generation...");
    const niche = getRandomNiche();
    console.log(`Selected Niche: ${niche}`);

    console.log("Generating content via Groq...");
    let content;
    try {
      content = await generateCarouselContent(niche);
    } catch (e) {
      console.error("Groq generation failed, using fallback:", e.message);
      content = {
        theme_title: "MINDSET SHIFT",
        slides: [
          { text: "Why do 90% of people never reach their true potential?", highlight: ["90%", "potential"], emoji: "🧠" },
          { text: "Because from childhood, their minds are programmed by fear and constant comparison with others.", highlight: ["fear", "comparison"], emoji: "⚠️" },
          { text: "Your brain believes whatever you repeatedly tell yourself every single day without fail.", highlight: ["brain", "repeatedly"], emoji: "🔥" },
          { text: "The ultimate secret is to isolate your focus entirely on what you can control.", highlight: ["focus", "control"], emoji: "🎯" },
          { text: "Write down your strengths for 5 minutes every single morning to rewire your brain.", highlight: ["5 minutes", "rewire"], emoji: "⚡" },
          { text: "Change your inner thoughts, and you will inevitably change your entire world.", highlight: ["thoughts", "world"], emoji: "🚀" }
        ],
        caption: "If you ignore this, you'll stay stuck in the exact same place for the next 5 years.\nSwipe to unlock the psychological secret. 👉\n\n.\n.\n.\n#mindset #growth #success #psychology #stoicism"
      };
    }

    console.log(`Generated ${content.slides.length} slides.`);

    // Pick a consistent random theme for the entire carousel
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    console.log(`Selected Theme: ${theme.name}`);

    const pngBuffers = [];
    for (let i = 0; i < content.slides.length; i++) {
      console.log(`Rendering SVG -> PNG for slide ${i + 1}...`);
      const pngBuffer = await renderSlidePng(content.slides[i], i, theme, content.theme_title, content.slides.length);
      pngBuffers.push(pngBuffer);
    }

    console.log("Uploading to Facebook...");
    await uploadCarouselToFacebook(pngBuffers, content.caption);

    console.log("All done!");
  } catch (error) {
    console.error("Fatal Error:", error);
    process.exit(1);
  }
}

run();
