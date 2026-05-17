import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import { execSync, exec as execCb } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";

const exec = promisify(execCb);

// =========================================================
// CONFIG
// =========================================================
const CONFIG = {
  HANDLE: "@Akhil",
  GROQ_MODEL: "openai/gpt-oss-120b",          // Change to your preferred model
  SLIDE_COUNT: 6,
  SLIDE_DURATION: 3,                     // seconds per slide
  FPS: 30,
  WIDTH: 1080,
  HEIGHT: 1920,                          // 9:16 Reels aspect ratio
  TEMP_DIR: os.tmpdir(),
};

// =========================================================
// AUDIO MAP — Meta Sound Collection + safe royalty-free
// Filenames must exist in ./audio/ folder in project root.
// Download from facebook.com/sound/collection and name them exactly as below.
// 5 tracks per niche — picked by mood match.
// =========================================================
const NICHE_AUDIO = {
  "STOICISM": [
    "stoic_resolve.mp3",
    "ancient_wisdom.mp3",
    "quiet_strength.mp3",
    "inner_fortress.mp3",
    "philosophical_dawn.mp3",
  ],
  "WEALTH MINDSET": [
    "golden_horizon.mp3",
    "empire_rising.mp3",
    "abundance_flow.mp3",
    "hustle_frequency.mp3",
    "wealth_wave.mp3",
  ],
  "MOTIVATION": [
    "rise_up.mp3",
    "champions_run.mp3",
    "unstoppable_drive.mp3",
    "momentum_build.mp3",
    "fire_within.mp3",
  ],
  "PSYCHOLOGY": [
    "mind_maze.mp3",
    "cognitive_shift.mp3",
    "neural_drift.mp3",
    "deep_thought.mp3",
    "perception_loop.mp3",
  ],
  "DISCIPLINE": [
    "iron_will.mp3",
    "grind_mode.mp3",
    "no_days_off.mp3",
    "steel_focus.mp3",
    "forge_ahead.mp3",
  ],
  "SUCCESS HABITS": [
    "morning_ritual.mp3",
    "compound_effect.mp3",
    "winning_routine.mp3",
    "habit_stack.mp3",
    "systems_over_goals.mp3",
  ],
  "EMOTIONAL INTELLIGENCE": [
    "empathy_wave.mp3",
    "emotional_depth.mp3",
    "inner_calm.mp3",
    "resonance_field.mp3",
    "social_gravity.mp3",
  ],
  "FOCUS & PRODUCTIVITY": [
    "deep_work_mode.mp3",
    "flow_state.mp3",
    "laser_focus.mp3",
    "zero_distraction.mp3",
    "peak_performance.mp3",
  ],
};

// Fallback: if niche audio not found, use these generic tracks
const FALLBACK_AUDIO = [
  "cinematic_inspire.mp3",
  "epic_mindset.mp3",
  "motivation_pulse.mp3",
];

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
// THEMES — 6 distinct high-end multicoloured
// =========================================================
const THEMES = [
  { name:"Neon Dark",      bg1:"#060d1f", bg2:"#0f1e3a", accent:"#38bdf8", accent2:"#818cf8", glow1:"#1e40af", glow2:"#4f46e5", text:"#f1f5f9", sub:"#94a3b8", pill:"rgba(56,189,248,0.18)", pillStroke:"rgba(56,189,248,0.55)" },
  { name:"Luxury Gold",    bg1:"#0a0800", bg2:"#1a1200", accent:"#f59e0b", accent2:"#fbbf24", glow1:"#78350f", glow2:"#92400e", text:"#fef9f0", sub:"#d97706", pill:"rgba(245,158,11,0.18)", pillStroke:"rgba(245,158,11,0.55)" },
  { name:"Cyber Pink",     bg1:"#0d0016", bg2:"#1a0030", accent:"#e879f9", accent2:"#a78bfa", glow1:"#6b21a8", glow2:"#7c3aed", text:"#fdf4ff", sub:"#c084fc", pill:"rgba(232,121,249,0.18)", pillStroke:"rgba(232,121,249,0.55)" },
  { name:"Emerald Luxury", bg1:"#010f08", bg2:"#001a0e", accent:"#34d399", accent2:"#fbbf24", glow1:"#064e3b", glow2:"#065f46", text:"#ecfdf5", sub:"#6ee7b7", pill:"rgba(52,211,153,0.18)", pillStroke:"rgba(52,211,153,0.55)" },
  { name:"Sunset Aura",    bg1:"#0f0500", bg2:"#1e0a00", accent:"#fb923c", accent2:"#f43f5e", glow1:"#7c2d12", glow2:"#881337", text:"#fff7ed", sub:"#fdba74", pill:"rgba(251,146,60,0.18)", pillStroke:"rgba(251,146,60,0.55)" },
  { name:"Royal Velvet",   bg1:"#05030f", bg2:"#0e0824", accent:"#818cf8", accent2:"#c084fc", glow1:"#1e1b4b", glow2:"#3b0764", text:"#f5f3ff", sub:"#a5b4fc", pill:"rgba(129,140,248,0.18)", pillStroke:"rgba(129,140,248,0.55)" },
];

