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
  GROQ_MODEL: "openai/gpt-oss-120b",
  SLIDE_COUNT: 6,
  SLIDE_DURATION: 3,           // seconds per slide
  FPS: 30,
  SVG_W: 1080,
  SVG_H: 1920,
  TEMP_DIR: os.tmpdir(),
};

// =========================================================
// AUDIO MAP
// =========================================================
const NICHE_AUDIO = {
  "STOICISM":               ["stoic_resolve.mp3","ancient_wisdom.mp3","quiet_strength.mp3","inner_fortress.mp3","philosophical_dawn.mp3"],
  "WEALTH MINDSET":         ["golden_horizon.mp3","empire_rising.mp3","abundance_flow.mp3","hustle_frequency.mp3","wealth_wave.mp3"],
  "MOTIVATION":             ["rise_up.mp3","champions_run.mp3","unstoppable_drive.mp3","momentum_build.mp3","fire_within.mp3"],
  "PSYCHOLOGY":             ["mind_maze.mp3","cognitive_shift.mp3","neural_drift.mp3","deep_thought.mp3","perception_loop.mp3"],
  "DISCIPLINE":             ["iron_will.mp3","grind_mode.mp3","no_days_off.mp3","steel_focus.mp3","forge_ahead.mp3"],
  "SUCCESS HABITS":         ["morning_ritual.mp3","compound_effect.mp3","winning_routine.mp3","habit_stack.mp3","systems_over_goals.mp3"],
  "EMOTIONAL INTELLIGENCE": ["empathy_wave.mp3","emotional_depth.mp3","inner_calm.mp3","resonance_field.mp3","social_gravity.mp3"],
  "FOCUS & PRODUCTIVITY":   ["deep_work_mode.mp3","flow_state.mp3","laser_focus.mp3","zero_distraction.mp3","peak_performance.mp3"],
};
const FALLBACK_AUDIO = ["cinematic_inspire.mp3","epic_mindset.mp3","motivation_pulse.mp3"];

// =========================================================
// SECRETS
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
// THEMES
// =========================================================
const THEMES = [
  { name:"Neon Dark",
    bg1:"#040c1a", bg2:"#0d1b36", accent:"#38bdf8", accent2:"#818cf8",
    glow1:"#1e40af", glow2:"#4f46e5", glow3:"#0ea5e9",
    text:"#f1f5f9", sub:"#94a3b8",
    pill:"rgba(56,189,248,0.22)", pillStroke:"rgba(56,189,248,0.75)", pillText:"#38bdf8" },
  { name:"Luxury Gold",
    bg1:"#080600", bg2:"#140e00", accent:"#f59e0b", accent2:"#fbbf24",
    glow1:"#78350f", glow2:"#92400e", glow3:"#d97706",
    text:"#fef9f0", sub:"#fcd34d",
    pill:"rgba(245,158,11,0.22)", pillStroke:"rgba(245,158,11,0.75)", pillText:"#f59e0b" },
  { name:"Cyber Pink",
    bg1:"#0a0014", bg2:"#160028", accent:"#e879f9", accent2:"#a78bfa",
    glow1:"#6b21a8", glow2:"#7c3aed", glow3:"#c026d3",
    text:"#fdf4ff", sub:"#e9d5ff",
    pill:"rgba(232,121,249,0.22)", pillStroke:"rgba(232,121,249,0.75)", pillText:"#e879f9" },
  { name:"Emerald Luxury",
    bg1:"#010c06", bg2:"#001508", accent:"#34d399", accent2:"#fbbf24",
    glow1:"#064e3b", glow2:"#065f46", glow3:"#059669",
    text:"#ecfdf5", sub:"#a7f3d0",
    pill:"rgba(52,211,153,0.22)", pillStroke:"rgba(52,211,153,0.75)", pillText:"#34d399" },
  { name:"Sunset Aura",
    bg1:"#0d0400", bg2:"#1a0800", accent:"#fb923c", accent2:"#f43f5e",
    glow1:"#7c2d12", glow2:"#881337", glow3:"#ea580c",
    text:"#fff7ed", sub:"#fed7aa",
    pill:"rgba(251,146,60,0.22)", pillStroke:"rgba(251,146,60,0.75)", pillText:"#fb923c" },
  { name:"Royal Velvet",
    bg1:"#04020e", bg2:"#0b0620", accent:"#a78bfa", accent2:"#c084fc",
    glow1:"#1e1b4b", glow2:"#3b0764", glow3:"#6d28d9",
    text:"#f5f3ff", sub:"#ddd6fe",
    pill:"rgba(167,139,250,0.22)", pillStroke:"rgba(167,139,250,0.75)", pillText:"#a78bfa" },
];

// =========================================================
// FONT
// =========================================================
const HAS_FONT = fs.existsSync("./font.ttf");
const FONT_FAM = HAS_FONT
  ? "'CardFont','Arial Black',sans-serif"
  : "'Arial Black','Liberation Sans','DejaVu Sans',sans-serif";

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