// =========================================================
// FONT SETUP
// =========================================================
const HAS_FONT = fs.existsSync("./font.ttf");
const FONT_FAM = HAS_FONT ? "'CardFont','Arial Black',sans-serif" : "'Arial Black','Liberation Sans','DejaVu Sans',sans-serif";

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

const CHAR_W_COEF = 0.62;
const TEXT_BOX_PX = 860;
const MAX_LINES   = 4;

function computeLayout(text) {
  for (const fs of [88, 80, 72, 64, 56, 50]) {
    const maxChars = Math.floor(TEXT_BOX_PX / (fs * CHAR_W_COEF));
    const lines    = wordWrap(text, maxChars);
    if (lines.length <= MAX_LINES) return { fs, lines, lh: fs * 1.52 };
  }
  const fs = 50;
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

// Splits line into highlighted/normal segments
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
// SVG SLIDE BUILDER — 9:16 Reels format with pill highlights
// =========================================================
const W = 1080, H = 1920;
const CARD = { x: 54, y: 108, w: 972, h: 1704, rx: 40 };

const TZ_TOP    = CARD.y + 130;
const TZ_BOTTOM = CARD.y + CARD.h - 130;
const TZ_CY     = (TZ_TOP + TZ_BOTTOM) / 2;
const TZ_CX     = W / 2;

function textRectGeometry(lines, fs, lh) {
  const blockH  = lines.length * lh;
  const rectTop = TZ_CY - blockH / 2 - fs * 0.55 - 32;
  const rectH   = blockH + fs * 0.55 + 64;
  const rectX   = TZ_CX - TEXT_BOX_PX / 2 - 36;
  const rectW   = TEXT_BOX_PX + 72;
  return { rectTop, rectH, rectX, rectW, firstLineY: TZ_CY - blockH / 2 + fs * 0.72 };
}

// Build SVG text with PILL highlights (no underline — rounded badge behind word)
function buildTextWithPills(lines, fs, lh, firstLineY, theme) {
  const svgParts = [];
  let lineY = firstLineY;

  for (const line of lines) {
    const parts = splitHighlights(line, []); // raw split done below per line
    // We'll render the whole line, but for highlighted segments add a rect behind
    // Approach: render line as foreignObject-ish — but SVG has no per-word bg directly
    // Best SVG approach: render line segments with tspan, estimate pill rect per highlight word
    // We render: background pill rects FIRST, then text on top
    const lineStr = line;
    lineY += lh;
  }

  return svgParts;
}

// Pill highlight groups — rendered as SVG <g> before text layer
function buildPillGroups(lines, highlights, fs, lh, firstLineY, theme) {
  if (!highlights || highlights.length === 0) return "";
  const pillH    = fs * 1.18;
  const pillRx   = pillH / 2;
  const charW    = fs * CHAR_W_COEF;
  const groups   = [];
  let lineY = firstLineY;

  for (const line of lines) {
    const parts = splitHighlights(line, highlights);
    // Compute x position of each part by accumulated char count
    let lineText = "";
    const segs = [];
    for (const p of parts) {
      segs.push({ ...p, startIdx: lineText.length });
      lineText += p.t;
    }
    const totalW = lineText.length * charW;
    const startX = TZ_CX - totalW / 2;

    for (const seg of segs) {
      if (!seg.h) continue;
      const segX  = startX + seg.startIdx * charW;
      const segW  = seg.t.length * charW + 20; // padding
      const pillX = segX - 10;
      const pillY = lineY - fs * 0.88;
      groups.push(`
        <rect x="${pillX.toFixed(1)}" y="${pillY.toFixed(1)}"
          width="${segW.toFixed(1)}" height="${pillH.toFixed(1)}"
          rx="${pillRx.toFixed(1)}" ry="${pillRx.toFixed(1)}"
          fill="${theme.pill}" stroke="${theme.pillStroke}" stroke-width="1.8"/>
      `);
    }
    lineY += lh;
  }
  return groups.join("\n");
}

// Text lines SVG — no underline on highlights
function buildTextLines(lines, highlights, fs, lh, firstLineY, theme) {
  let lineY = firstLineY;
  return lines.map(line => {
    const parts   = splitHighlights(line, highlights);
    const tspans  = parts.map(p =>
      `<tspan fill="${p.h ? theme.accent : theme.text}" font-weight="900">${escapeXml(p.t)}</tspan>`
    ).join("");
    const y = lineY; lineY += lh;
    return `<text x="${TZ_CX}" y="${y.toFixed(1)}" font-size="${fs}" font-family="${FONT_FAM}" font-weight="900" text-anchor="middle" dominant-baseline="auto">${tspans}</text>`;
  }).join("\n");
}

function buildSlide(slide, idx, total, theme, catTitle) {
  const { fs, lines, lh }                             = computeLayout(slide.text);
  const { rectTop, rectH, rectX, rectW, firstLineY }  = textRectGeometry(lines, fs, lh);
  const fontCSS                                        = getFontFaceCSS();

  // Progress dots
  const DOT_Y   = CARD.y + CARD.h - 60;
  const DOT_GAP = 22, DOT_R = 5;
  const dotsW   = total * DOT_R * 2 + (total - 1) * (DOT_GAP - DOT_R * 2);
  const dotX0   = TZ_CX - dotsW / 2 + DOT_R;
  const dots    = Array.from({ length: total }, (_, i) => {
    const cx = dotX0 + i * DOT_GAP;
    return i === idx
      ? `<rect x="${(cx - DOT_R * 2.2).toFixed(1)}" y="${(DOT_Y - DOT_R).toFixed(1)}" width="${(DOT_R * 4.4).toFixed(1)}" height="${(DOT_R * 2).toFixed(1)}" rx="${DOT_R}" fill="${theme.accent}"/>`
      : `<circle cx="${cx}" cy="${DOT_Y}" r="${DOT_R}" fill="rgba(255,255,255,0.22)"/>`;
  }).join("");

  const BULLET = "&#x25CF;";

  // Pill groups behind text
  const pillGroups  = buildPillGroups(lines, slide.highlight, fs, lh, firstLineY, theme);
  const textLines   = buildTextLines(lines, slide.highlight, fs, lh, firstLineY, theme);

  // Swipe hint on last slide
  const swipeHint = idx === total - 1
    ? `<text x="${TZ_CX}" y="${CARD.y + CARD.h - 105}" font-size="26" fill="${theme.sub}" font-family="${FONT_FAM}" font-weight="700" text-anchor="middle" opacity="0.55">↩ Save this</text>`
    : `<text x="${TZ_CX}" y="${CARD.y + CARD.h - 105}" font-size="24" fill="${theme.sub}" font-family="${FONT_FAM}" font-weight="700" text-anchor="middle" opacity="0.45">swipe ›</text>`;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  ${fontCSS ? `<style>${fontCSS}</style>` : ""}

  <!-- Background gradients -->
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
  <!-- Accent bottom bloom -->
  <radialGradient id="g4" cx="50%" cy="95%" r="40%">
    <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.18"/>
    <stop offset="100%" stop-color="${theme.bg1}" stop-opacity="0"/>
  </radialGradient>

  <!-- Glow filters -->
  <filter id="bigblur" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="80"/>
  </filter>
  <filter id="softblur" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="16"/>
  </filter>
  <filter id="textglow" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="6" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="accentglow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="22" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>

  <!-- Noise texture for depth -->
  <filter id="noise">
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
    <feBlend in="SourceGraphic" mode="overlay"/>
  </filter>
</defs>

<!-- ── BASE BACKGROUND ── -->
<rect width="${W}" height="${H}" fill="${theme.bg1}"/>
<rect width="${W}" height="${H}" fill="url(#g1)" filter="url(#bigblur)"/>
<rect width="${W}" height="${H}" fill="url(#g2)" filter="url(#bigblur)"/>
<rect width="${W}" height="${H}" fill="url(#g3)" filter="url(#bigblur)"/>
<rect width="${W}" height="${H}" fill="url(#g4)" filter="url(#bigblur)"/>
<!-- subtle noise overlay -->
<rect width="${W}" height="${H}" fill="${theme.accent}" opacity="0.012" filter="url(#noise)"/>

<!-- ── DECORATIVE GEOMETRY ── -->
<!-- Top-right orb -->
<circle cx="1010" cy="120" r="150" fill="${theme.accent}" opacity="0.07"/>
<circle cx="1010" cy="120" r="80"  fill="${theme.accent}" opacity="0.10"/>
<!-- Top-right inner bright dot -->
<circle cx="1010" cy="120" r="18"  fill="${theme.accent}" opacity="0.35"/>
<!-- Bottom-left ring -->
<circle cx="86"   cy="${H - 180}" r="110" fill="none" stroke="${theme.accent2}" stroke-width="1.5" opacity="0.18"/>
<circle cx="86"   cy="${H - 180}" r="56"  fill="${theme.accent2}" opacity="0.05"/>
<!-- Mid-right decorative lines -->
<line x1="${W - 30}" y1="${H * 0.28}" x2="${W - 30}" y2="${H * 0.72}" stroke="${theme.accent}" stroke-width="1" opacity="0.10"/>
<line x1="${W - 46}" y1="${H * 0.30}" x2="${W - 46}" y2="${H * 0.70}" stroke="${theme.accent2}" stroke-width="1" opacity="0.07"/>
<!-- Subtle diagonal rule -->
<line x1="0" y1="${(H*0.76).toFixed(0)}" x2="${W}" y2="${(H*0.68).toFixed(0)}"
  stroke="${theme.accent}" stroke-width="1" opacity="0.04"/>
<!-- Slide number watermark -->
<text x="${W - 64}" y="72" font-size="120" fill="${theme.accent}" opacity="0.025"
  font-family="Georgia,serif" font-weight="900" text-anchor="middle">${idx + 1}</text>

<!-- ── CARD GLOW HALO ── -->
<rect x="${CARD.x - 3}" y="${CARD.y - 3}" width="${CARD.w + 6}" height="${CARD.h + 6}"
  rx="${CARD.rx + 3}" ry="${CARD.rx + 3}"
  fill="none" stroke="${theme.accent}" stroke-width="1.5" opacity="0.14"
  filter="url(#softblur)"/>

<!-- ── GLASS CARD ── -->
<rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}"
  rx="${CARD.rx}" ry="${CARD.rx}"
  fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.085)" stroke-width="1.5"/>