const W        = CONFIG.SVG_W;   // 1080
const H        = CONFIG.SVG_H;   // 1920

// Card geometry
const CARD_X   = 54;
const CARD_Y   = 108;
const CARD_W   = W - CARD_X * 2;    // 972
const CARD_H   = H - CARD_Y * 2;    // 1704
const CARD_RX  = 44;

// Safe horizontal padding — text NEVER exits this box
const SAFE_PAD   = 96;
const TEXT_BOX_W = CARD_W - SAFE_PAD * 2;   // 780px
const TEXT_CX    = W / 2;                    // 540

// Font width coefficient (Montserrat Black / Arial Black bold)
const CW = 0.595;

// Font size ladder
const FS_LADDER = [90, 82, 74, 66, 58, 52, 46];

function computeLayout(text) {
  for (const fontSize of FS_LADDER) {
    const maxChars = Math.floor(TEXT_BOX_W / (fontSize * CW));
    const lines    = wordWrap(text, maxChars);
    if (lines.length <= 4) return { fontSize, lines, lineH: Math.round(fontSize * 1.52) };
  }
  const fontSize = 46;
  return { fontSize, lines: wordWrap(text, Math.floor(TEXT_BOX_W / (fontSize * CW))), lineH: Math.round(fontSize * 1.52) };
}