<!-- Card inner top shine -->
<rect x="${CARD.x + 2}" y="${CARD.y + 2}" width="${CARD.w - 4}" height="200"
  rx="${CARD.rx}" ry="${CARD.rx}"
  fill="rgba(255,255,255,0.025)"/>

<!-- ── HEADER PILL ── -->
<rect x="${CARD.x + 28}" y="${CARD.y + 36}" width="${CARD.w - 56}" height="62"
  rx="16" ry="16"
  fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
<!-- Bullet -->
<text x="${CARD.x + 60}" y="${CARD.y + 70}"
  font-size="22" fill="${theme.accent}" font-family="sans-serif" dominant-baseline="middle"
>${BULLET}</text>
<!-- Category title -->
<text x="${CARD.x + 88}" y="${CARD.y + 70}"
  font-size="25" fill="${theme.sub}" font-family="${FONT_FAM}" font-weight="900"
  letter-spacing="3.5" dominant-baseline="middle"
>${escapeXml(catTitle.toUpperCase())}</text>
<!-- Slide counter -->
<text x="${CARD.x + CARD.w - 52}" y="${CARD.y + 70}"
  font-size="23" fill="${theme.sub}" font-family="${FONT_FAM}" font-weight="700"
  text-anchor="end" dominant-baseline="middle" opacity="0.45"