function wordWrap(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Split line into highlight / normal segments
function splitHighlights(line, highlights) {
  const hls = [...(highlights ?? [])].filter(Boolean).sort((a, b) => b.length - a.length);
  let parts  = [{ t: line, h: false }];
  for (const hl of hls) {
    const re = new RegExp(`(${hl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    parts = parts.flatMap(p => {
      if (p.h) return [p];
      return p.t.split(re).filter(s => s.length > 0)
        .map(s => s.toLowerCase() === hl.toLowerCase() ? { t: s, h: true } : { t: s, h: false });
    });
  }
  return parts;
}

// =========================================================
// PILL HIGHLIGHT — CORRECT CENTRED POSITIONING
//
// text-anchor="middle" at x=TEXT_CX means:
//   line's visual left edge = TEXT_CX - (line.length * charW) / 2
//   segment's left edge     = lineLeft + charsBefore * charW
//   pill x                  = segLeft - PILL_PAD_X
//   pill width              = segW + PILL_PAD_X * 2
// This is always exactly centred around its text regardless of position.
// =========================================================
function buildPillGroups(lines, highlights, fontSize, lineH, firstLineY, theme) {
  if (!highlights || highlights.length === 0) return "";

  const charW      = fontSize * CW;
  const PILL_PX    = Math.round(fontSize * 0.30);   // horizontal padding
  const PILL_PY    = Math.round(fontSize * 0.12);   // vertical padding
  const pillH      = fontSize + PILL_PY * 2;
  const pillRx     = pillH / 2;
  const rects      = [];
  let   lineY      = firstLineY;

  for (const line of lines) {
    const parts      = splitHighlights(line, highlights);
    const lineCharW  = line.length * charW;
    const lineLeft   = TEXT_CX - lineCharW / 2;  // true pixel left of this line

    let charOffset = 0;
    for (const seg of parts) {
      if (seg.h) {
        const segLeft  = lineLeft + charOffset * charW;
        const segW     = seg.t.length * charW;
        const pillX    = segLeft - PILL_PX;
        const pillW    = segW + PILL_PX * 2;
        const pillY    = lineY - fontSize * 0.80 - PILL_PY;
        rects.push(
          `<rect x="${pillX.toFixed(1)}" y="${pillY.toFixed(1)}"` +
          ` width="${Math.max(pillW, 40).toFixed(1)}" height="${pillH.toFixed(1)}"` +
          ` rx="${pillRx.toFixed(1)}" ry="${pillRx.toFixed(1)}"` +
          ` fill="${theme.pill}" stroke="${theme.pillStroke}" stroke-width="2.2"/>`
        );
      }
      charOffset += seg.t.length;
    }
    lineY += lineH;
  }
  return rects.join("\n");
}

// Text lines SVG — no underline, accent colour on highlighted tspans
function buildTextLines(lines, highlights, fontSize, lineH, firstLineY, theme) {
  let lineY = firstLineY;
  return lines.map(line => {
    const parts  = splitHighlights(line, highlights);
    const tspans = parts.map(p =>
      `<tspan fill="${p.h ? theme.pillText : theme.text}" font-weight="900">${escapeXml(p.t)}</tspan>`
    ).join("");
    const y = lineY;
    lineY  += lineH;
    return (
      `<text x="${TEXT_CX}" y="${y.toFixed(1)}"` +
      ` font-size="${fontSize}" font-family="${FONT_FAM}"` +
      ` font-weight="900" text-anchor="middle" dominant-baseline="auto">${tspans}</text>`
    );
  }).join("\n");
}

// =========================================================
// SVG SLIDE BUILDER
// =========================================================
function buildSlide(slide, idx, total, theme, catTitle) {
  const { fontSize, lines, lineH } = computeLayout(slide.text);
  const fontCSS = getFontFaceCSS();

  // ── Fixed layout anchors ──
  const HEADER_H  = 74;
  const HEADER_Y  = CARD_Y + 44;
  const HEADER_CY = HEADER_Y + HEADER_H / 2;

  // Footer zone: starts at 70% of card height = 30% margin from bottom
  const FOOTER_Y  = CARD_Y + Math.round(CARD_H * 0.70);

  // Text zone: between header bottom and footer top
  const TZ_TOP    = HEADER_Y + HEADER_H + 48;
  const TZ_BOTTOM = FOOTER_Y - 24;
  const TZ_CY     = Math.round((TZ_TOP + TZ_BOTTOM) / 2);

  // Emoji badge
  const EMOJI_SZ    = 54;
  const EMOJI_PW    = 80;
  const EMOJI_PH    = 68;

  // Text block centring (emoji + text stacked)
  const blockH      = lines.length * lineH;
  const totalBlock  = EMOJI_PH + 20 + blockH;  // emoji pill + gap + text block
  const blockTop    = TZ_CY - totalBlock / 2;

  const emojiPillY  = blockTop;
  const firstLineY  = blockTop + EMOJI_PH + 20 + Math.round(fontSize * 0.78);

  // Clamp: text must never go below footer
  const maxFirstLineY = TZ_BOTTOM - blockH + Math.round(fontSize * 0.30);
  const safeFirstY    = Math.min(firstLineY, maxFirstLineY);

  // Text rect
  const TR_PAD = 36;
  const trTop  = safeFirstY - Math.round(fontSize * 0.85) - TR_PAD;
  const trH    = blockH + TR_PAD * 2;
  const trX    = TEXT_CX - TEXT_BOX_W / 2 - TR_PAD;
  const trW    = TEXT_BOX_W + TR_PAD * 2;

  // Pill groups + text
  const pillGroups = buildPillGroups(lines, slide.highlight, fontSize, lineH, safeFirstY, theme);
  const textLines  = buildTextLines(lines, slide.highlight, fontSize, lineH, safeFirstY, theme);

  // Progress dots — vertically centred in footer zone
  const DOT_ZONE_CY = Math.round(FOOTER_Y + (CARD_Y + CARD_H - FOOTER_Y) * 0.40);
  const DOT_R       = 6;
  const DOT_GAP     = 26;
  const dotsW       = total * DOT_R * 2 + (total - 1) * (DOT_GAP - DOT_R * 2);
  const dotX0       = TEXT_CX - dotsW / 2 + DOT_R;
  const dots        = Array.from({ length: total }, (_, i) => {
    const cx = dotX0 + i * DOT_GAP;
    return i === idx
      ? `<rect x="${(cx - DOT_R * 3).toFixed(1)}" y="${(DOT_ZONE_CY - DOT_R).toFixed(1)}"` +
        ` width="${(DOT_R * 6).toFixed(1)}" height="${(DOT_R * 2).toFixed(1)}"` +
        ` rx="${DOT_R}" fill="${theme.accent}"/>`
      : `<circle cx="${cx.toFixed(1)}" cy="${DOT_ZONE_CY}" r="${DOT_R * 0.7}" fill="rgba(255,255,255,0.28)"/>`;
  }).join("");

  // Swipe / save hint above dots
  const hintY   = DOT_ZONE_CY - DOT_R - 20;
  const hintTxt = idx === total - 1 ? "↩ Save this" : "swipe ›";

  // CTA handle — bottom of footer, centred
  const CTA_CY  = CARD_Y + CARD_H - 100;
  const CTA_W   = 300;
  const CTA_H   = 64;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  ${fontCSS ? `<style>${fontCSS}</style>` : ""}

  <radialGradient id="g1" cx="14%" cy="10%" r="56%">
    <stop offset="0%" stop-color="${theme.glow1}" stop-opacity="1"/>
    <stop offset="100%" stop-color="${theme.bg1}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="g2" cx="86%" cy="90%" r="56%">
    <stop offset="0%" stop-color="${theme.glow2}" stop-opacity="0.95"/>
    <stop offset="100%" stop-color="${theme.bg2}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="g3" cx="86%" cy="10%" r="42%">
    <stop offset="0%" stop-color="${theme.glow3}" stop-opacity="0.38"/>
    <stop offset="100%" stop-color="${theme.bg1}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="g4" cx="50%" cy="93%" r="46%">
    <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="${theme.bg1}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="centreGlow" cx="50%" cy="50%" r="38%">
    <stop offset="0%" stop-color="${theme.glow1}" stop-opacity="0.20"/>
    <stop offset="100%" stop-color="${theme.bg1}" stop-opacity="0"/>
  </radialGradient>

  <filter id="bigblur"  x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="95"/></filter>
  <filter id="medblur"  x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="30"/></filter>
  <filter id="softblur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="tinyblur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>

  <filter id="textglow" x="-12%" y="-12%" width="124%" height="124%">
    <feGaussianBlur stdDeviation="5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="accentglow" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="18" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="pillglow" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="9" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>

  <linearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="${theme.accent}"  stop-opacity="0.20"/>
    <stop offset="100%" stop-color="${theme.accent2}" stop-opacity="0.07"/>
  </linearGradient>
  <linearGradient id="cardShine" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="rgba(255,255,255,0.08)"/>
    <stop offset="35%"  stop-color="rgba(255,255,255,0.02)"/>
    <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
  </linearGradient>
  <linearGradient id="diagSweep" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%"   stop-color="${theme.accent}"  stop-opacity="0.07"/>
    <stop offset="60%"  stop-color="${theme.accent2}" stop-opacity="0.03"/>
    <stop offset="100%" stop-color="${theme.bg1}"     stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="footerSep" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="${theme.accent}"  stop-opacity="0"/>
    <stop offset="50%"  stop-color="${theme.accent}"  stop-opacity="0.22"/>
    <stop offset="100%" stop-color="${theme.accent}"  stop-opacity="0"/>
  </linearGradient>
</defs>

<!-- BASE -->
<rect width="${W}" height="${H}" fill="${theme.bg1}"/>
<rect width="${W}" height="${H}" fill="url(#g1)"        filter="url(#bigblur)"/>
<rect width="${W}" height="${H}" fill="url(#g2)"        filter="url(#bigblur)"/>
<rect width="${W}" height="${H}" fill="url(#g3)"        filter="url(#bigblur)"/>
<rect width="${W}" height="${H}" fill="url(#g4)"        filter="url(#bigblur)"/>
<rect width="${W}" height="${H}" fill="url(#diagSweep)"/>

<!-- DECORATIVE GEOMETRY -->
<!-- Top-right orb -->
<circle cx="${W - 55}" cy="170" r="230" fill="${theme.accent}"  opacity="0.05"  filter="url(#medblur)"/>
<circle cx="${W - 55}" cy="170" r="120" fill="${theme.accent}"  opacity="0.08"  filter="url(#tinyblur)"/>
<circle cx="${W - 55}" cy="170" r="40"  fill="${theme.accent}"  opacity="0.28"/>
<circle cx="${W - 55}" cy="170" r="15"  fill="#ffffff"          opacity="0.60"/>
<!-- Top-right ring -->
<circle cx="${W - 55}" cy="170" r="180" fill="none" stroke="${theme.accent}" stroke-width="1" opacity="0.12"/>

<!-- Bottom-left orb cluster -->
<circle cx="65" cy="${H - 220}" r="200" fill="${theme.glow2}"   opacity="0.06"  filter="url(#medblur)"/>
<circle cx="65" cy="${H - 220}" r="90"  fill="${theme.accent2}" opacity="0.09"  filter="url(#tinyblur)"/>
<circle cx="65" cy="${H - 220}" r="140" fill="none" stroke="${theme.accent2}" stroke-width="1" opacity="0.14"/>
<circle cx="65" cy="${H - 220}" r="70"  fill="none" stroke="${theme.accent}"  stroke-width="1" opacity="0.09"/>

<!-- Right side vertical rule lines -->
<line x1="${W - 30}" y1="${H * 0.24}" x2="${W - 30}" y2="${H * 0.76}" stroke="${theme.accent}"  stroke-width="1" opacity="0.11"/>
<line x1="${W - 48}" y1="${H * 0.27}" x2="${W - 48}" y2="${H * 0.73}" stroke="${theme.accent2}" stroke-width="1" opacity="0.07"/>

<!-- Faint diagonal rules -->
<line x1="0" y1="${(H * 0.76).toFixed(0)}" x2="${W}" y2="${(H * 0.68).toFixed(0)}" stroke="${theme.accent}" stroke-width="1" opacity="0.04"/>
<line x1="0" y1="${(H * 0.79).toFixed(0)}" x2="${W}" y2="${(H * 0.71).toFixed(0)}" stroke="${theme.accent}" stroke-width="1" opacity="0.025"/>

<!-- Faded large slide number watermark in centre -->
<text x="${TEXT_CX}" y="${H * 0.55}"
  font-size="700" fill="${theme.accent}" opacity="0.016"
  font-family="Georgia,serif" font-weight="900"
  text-anchor="middle" dominant-baseline="middle">${idx + 1}</text>

<!-- CARD GLOW HALOS -->
<rect x="${CARD_X - 5}" y="${CARD_Y - 5}" width="${CARD_W + 10}" height="${CARD_H + 10}"
  rx="${CARD_RX + 5}" ry="${CARD_RX + 5}"
  fill="none" stroke="${theme.accent}" stroke-width="2.5" opacity="0.16"
  filter="url(#softblur)"/>
<rect x="${CARD_X - 1}" y="${CARD_Y - 1}" width="${CARD_W + 2}" height="${CARD_H + 2}"
  rx="${CARD_RX + 1}" ry="${CARD_RX + 1}"
  fill="none" stroke="${theme.accent2}" stroke-width="1" opacity="0.12"/>

<!-- GLASS CARD -->
<rect x="${CARD_X}" y="${CARD_Y}" width="${CARD_W}" height="${CARD_H}"
  rx="${CARD_RX}" ry="${CARD_RX}"
  fill="rgba(255,255,255,0.036)" stroke="rgba(255,255,255,0.09)" stroke-width="1.5"/>
<!-- Top shine strip -->
<rect x="${CARD_X + 2}" y="${CARD_Y + 2}" width="${CARD_W - 4}" height="320"
  rx="${CARD_RX}" ry="${CARD_RX}" fill="url(#cardShine)"/>

<!-- Centre glow behind text area -->
<rect x="${(trX - 80).toFixed(0)}" y="${(trTop - 100).toFixed(0)}"
  width="${(trW + 160).toFixed(0)}" height="${(trH + 200).toFixed(0)}"
  rx="60" fill="url(#centreGlow)" filter="url(#medblur)"/>

<!-- HEADER — centred title, NO counter -->
<rect x="${CARD_X + 40}" y="${HEADER_Y}" width="${CARD_W - 80}" height="${HEADER_H}"
  rx="22" ry="22"
  fill="url(#headerGrad)" stroke="${theme.accent}" stroke-width="1" stroke-opacity="0.30"/>
<!-- Bullet dot left of title -->
<circle cx="${TEXT_CX - (catTitle.length * 7.5 + 18)}" cy="${HEADER_CY}" r="5.5" fill="${theme.accent}" opacity="0.95"/>
<!-- Category title — centred -->
<text x="${TEXT_CX}" y="${HEADER_CY}"
  font-size="27" fill="${theme.sub}" font-family="${FONT_FAM}" font-weight="900"
  letter-spacing="4.5" text-anchor="middle" dominant-baseline="middle"
>${escapeXml(catTitle.toUpperCase())}</text>
<!-- Header bottom divider -->
<line x1="${CARD_X + 54}" y1="${HEADER_Y + HEADER_H + 6}"
      x2="${CARD_X + CARD_W - 54}" y2="${HEADER_Y + HEADER_H + 6}"
  stroke="rgba(255,255,255,0.07)" stroke-width="1"/>

<!-- BIG QUOTE DECORATION -->
<text x="${CARD_X + 44}" y="${CARD_Y + 460}"
  font-size="280" fill="${theme.accent}" opacity="0.048"
  font-family="Georgia,serif" dominant-baseline="auto">&#x201C;</text>

<!-- EMOJI BADGE — centred above text -->
<rect x="${TEXT_CX - EMOJI_PW / 2}" y="${emojiPillY.toFixed(1)}"
  width="${EMOJI_PW}" height="${EMOJI_PH}"
  rx="${EMOJI_PH / 2}"
  fill="rgba(255,255,255,0.08)" stroke="${theme.pillStroke}" stroke-width="1.8"/>
<text x="${TEXT_CX}" y="${(emojiPillY + EMOJI_PH / 2).toFixed(1)}"
  font-size="${EMOJI_SZ}" text-anchor="middle" dominant-baseline="middle"
  font-family="'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif"
>${escapeXml(slide.emoji ?? "✨")}</text>

<!-- TEXT RECT BACKGROUND -->
<rect x="${trX.toFixed(1)}" y="${trTop.toFixed(1)}"
  width="${trW.toFixed(1)}" height="${trH.toFixed(1)}"
  rx="26" ry="26" fill="${theme.accent}" opacity="0.048"/>
<!-- Left glow accent strip -->
<rect x="${trX.toFixed(1)}" y="${(trTop + 22).toFixed(1)}"
  width="7" height="${(trH - 44).toFixed(1)}"
  rx="4" fill="${theme.accent}" opacity="0.90" filter="url(#accentglow)"/>

<!-- PILL HIGHLIGHTS (behind text) -->
<g filter="url(#pillglow)">
${pillGroups}
</g>

<!-- MAIN TEXT -->
<g filter="url(#textglow)">
${textLines}
</g>

<!-- FOOTER SEPARATOR -->
<line x1="${CARD_X + 54}" y1="${FOOTER_Y}"
      x2="${CARD_X + CARD_W - 54}" y2="${FOOTER_Y}"
  stroke="url(#footerSep)" stroke-width="1"/>

<!-- SWIPE HINT — centred -->
<text x="${TEXT_CX}" y="${hintY.toFixed(1)}"
  font-size="28" fill="${theme.sub}" font-family="${FONT_FAM}" font-weight="700"
  text-anchor="middle" opacity="0.42">${hintTxt}</text>

<!-- PROGRESS DOTS — centred -->
${dots}

<!-- CTA HANDLE — centred, bottom of footer zone -->
<rect x="${(TEXT_CX - CTA_W / 2).toFixed(1)}" y="${(CTA_CY - CTA_H / 2).toFixed(1)}"
  width="${CTA_W}" height="${CTA_H}" rx="${CTA_H / 2}"
  fill="${theme.accent}" opacity="0.15"/>
<rect x="${(TEXT_CX - CTA_W / 2 + 2).toFixed(1)}" y="${(CTA_CY - CTA_H / 2 + 2).toFixed(1)}"
  width="${CTA_W - 4}" height="${CTA_H - 4}" rx="${(CTA_H - 4) / 2}"
  fill="rgba(0,0,0,0.42)"/>
<text x="${TEXT_CX}" y="${CTA_CY}"
  font-size="29" fill="${theme.text}" font-family="${FONT_FAM}" font-weight="900"
  text-anchor="middle" dominant-baseline="middle"
>${escapeXml(CONFIG.HANDLE)}</text>

<!-- BOTTOM ACCENT LINES — centred -->
<rect x="${(TEXT_CX - 110).toFixed(1)}" y="${(CARD_Y + CARD_H - 40).toFixed(1)}"
  width="220" height="5" rx="2.5" fill="${theme.accent2}" opacity="0.42"/>
<rect x="${(TEXT_CX - 55).toFixed(1)}"  y="${(CARD_Y + CARD_H - 40).toFixed(1)}"
  width="110" height="5" rx="2.5" fill="${theme.accent}" opacity="0.85"/>

</svg>`;
}

// =========================================================
// PNG RENDERER — true 1080p output
// =========================================================
async function renderPng(slide, idx, total, theme, catTitle) {
  const svg      = buildSlide(slide, idx, total, theme, catTitle);
  const fontOpts = { loadSystemFonts: true };
  if (HAS_FONT) { fontOpts.fontFiles = ["./font.ttf"]; fontOpts.defaultFontFamily = "CardFont"; }
  // fitTo width 1080 → resvg renders at exact 1080×1920, full pixel-perfect quality
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: fontOpts });
  return resvg.render().asPng();
}

// =========================================================
// AUDIO SELECTOR
// =========================================================
function selectAudio(niche) {
  const tracks = NICHE_AUDIO[niche] ?? FALLBACK_AUDIO;
  const track  = tracks[Math.floor(Math.random() * tracks.length)];
  const full   = path.resolve(`./audio/${track}`);
  if (fs.existsSync(full)) { console.log(`  🎵 Audio: ${track}`); return full; }
  const dir = "./audio";
  if (fs.existsSync(dir)) {
    const av = fs.readdirSync(dir).filter(f => /\.(mp3|aac|wav|m4a)$/i.test(f));
    if (av.length > 0) {
      const fb = av[Math.floor(Math.random() * av.length)];
      console.log(`  🎵 Audio fallback: ${fb}`); return path.resolve(`${dir}/${fb}`);
    }
  }
  console.warn("  ⚠ No audio — silent reel"); return null;
}

// =========================================================
// VIDEO PIPELINE — fixed 1080p, safe zoom, quality encoding
// =========================================================
async function checkFFmpeg() {
  try { execSync("ffmpeg -version", { stdio: "ignore" }); }
  catch { throw new Error("FFmpeg not installed! Run: sudo apt-get install -y ffmpeg"); }
}

async function pngToClip(pngBuf, idx) {
  const pngPath  = path.join(CONFIG.TEMP_DIR, `slide_${idx}.png`);
  const clipPath = path.join(CONFIG.TEMP_DIR, `clip_${idx}.mp4`);
  fs.writeFileSync(pngPath, pngBuf);

  const dur    = CONFIG.SLIDE_DURATION;
  const frames = dur * CONFIG.FPS;

  // SAFE ZOOM: max 1.05 — text guaranteed to stay inside
  // Scale to exact 1080×1920 FIRST, then zoompan within those bounds
  // zoompan always uses centred x/y so content never drifts off-screen
  const zoomExpr = idx % 2 === 0
    ? `z='min(zoom+0.00055,1.05)'`                              // slow zoom-in
    : `z='if(eq(on,1),1.05,max(zoom-0.00055,1.0))'`;           // slow zoom-out

  const vf = [
    // Step 1: force exact output size — critical before zoompan
    `scale=${W}:${H}:force_original_aspect_ratio=disable,setsar=1`,
    // Step 2: zoompan — always centred, bounded to exact W×H
    `zoompan=${zoomExpr}:d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${CONFIG.FPS}`,
    // Step 3: pixel format for H.264
    `format=yuv420p`,
  ].join(",");

  // Quality: crf 14 (near-lossless) + hard bitrate floor for 1080p
  await exec(
    `ffmpeg -y -loop 1 -i "${pngPath}" -t ${dur}` +
    ` -vf "${vf}"` +
    ` -c:v libx264 -preset fast -crf 14` +
    ` -b:v 8000k -maxrate 10000k -bufsize 20000k` +
    ` -g ${CONFIG.FPS * 2}` +    // keyframe every 2s for seeking
    ` "${clipPath}"`
  );
  return clipPath;
}

async function concatClips(clipPaths, outputPath) {
  if (clipPaths.length === 1) { fs.copyFileSync(clipPaths[0], outputPath); return; }
  const fadeDur = 0.28;
  const dur     = CONFIG.SLIDE_DURATION;
  const parts   = [];
  let prev      = "[0:v]";
  let offset    = dur - fadeDur;
  for (let i = 1; i < clipPaths.length; i++) {
    const out = i === clipPaths.length - 1 ? "[vout]" : `[v${i}]`;
    parts.push(`${prev}[${i}:v]xfade=transition=fade:duration=${fadeDur}:offset=${offset.toFixed(3)}${out}`);
    prev    = `[v${i}]`;
    offset += dur - fadeDur;
  }
  const inputs = clipPaths.map(p => `-i "${p}"`).join(" ");
  await exec(
    `ffmpeg -y ${inputs}` +
    ` -filter_complex "${parts.join(";")}"` +
    ` -map "[vout]" -c:v libx264 -preset fast -crf 14 -b:v 8000k "${outputPath}"`
  );
}

async function burnAudio(videoPath, audioPath, finalPath, totalDuration) {
  if (!audioPath) { fs.copyFileSync(videoPath, finalPath); return; }
  await exec(
    `ffmpeg -y -i "${videoPath}" -stream_loop -1 -i "${audioPath}"` +
    ` -t ${totalDuration}` +
    ` -filter_complex "[1:a]atrim=duration=${totalDuration},` +
                       `afade=t=in:st=0:d=0.8,` +
                       `afade=t=out:st=${totalDuration - 1.2}:d=1.2[aout]"` +
    ` -map 0:v -map "[aout]"` +
    ` -c:v copy -c:a aac -b:a 256k "${finalPath}"`
  );
}

async function buildReel(pngBuffers, niche) {
  await checkFFmpeg();
  const totalDuration = pngBuffers.length * CONFIG.SLIDE_DURATION;
  console.log(`\n🎬 Building reel — ${pngBuffers.length} × ${CONFIG.SLIDE_DURATION}s = ${totalDuration}s`);

  const clipPaths = [];
  for (let i = 0; i < pngBuffers.length; i++) {
    process.stdout.write(`  Clip ${i + 1}/${pngBuffers.length}… `);
    clipPaths.push(await pngToClip(pngBuffers[i], i));
    console.log("✓");
  }

  const concatPath = path.join(CONFIG.TEMP_DIR, "concat.mp4");
  console.log("  Concat + transitions…");
  await concatClips(clipPaths, concatPath);

  const audioPath = selectAudio(niche);
  const finalPath = path.join(CONFIG.TEMP_DIR, "reel_final.mp4");
  console.log("  Burning audio…");
  await burnAudio(concatPath, audioPath, finalPath, totalDuration);

  const buf = fs.readFileSync(finalPath);
  console.log(`  ✅ ${(buf.length / 1024 / 1024).toFixed(2)} MB`);

  [...clipPaths, concatPath].forEach(p => { try { fs.unlinkSync(p); } catch {} });
  for (let i = 0; i < pngBuffers.length; i++) {
    try { fs.unlinkSync(path.join(CONFIG.TEMP_DIR, `slide_${i}.png`)); } catch {}
  }
  return buf;
}

// =========================================================
// GROQ CONTENT GENERATION
// =========================================================
const NICHES = [
  "STOICISM", "WEALTH MINDSET", "MOTIVATION", "PSYCHOLOGY",
  "DISCIPLINE", "SUCCESS HABITS", "EMOTIONAL INTELLIGENCE", "FOCUS & PRODUCTIVITY",
];

async function generateContent(niche) {
  if (!SECRETS.GROQ_API_KEY) throw new Error("GROQ_API_KEY missing!");
  const prompt = `You are a viral Instagram Reels copywriter. Create ${CONFIG.SLIDE_COUNT} slides for: "${niche}".

RULES:
1. Exactly ${CONFIG.SLIDE_COUNT} slides.
2. Slide 1: Hook — 8-12 words. Open with "What if", "Why do", "Most people", "Did you know".
3. Slides 2-${CONFIG.SLIDE_COUNT - 1}: Insight — exactly 10-14 words. Deep truth. Punchy.
4. Slide ${CONFIG.SLIDE_COUNT}: CTA — 8-10 words. "Save this", "Follow for more", "Share with someone who needs this".
5. "highlight": 1-2 exact phrases (2-4 words, exact match to text) for PILL BADGES.
6. "emoji": one relevant emoji.
7. "theme_title": 2-4 word catchy heading.
8. "caption": hook under 12 words + 2 emojis, \\n\\n.\\n.\\n.\\n5 hashtags.

Return ONLY raw JSON, no markdown.
{"theme_title":"...","slides":[{"text":"...","highlight":["..."],"emoji":"..."}],"caption":"..."}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRETS.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: CONFIG.GROQ_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.85 }),
  });
  if (!res.ok) throw new Error(`Groq error: ${await res.text()}`);
  const raw   = (await res.json()).choices[0].message.content.trim();
  const clean = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
  return JSON.parse(clean);
}

// =========================================================
// FALLBACK
// =========================================================
const FALLBACK = {
  theme_title: "MINDSET SHIFT",
  slides: [
    { text:"What if one decision today could reshape your entire future?",        highlight:["one decision"],           emoji:"🧠" },
    { text:"Most people never start because they wait to feel completely ready.", highlight:["never start","ready"],    emoji:"⚠️" },
    { text:"Your brain silently becomes what you choose to repeatedly think.",    highlight:["repeatedly","brain"],     emoji:"🔁" },
    { text:"True discipline means doing hard work before you feel motivated.",    highlight:["discipline","hard work"], emoji:"🎯" },
    { text:"Write three small wins every morning to rewire your mindset daily.",  highlight:["three wins","rewire"],    emoji:"⚡" },
    { text:"Save this and share with someone who needs the shift today.",         highlight:["Save this","the shift"],  emoji:"🚀" },
  ],
  caption:"This mindset shift changes everything 🧠👇\n\n.\n.\n.\n#mindset #psychology #success #stoicism #viral",
};

// =========================================================
// META REELS UPLOAD — 3-phase
// =========================================================
async function getPageToken(pid, token) {
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${pid}?fields=access_token&access_token=${token}`);
    if (r.ok) { const j = await r.json(); if (j.access_token) return j.access_token; }
  } catch (e) { console.warn("Token exchange:", e.message); }
  return token;
}