>${idx + 1}/${total}</text>
<!-- Header rule -->
<line x1="${CARD.x + 28}" y1="${CARD.y + 104}" x2="${CARD.x + CARD.w - 28}" y2="${CARD.y + 104}"
  stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

<!-- ── QUOTE MARK DECORATION ── -->
<text x="${CARD.x + 36}" y="${CARD.y + 340}"
  font-size="220" fill="${theme.accent}" opacity="0.055"
  font-family="Georgia,serif" dominant-baseline="auto">&#x201C;</text>

<!-- ── TEXT ZONE BACKGROUND RECT ── -->
<rect x="${rectX.toFixed(1)}" y="${rectTop.toFixed(1)}"
  width="${rectW.toFixed(1)}" height="${rectH.toFixed(1)}"
  rx="20" ry="20"
  fill="${theme.accent}" opacity="0.05"/>
<!-- Left accent border strip -->
<rect x="${rectX.toFixed(1)}" y="${(rectTop + 16).toFixed(1)}"
  width="6" height="${(rectH - 32).toFixed(1)}"
  rx="3" ry="3"
  fill="${theme.accent}" opacity="0.80" filter="url(#accentglow)"/>

<!-- ── EMOJI BADGE ── -->
<rect x="${TZ_CX - 42}" y="${(firstLineY - fs * 2.6).toFixed(1)}"
  width="84" height="64" rx="32"
  fill="rgba(255,255,255,0.06)" stroke="${theme.pillStroke}" stroke-width="1.2"/>
<text x="${TZ_CX}" y="${(firstLineY - fs * 2.15).toFixed(1)}"
  font-size="40" text-anchor="middle" dominant-baseline="middle"
  font-family="'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif"
>${escapeXml(slide.emoji ?? "✨")}</text>

<!-- ── PILL HIGHLIGHTS (behind text) ── -->
${pillGroups}

<!-- ── MAIN TEXT ── -->
<g filter="url(#textglow)">
${textLines}
</g>

<!-- ── PROGRESS INDICATORS (pill-shaped active) ── -->
${dots}

<!-- ── SWIPE HINT ── -->
${swipeHint}

<!-- ── CTA BAR ── -->
<rect x="${CARD.x + 28}"   y="${CARD.y + CARD.h - 108}" width="290" height="56" rx="28" fill="${theme.accent}" opacity="0.14"/>
<rect x="${CARD.x + 30}"   y="${CARD.y + CARD.h - 106}" width="286" height="52" rx="26" fill="rgba(0,0,0,0.35)"/>
<!-- Handle text -->
<text x="${CARD.x + 28 + 145}" y="${CARD.y + CARD.h - 80}"
  font-size="27" fill="${theme.text}" font-family="${FONT_FAM}" font-weight="900"
  text-anchor="middle" dominant-baseline="middle"
>${escapeXml(CONFIG.HANDLE)}</text>