async function postReel(videoBuffer, caption) {
  if (!SECRETS.PAGE_OR_IG_ID || !SECRETS.PAGE_ACCESS_TOKEN) throw new Error("Missing credentials!");
  const pid   = SECRETS.PAGE_OR_IG_ID;
  const token = await getPageToken(pid, SECRETS.PAGE_ACCESS_TOKEN);
  const size  = videoBuffer.length;
  console.log("\n📤 Uploading reel to Meta…");

  const init = await fetch(`https://graph.facebook.com/v20.0/${pid}/video_reels`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_phase: "start", access_token: token }),
  });
  if (!init.ok) throw new Error(`Init failed: ${await init.text()}`);
  const { video_id, upload_url } = await init.json();
  if (!video_id || !upload_url) throw new Error("No video_id/upload_url");
  console.log(`  ID: ${video_id}`);

  console.log(`  Sending ${(size / 1024 / 1024).toFixed(2)} MB…`);
  const transfer = await fetch(upload_url, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, "Content-Type": "video/mp4", offset: "0", file_size: String(size) },
    body: videoBuffer,
  });
  if (!transfer.ok) throw new Error(`Transfer failed: ${await transfer.text()}`);
  console.log("  Transferred ✓");

  const pub = await fetch(`https://graph.facebook.com/v20.0/${pid}/video_reels`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase: "finish", video_id, access_token: token,
      video_state: "PUBLISHED", description: caption,
      title: caption.split("\n")[0].slice(0, 100),
    }),
  });
  if (!pub.ok) throw new Error(`Publish failed: ${await pub.text()}`);
  const result = await pub.json();
  console.log("✅ Published! ID:", result.post_id ?? result.id ?? JSON.stringify(result));
  return result;
}