<!-- ── BOTTOM ACCENT LINE ── -->
<rect x="${CARD.x + 28}" y="${CARD.y + CARD.h - 26}" width="200" height="5" rx="2.5" fill="${theme.accent2}" opacity="0.55"/>
<rect x="${CARD.x + 28}" y="${CARD.y + CARD.h - 26}" width="80"  height="5" rx="2.5" fill="${theme.accent}"  opacity="0.85"/>
</svg>`;
}

// =========================================================
// PNG RENDERER
// =========================================================
async function renderPng(slide, idx, total, theme, catTitle) {
  const svg     = buildSlide(slide, idx, total, theme, catTitle);
  const fontOpts = { loadSystemFonts: true };
  if (HAS_FONT) { fontOpts.fontFiles = ["./font.ttf"]; fontOpts.defaultFontFamily = "CardFont"; }
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: fontOpts });
  return resvg.render().asPng();
}

// =========================================================
// AUDIO SELECTOR
// =========================================================
function selectAudio(niche) {
  const tracks  = NICHE_AUDIO[niche] ?? FALLBACK_AUDIO;
  const track   = tracks[Math.floor(Math.random() * tracks.length)];
  const fullPath = path.resolve(`./audio/${track}`);

  if (fs.existsSync(fullPath)) {
    console.log(`  🎵 Audio: ${track}`);
    return fullPath;
  }

  // Fallback: try any available audio file
  const audioDir = "./audio";
  if (fs.existsSync(audioDir)) {
    const available = fs.readdirSync(audioDir).filter(f => /\.(mp3|aac|wav|m4a)$/i.test(f));
    if (available.length > 0) {
      const fallback = available[Math.floor(Math.random() * available.length)];
      console.log(`  🎵 Audio (fallback): ${fallback}`);
      return path.resolve(`${audioDir}/${fallback}`);
    }
  }

  console.warn("  ⚠ No audio found — creating silent reel");
  return null;
}

// =========================================================
// VIDEO GENERATION — PNG clips → MP4 reel with audio
// =========================================================
async function checkFFmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    throw new Error("FFmpeg not found! Install: sudo apt-get install -y ffmpeg");
  }
}

// Convert single PNG → short video clip with Ken Burns zoom effect
async function pngToClip(pngBuf, idx, duration = CONFIG.SLIDE_DURATION) {
  const pngPath  = path.join(CONFIG.TEMP_DIR, `slide_${idx}.png`);
  const clipPath = path.join(CONFIG.TEMP_DIR, `clip_${idx}.mp4`);
  fs.writeFileSync(pngPath, pngBuf);

  const frames     = duration * CONFIG.FPS;
  // Ken Burns: alternate zoom-in / zoom-out per slide
  const zoomDir    = idx % 2 === 0
    ? `z='min(zoom+0.0012,1.25)'`                              // zoom in
    : `z='if(eq(on,1),1.25,max(zoom-0.0012,1.0))'`;           // zoom out

  // Pan direction alternates per slide quadrant
  const panX = idx % 4 < 2
    ? `x='iw/2-(iw/zoom/2)'`
    : `x='if(eq(on,1),iw*0.1,iw/2-(iw/zoom/2))'`;
  const panY = idx % 3 === 0
    ? `y='ih/2-(ih/zoom/2)'`
    : `y='if(eq(on,1),ih*0.05,ih/2-(ih/zoom/2))'`;

  const vf = [
    `scale=${CONFIG.WIDTH}:${CONFIG.HEIGHT}`,
    `zoompan=${zoomDir}:d=${frames}:${panX}:${panY}:s=${CONFIG.WIDTH}x${CONFIG.HEIGHT}`,
    `fps=${CONFIG.FPS}`,
    `format=yuv420p`,
  ].join(",");

  await exec(
    `ffmpeg -y -loop 1 -i "${pngPath}" -t ${duration} -vf "${vf}" ` +
    `-c:v libx264 -preset fast -crf 15 "${clipPath}"`
  );

  return clipPath;
}

// Add fade-in/fade-out transitions between clips using xfade filter
async function concatClipsWithTransitions(clipPaths, outputPath) {
  if (clipPaths.length === 1) {
    fs.copyFileSync(clipPaths[0], outputPath);
    return;
  }

  const duration   = CONFIG.SLIDE_DURATION;
  const fadeDur    = 0.35; // seconds overlap

  // Build xfade filter chain
  // Each clip is 3s, xfade with 0.35s overlap
  // v0[v1] -> xfade=offset=2.65 -> v01; v01[v2] -> xfade=offset=5.30 -> v012; etc.
  let filterParts  = [];
  let prevLabel    = "[0:v]";
  let offset       = duration - fadeDur;

  for (let i = 1; i < clipPaths.length; i++) {
    const outLabel = i === clipPaths.length - 1 ? "[vout]" : `[v${i}]`;
    filterParts.push(
      `${prevLabel}[${i}:v]xfade=transition=fade:duration=${fadeDur}:offset=${offset.toFixed(3)}${outLabel}`
    );
    prevLabel = `[v${i}]`;
    offset    += duration - fadeDur;
  }

  const filterStr  = filterParts.join(";");
  const inputs     = clipPaths.map(p => `-i "${p}"`).join(" ");

  await exec(
    `ffmpeg -y ${inputs} -filter_complex "${filterStr}" -map "[vout]" ` +
    `-c:v libx264 -preset fast -crf 15 "${outputPath}"`
  );
}

// Burn audio into the final video
async function burnAudio(videoPath, audioPath, finalPath, totalDuration) {
  if (!audioPath) {
    fs.copyFileSync(videoPath, finalPath);
    return;
  }

  // Trim/loop audio to match video duration, fade out last 1s
  await exec(
    `ffmpeg -y -i "${videoPath}" -stream_loop -1 -i "${audioPath}" ` +
    `-t ${totalDuration} ` +
    `-filter_complex "[1:a]atrim=duration=${totalDuration},afade=t=out:st=${totalDuration - 1}:d=1[aout]" ` +
    `-map 0:v -map "[aout]" ` +
    `-c:v copy -c:a aac -b:a 192k ` +
    `"${finalPath}"`
  );
}

// Add subtle text pop-in animation per slide (using FFmpeg drawtext)
// This overlays a slide counter animation
async function addSlideOverlay(videoPath, outputPath, slideCount) {
  // Simple: add tiny slide progress bar at bottom that grows
  // Encoded as a colored progress line per slide
  await exec(
    `ffmpeg -y -i "${videoPath}" ` +
    `-vf "drawbox=y=ih-8:x=0:w=iw*t/${slideCount * CONFIG.SLIDE_DURATION}:h=8:color=${encodeURIComponent("#38bdf8")}@0.7:t=fill" ` +
    `-c:v libx264 -preset fast -crf 15 -c:a copy "${outputPath}"`
  );
}