// =========================================================
// MAIN
// =========================================================
async function run() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🎬 FB Reels Bot  —  SpotNet / @Akhil");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const niche = NICHES[Math.floor(Math.random() * NICHES.length)];
  console.log("🎯 Niche:", niche);

  let content = FALLBACK;
  try {
    console.log("💬 Generating via Groq…");
    content = await generateContent(niche);
    console.log(`   Theme: "${content.theme_title}"  Slides: ${content.slides.length}`);
  } catch (e) { console.error("Groq failed — fallback:", e.message); }

  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  console.log("🎨 Theme:", theme.name);

  console.log("\n🖼  Rendering slides…");
  const pngs = [];
  for (let i = 0; i < content.slides.length; i++) {
    process.stdout.write(`  Slide ${i + 1}/${content.slides.length}… `);
    pngs.push(await renderPng(content.slides[i], i, content.slides.length, theme, content.theme_title));
    console.log("✓");
  }

  const videoBuffer = await buildReel(pngs, niche);
  console.log("\n📱 Caption:", content.caption.split("\n")[0]);
  await postReel(videoBuffer, content.caption);

  try { fs.unlinkSync(path.join(CONFIG.TEMP_DIR, "reel_final.mp4")); } catch {}
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  All done! ✅");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

run().catch(e => { console.error("\n💥 Fatal:", e.message); process.exit(1); });