// Full pipeline: PNGs → reel MP4
async function buildReel(pngBuffers, niche, theme) {
  await checkFFmpeg();

  const totalDuration = pngBuffers.length * CONFIG.SLIDE_DURATION;
  console.log(`\n🎬 Building reel: ${pngBuffers.length} slides × ${CONFIG.SLIDE_DURATION}s = ${totalDuration}s`);

  // Step 1: Render each PNG to a video clip
  const clipPaths = [];
  for (let i = 0; i < pngBuffers.length; i++) {
    process.stdout.write(`  Clip ${i + 1}/${pngBuffers.length}… `);
    clipPaths.push(await pngToClip(pngBuffers[i], i));
    console.log("✓");
  }

  // Step 2: Concatenate with xfade transitions
  const concatPath = path.join(CONFIG.TEMP_DIR, "concat.mp4");
  console.log("  Concatenating with transitions…");
  await concatClipsWithTransitions(clipPaths, concatPath);

  // Step 3: Add progress bar overlay
  const overlayPath = path.join(CONFIG.TEMP_DIR, "overlay.mp4");
  console.log("  Adding progress overlay…");
  try {
    await addSlideOverlay(concatPath, overlayPath, pngBuffers.length);
  } catch {
    // non-critical, skip if drawbox fails
    fs.copyFileSync(concatPath, overlayPath);
  }

  // Step 4: Burn audio
  const audioPath  = selectAudio(niche);
  const finalPath  = path.join(CONFIG.TEMP_DIR, "reel_final.mp4");
  console.log("  Burning audio…");
  await burnAudio(overlayPath, audioPath, finalPath, totalDuration);

  // Step 5: Read final video
  const videoBuffer = fs.readFileSync(finalPath);
  console.log(`  ✅ Reel ready: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  // Cleanup temp files
  [...clipPaths, concatPath, overlayPath].forEach(p => { try { fs.unlinkSync(p); } catch {} });
  clipPaths.forEach(p => {
    const png = p.replace(/clip_(\d+)\.mp4/, "slide_$1.png");
    try { fs.unlinkSync(png); } catch {}
  });

  return videoBuffer;
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

  const prompt = `You are a viral Instagram Reels copywriter. Create a ${CONFIG.SLIDE_COUNT}-slide reel script for the niche: "${niche}".

STRICT RULES:
1. Exactly ${CONFIG.SLIDE_COUNT} slides.
2. Slide 1: Hook — 8-12 words. Start with "What if", "Why do", "How does", "Did you know", "Most people", etc.
3. Slides 2-${CONFIG.SLIDE_COUNT - 1}: Deep psychological truths or actionable insights — 10-14 words each. Punchy and powerful.
4. Slide ${CONFIG.SLIDE_COUNT}: CTA slide — 8-10 words. Use "Save this", "Follow for more", "Share if this hit", etc.
5. "highlight": 1-2 short phrases (2-4 words max each) from that slide's text. These will be shown as PILL BADGES.
6. "emoji": one perfect emoji per slide.
7. "theme_title": catchy 2-4 word heading e.g. "MINDSET SHIFT", "WEALTH CODE", "STOIC TRUTH".
8. "caption": hook under 12 words + 2 emojis, then \\n\\n, then .\\n.\\n.\\n, then 5 viral niche hashtags.
   Format: [hook] [emoji][emoji]\\n\\n.\\n.\\n.\\n#tag1 #tag2 #tag3 #tag4 #tag5

Return ONLY raw JSON. No markdown. No explanation.
{
  "theme_title": "...",
  "slides": [{"text":"...","highlight":["...","..."],"emoji":"..."}],
  "caption": "..."
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRETS.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: CONFIG.GROQ_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.85 }),
  });
  if (!res.ok) throw new Error(`Groq: ${await res.text()}`);

  const raw   = (await res.json()).choices[0].message.content.trim();
  const clean = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
  const data  = JSON.parse(clean);

  data.slides.forEach((s, i) => {
    if (i === 0) return;
    const wc = s.text.trim().split(/\s+/).length;
    if (wc < 8 || wc > 15) console.warn(`  ⚠ Slide ${i + 1} word count ${wc} (target 10-14)`);
  });
  return data;
}

// =========================================================
// FALLBACK CONTENT
// =========================================================
const FALLBACK = {
  theme_title: "MINDSET SHIFT",
  slides: [
    { text: "What if one decision today could reshape your entire future?",         highlight: ["one decision"],          emoji: "🧠" },
    { text: "Most people never start because they wait to feel completely ready.",   highlight: ["never start", "ready"],  emoji: "⚠️" },
    { text: "Your brain silently becomes whatever you choose to repeatedly think.",  highlight: ["repeatedly", "brain"],   emoji: "🔁" },
    { text: "True discipline means doing the hard work before you feel motivated.",  highlight: ["discipline", "hard work"],emoji: "🎯" },
    { text: "Write three small wins every single morning to rewire your mindset.",   highlight: ["three wins", "rewire"],  emoji: "⚡" },
    { text: "Save this and share with someone who needs the shift today.",           highlight: ["Save this", "the shift"],emoji: "🚀" },
  ],
  caption: "This mindset shift will change how you see everything 🧠👇\n\n.\n.\n.\n#mindset #psychology #success #stoicism #viral",
};

// =========================================================
// META REELS UPLOAD — 3-phase resumable upload
// =========================================================
async function getPageToken(pid, token) {
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${pid}?fields=access_token&access_token=${token}`);
    if (r.ok) { const j = await r.json(); if (j.access_token) return j.access_token; }
    console.warn(`Token exchange failed (${r.status}) — using provided token.`);
  } catch (e) { console.warn("Token exchange error:", e.message); }
  return token;
}

async function postReel(videoBuffer, caption) {
  if (!SECRETS.PAGE_OR_IG_ID || !SECRETS.PAGE_ACCESS_TOKEN) throw new Error("Missing credentials!");

  const pid   = SECRETS.PAGE_OR_IG_ID;
  const token = await getPageToken(pid, SECRETS.PAGE_ACCESS_TOKEN);
  const size  = videoBuffer.length;

  console.log("\n📤 Uploading reel to Meta…");

  // ── Phase 1: Init upload session ──
  const initRes = await fetch(`https://graph.facebook.com/v20.0/${pid}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase: "start",
      access_token: token,
    }),
  });
  if (!initRes.ok) throw new Error(`Reel init failed: ${await initRes.text()}`);
  const { video_id, upload_url } = await initRes.json();
  if (!video_id || !upload_url) throw new Error("No video_id/upload_url in init response");
  console.log(`  Video ID: ${video_id}`);

  // ── Phase 2: Transfer video bytes ──
  console.log(`  Transferring ${(size / 1024 / 1024).toFixed(2)} MB…`);
  const transferRes = await fetch(upload_url, {
    method: "POST",
    headers: {
      "Authorization": `OAuth ${token}`,
      "Content-Type": "video/mp4",
      "offset": "0",
      "file_size": String(size),
    },
    body: videoBuffer,
  });
  if (!transferRes.ok) throw new Error(`Reel transfer failed: ${await transferRes.text()}`);
  console.log("  Transfer complete ✓");

  // ── Phase 3: Publish ──
  const publishRes = await fetch(`https://graph.facebook.com/v20.0/${pid}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase:  "finish",
      video_id:      video_id,
      access_token:  token,
      video_state:   "PUBLISHED",
      description:   caption,
      title:         caption.split("\n")[0].slice(0, 100),
    }),
  });
  if (!publishRes.ok) throw new Error(`Reel publish failed: ${await publishRes.text()}`);
  const result = await publishRes.json();
  console.log("✅ Reel published! ID:", result.post_id ?? result.id ?? JSON.stringify(result));
  return result;
}

// =========================================================
// MAIN
// =========================================================
async function run() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🎬 FB Reels Bot  (SpotNet / @Akhil)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const niche = NICHES[Math.floor(Math.random() * NICHES.length)];
  console.log("🎯 Niche:", niche);

  // ── Content generation ──
  let content = FALLBACK;
  try {
    console.log("💬 Generating content via Groq…");
    content = await generateContent(niche);
    console.log(`   Theme: "${content.theme_title}"  Slides: ${content.slides.length}`);
  } catch (e) {
    console.error("Groq failed — using fallback:", e.message);
  }

  // ── Visual theme ──
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  console.log("🎨 Visual theme:", theme.name);

  // ── Render PNGs ──
  const pngs = [];
  console.log("\n🖼  Rendering slides…");
  for (let i = 0; i < content.slides.length; i++) {
    process.stdout.write(`  Slide ${i + 1}/${content.slides.length}… `);
    pngs.push(await renderPng(content.slides[i], i, content.slides.length, theme, content.theme_title));
    console.log("✓");
  }

  // ── Build reel video ──
  const videoBuffer = await buildReel(pngs, niche, theme);

  // ── Post to Meta ──
  console.log("\n📱 Caption:", content.caption.split("\n")[0]);
  await postReel(videoBuffer, content.caption);

  // Cleanup final video
  try { fs.unlinkSync(path.join(CONFIG.TEMP_DIR, "reel_final.mp4")); } catch {}

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  All done! ✅");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

run().catch(e => { console.error("\n💥 Fatal:", e.message); process.exit(1); });
