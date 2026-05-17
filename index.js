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
  GROQ_MODEL: "llama3-70b-8192",
  SLIDE_COUNT: 6,
  SLIDE_DURATION: 3.2,
  FPS: 30,
  WIDTH: 1080,
  HEIGHT: 1920,
  TEMP_DIR: os.tmpdir(),
  VIDEO_BITRATE: "15M",
  VIDEO_CRF: 15,                        // ✅ fixed – was VIDEO_CRF
  PRESET: "medium",
};

// ... (NICHE_AUDIO, loadSecrets, THEMES remain unchanged)

// =========================================================
// FONT SETUP (cached)
// =========================================================
const HAS_FONT = fs.existsSync("./font.ttf");
const FONT_FAM = HAS_FONT ? "'CardFont','Arial Black',sans-serif" : "'Arial Black','Liberation Sans','DejaVu Sans',sans-serif";
let cachedFontCSS = null;
function getFontFaceCSS() {
  if (cachedFontCSS) return cachedFontCSS;
  if (!HAS_FONT) return "";
  const b64 = fs.readFileSync("./font.ttf").toString("base64");
  cachedFontCSS = `@font-face{font-family:'CardFont';src:url('data:font/truetype;base64,${b64}') format('truetype');font-weight:700 900;}`;
  return cachedFontCSS;
}

// =========================================================
// TEXT UTILITIES (same as before – pill overflow fixed)
// =========================================================
function escapeXml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const CHAR_W_COEF = 0.62;
const TEXT_BOX_PX = 860;
const MAX_LINES = 4;

function computeLayout(text) {
  for (const fs of [88, 80, 72, 64, 56, 50]) {
    const maxChars = Math.floor(TEXT_BOX_PX / (fs * CHAR_W_COEF));
    const lines = wordWrap(text, maxChars);
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

function splitHighlights(line, highlights = []) {
  if (!highlights.length) return [{ t: line, h: false }];
  const hls = [...highlights].filter(Boolean).sort((a, b) => b.length - a.length);
  let parts = [{ t: line, h: false }];
  for (const hl of hls) {
    const re = new RegExp(`(${hl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    parts = parts.flatMap(p => {
      if (p.h) return [p];
      return p.t.split(re).filter(s => s.length > 0).map(s => s.toLowerCase() === hl.toLowerCase() ? { t: s, h: true } : { t: s, h: false });
    });
  }
  return parts;
}

function buildPillGroups(lines, highlights, fs, lh, firstLineY, theme) {
  if (!highlights || highlights.length === 0) return "";
  const pillH = fs * 1.18;
  const pillRx = pillH / 2;
  const charW = fs * CHAR_W_COEF;
  const groups = [];
  let lineY = firstLineY;

  for (const line of lines) {
    const parts = splitHighlights(line, highlights);
    let lineText = "";
    const segs = [];
    for (const p of parts) {
      segs.push({ ...p, startIdx: lineText.length });
      lineText += p.t;
    }
    const totalW = lineText.length * charW;
    const startX = 540 - totalW / 2;

    for (const seg of segs) {
      if (!seg.h) continue;
      const segW = seg.t.length * charW + 28;
      const segX = startX + seg.startIdx * charW;
      const pillX = segX - 14;
      const pillY = lineY - fs * 0.85;
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

function buildTextLines(lines, highlights, fs, lh, firstLineY, theme) {
  let lineY = firstLineY;
  return lines.map(line => {
    const parts = splitHighlights(line, highlights);
    const tspans = parts.map(p => `<tspan fill="${p.h ? theme.accent : theme.text}" font-weight="900">${escapeXml(p.t)}</tspan>`).join("");
    const y = lineY; lineY += lh;
    return `<text x="540" y="${y.toFixed(1)}" font-size="${fs}" font-family="${FONT_FAM}" font-weight="900" text-anchor="middle" dominant-baseline="auto">${tspans}</text>`;
  }).join("\n");
}

// =========================================================
// SVG SLIDE BUILDER (no slide numbers, no dots, centred header/footer)
// =========================================================
const W = 1080, H = 1920;
const CARD = { x: 54, y: 108, w: 972, h: 1704, rx: 40 };
const TZ_TOP = CARD.y + 130;
const TZ_BOTTOM = CARD.y + CARD.h - 130;
const TZ_CY = (TZ_TOP + TZ_BOTTOM) / 2;

function textRectGeometry(lines, fs, lh) {
  const blockH = lines.length * lh;
  const rectTop = TZ_CY - blockH / 2 - fs * 0.55 - 32;
  const rectH = blockH + fs * 0.55 + 64;
  const rectX = 540 - TEXT_BOX_PX / 2 - 36;
  const rectW = TEXT_BOX_PX + 72;
  return { rectTop, rectH, rectX, rectW, firstLineY: TZ_CY - blockH / 2 + fs * 0.72 };
}

function buildSlide(slide, idx, total, theme, catTitle) {
  const { fs, lines, lh } = computeLayout(slide.text);
  const { rectTop, rectH, rectX, rectW, firstLineY } = textRectGeometry(lines, fs, lh);
  const fontCSS = getFontFaceCSS();
  const pillGroups = buildPillGroups(lines, slide.highlight || [], fs, lh, firstLineY, theme);
  const textLines = buildTextLines(lines, slide.highlight || [], fs, lh, firstLineY, theme);
  const BULLET = "&#x25CF;";

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
  <radialGradient id="g4" cx="50%" cy="95%" r="40%">
    <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.18"/>
    <stop offset="100%" stop-color="${theme.bg1}" stop-opacity="0"/>
  </radialGradient>
  <filter id="bigblur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="80"/></filter>
  <filter id="softblur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>
  <filter id="textglow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="accentglow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="22" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feBlend in="SourceGraphic" mode="overlay"/></filter>
</defs>

<!-- Background -->
<rect width="1080" height="1920" fill="${theme.bg1}"/>
<rect width="1080" height="1920" fill="url(#g1)" filter="url(#bigblur)"/>
<rect width="1080" height="1920" fill="url(#g2)" filter="url(#bigblur)"/>
<rect width="1080" height="1920" fill="url(#g3)" filter="url(#bigblur)"/>
<rect width="1080" height="1920" fill="url(#g4)" filter="url(#bigblur)"/>
<rect width="1080" height="1920" fill="${theme.accent}" opacity="0.012" filter="url(#noise)"/>

<circle cx="1010" cy="120" r="150" fill="${theme.accent}" opacity="0.07"/>
<circle cx="1010" cy="120" r="80" fill="${theme.accent}" opacity="0.10"/>
<circle cx="1010" cy="120" r="18" fill="${theme.accent}" opacity="0.35"/>
<circle cx="86" cy="1740" r="110" fill="none" stroke="${theme.accent2}" stroke-width="1.5" opacity="0.18"/>
<circle cx="86" cy="1740" r="56" fill="${theme.accent2}" opacity="0.05"/>

<rect x="51" y="105" width="978" height="1710" rx="43" fill="none" stroke="${theme.accent}" stroke-width="1.5" opacity="0.14" filter="url(#softblur)"/>
<rect x="54" y="108" width="972" height="1704" rx="40" fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.085)" stroke-width="1.5"/>
<rect x="56" y="110" width="968" height="200" rx="38" fill="rgba(255,255,255,0.025)"/>

<!-- Header: Category Title – Centered, Bold -->
<rect x="${CARD.x + 28}" y="${CARD.y + 36}" width="${CARD.w - 56}" height="62" rx="16" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
<text x="540" y="${CARD.y + 70}" font-size="27" fill="${theme.accent}" font-family="${FONT_FAM}" font-weight="900" letter-spacing="3.5" text-anchor="middle" dominant-baseline="middle">${escapeXml(catTitle.toUpperCase())}</text>

<text x="${CARD.x + 36}" y="${CARD.y + 340}" font-size="220" fill="${theme.accent}" opacity="0.055" font-family="Georgia,serif">&#x201C;</text>

<rect x="${rectX.toFixed(1)}" y="${rectTop.toFixed(1)}" width="${rectW.toFixed(1)}" height="${rectH.toFixed(1)}" rx="20" fill="${theme.accent}" opacity="0.05"/>
<rect x="${rectX.toFixed(1)}" y="${(rectTop + 16).toFixed(1)}" width="6" height="${(rectH - 32).toFixed(1)}" rx="3" fill="${theme.accent}" opacity="0.80" filter="url(#accentglow)"/>

<rect x="498" y="${(firstLineY - fs * 2.6).toFixed(1)}" width="84" height="64" rx="32" fill="rgba(255,255,255,0.06)" stroke="${theme.pillStroke}" stroke-width="1.2"/>
<text x="540" y="${(firstLineY - fs * 2.15).toFixed(1)}" font-size="40" text-anchor="middle" dominant-baseline="middle" font-family="'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif">${escapeXml(slide.emoji ?? "✨")}</text>

${pillGroups}

<g filter="url(#textglow)">
${textLines}
</g>

<!-- Footer: Username centered -->
<rect x="${CARD.x + 28}" y="${CARD.y + CARD.h - 108}" width="290" height="56" rx="28" fill="${theme.accent}" opacity="0.14"/>
<rect x="${CARD.x + 30}" y="${CARD.y + CARD.h - 106}" width="286" height="52" rx="26" fill="rgba(0,0,0,0.35)"/>
<text x="540" y="${CARD.y + CARD.h - 80}" font-size="27" fill="${theme.text}" font-family="${FONT_FAM}" font-weight="900" text-anchor="middle" dominant-baseline="middle">${escapeXml(CONFIG.HANDLE)}</text>

<rect x="${CARD.x + 28}" y="${CARD.y + CARD.h - 26}" width="200" height="5" rx="2.5" fill="${theme.accent2}" opacity="0.55"/>
<rect x="${CARD.x + 28}" y="${CARD.y + CARD.h - 26}" width="80" height="5" rx="2.5" fill="${theme.accent}" opacity="0.85"/>
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
// AUDIO SELECTOR (unchanged)
// =========================================================
function selectAudio(niche) {
  const tracks = NICHE_AUDIO[niche] ?? FALLBACK_AUDIO;
  const track = tracks[Math.floor(Math.random() * tracks.length)];
  const fullPath = path.resolve(`./audio/${track}`);
  if (fs.existsSync(fullPath)) {
    console.log(`  🎵 Audio: ${track}`);
    return fullPath;
  }
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
// VIDEO GENERATION – High quality, no zoom, subtle beat pulse
// =========================================================
async function checkFFmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    throw new Error("FFmpeg not found! Install: sudo apt-get install -y ffmpeg");
  }
}

// PNG to clip – NO ZOOM, fixed CRF
async function pngToClip(pngBuf, idx, duration = CONFIG.SLIDE_DURATION) {
  const pngPath = path.join(CONFIG.TEMP_DIR, `slide_${idx}.png`);
  const clipPath = path.join(CONFIG.TEMP_DIR, `clip_${idx}.mp4`);
  fs.writeFileSync(pngPath, pngBuf);

  await exec(
    `ffmpeg -y -loop 1 -i "${pngPath}" -t ${duration} ` +
    `-vf "scale=${CONFIG.WIDTH}:${CONFIG.HEIGHT}:force_original_aspect_ratio=increase,crop=${CONFIG.WIDTH}:${CONFIG.HEIGHT},fps=${CONFIG.FPS},format=yuv420p" ` +
    `-c:v libx264 -preset ${CONFIG.PRESET} -crf ${CONFIG.VIDEO_CRF} ` +   // ✅ fixed: VIDEO_CRF
    `-pix_fmt yuv420p -movflags +faststart "${clipPath}"`
  );
  return clipPath;
}

// Simple concatenation without xfade
async function concatClips(clipPaths, outputPath) {
  const listFile = path.join(CONFIG.TEMP_DIR, "concat.txt");
  fs.writeFileSync(listFile, clipPaths.map(p => `file '${p}'`).join("\n"));
  await exec(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`);
  fs.unlinkSync(listFile);
}

// Burn audio with a subtle white flash every 0.5s (simulated beat)
async function burnAudioWithPulse(videoPath, audioPath, finalPath, totalDuration) {
  if (!audioPath) {
    fs.copyFileSync(videoPath, finalPath);
    return;
  }

  await exec(
    `ffmpeg -y -i "${videoPath}" -stream_loop -1 -i "${audioPath}" ` +
    `-filter_complex "[1:a]atrim=duration=${totalDuration},afade=t=out:st=${totalDuration - 1}:d=1[aout];[0:v]drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='lt(mod(t,0.5),0.15)':alpha='0.08'[vout]" ` +
    `-map "[vout]" -map "[aout]" ` +
    `-c:v libx264 -preset ${CONFIG.PRESET} -crf ${CONFIG.VIDEO_CRF} -c:a aac -b:a 192k ` +
    `"${finalPath}"`
  );
}

async function buildReel(pngBuffers, niche, theme) {
  await checkFFmpeg();

  const totalDuration = pngBuffers.length * CONFIG.SLIDE_DURATION;
  console.log(`\n🎬 Building reel: ${pngBuffers.length} slides × ${CONFIG.SLIDE_DURATION}s = ${totalDuration}s`);

  const clipPaths = [];
  for (let i = 0; i < pngBuffers.length; i++) {
    process.stdout.write(`  Clip ${i + 1}/${pngBuffers.length}… `);
    clipPaths.push(await pngToClip(pngBuffers[i], i));
    console.log("✓");
  }

  const concatPath = path.join(CONFIG.TEMP_DIR, "concat.mp4");
  console.log("  Concatenating clips…");
  await concatClips(clipPaths, concatPath);

  const audioPath = selectAudio(niche);
  const finalPath = path.join(CONFIG.TEMP_DIR, "reel_final.mp4");
  console.log("  Burning audio with subtle beat pulse…");
  await burnAudioWithPulse(concatPath, audioPath, finalPath, totalDuration);

  const videoBuffer = fs.readFileSync(finalPath);
  console.log(`  ✅ Reel ready: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  // Cleanup
  [...clipPaths, concatPath].forEach(p => { try { fs.unlinkSync(p); } catch {} });
  clipPaths.forEach(p => {
    const png = p.replace(/clip_(\d+)\.mp4/, "slide_$1.png");
    try { fs.unlinkSync(png); } catch {}
  });

  return videoBuffer;
}

// =========================================================
// GROQ CONTENT GENERATION (unchanged, except model fixed)
// =========================================================
const NICHES = ["STOICISM", "WEALTH MINDSET", "MOTIVATION", "PSYCHOLOGY", "DISCIPLINE", "SUCCESS HABITS", "EMOTIONAL INTELLIGENCE", "FOCUS & PRODUCTIVITY"];

async function generateContent(niche) {
  if (!SECRETS.GROQ_API_KEY) throw new Error("GROQ_API_KEY missing!");

  const prompt = `You are a viral Instagram Reels copywriter. Create a ${CONFIG.SLIDE_COUNT}-slide reel script for the niche: "${niche}".

STRICT RULES:
1. Exactly ${CONFIG.SLIDE_COUNT} slides.
2. Slide 1: Hook — 8-12 words. Start with "What if", "Why do", "How does", "Did you know", "Most people", etc.
3. Slides 2-${CONFIG.SLIDE_COUNT - 1}: Deep psychological truths or actionable insights — 10-14 words each. Punchy and powerful.
4. Slide ${CONFIG.SLIDE_COUNT}: CTA slide — 8-10 words. Use "Save this", "Follow for more", "Share if this hit", etc.
5. "highlight": 1-2 short phrases (2-4 words max each) from that slide's text.
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

  const raw = (await res.json()).choices[0].message.content.trim();
  const clean = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
  const data = JSON.parse(clean);
  return data;
}

// Fallback (unchanged)
const FALLBACK = {
  theme_title: "MINDSET SHIFT",
  slides: [
    { text: "What if one decision today could reshape your entire future?", highlight: ["one decision"], emoji: "🧠" },
    { text: "Most people never start because they wait to feel completely ready.", highlight: ["never start", "ready"], emoji: "⚠️" },
    { text: "Your brain silently becomes whatever you choose to repeatedly think.", highlight: ["repeatedly", "brain"], emoji: "🔁" },
    { text: "True discipline means doing the hard work before you feel motivated.", highlight: ["discipline", "hard work"], emoji: "🎯" },
    { text: "Write three small wins every single morning to rewire your mindset.", highlight: ["three wins", "rewire"], emoji: "⚡" },
    { text: "Save this and share with someone who needs the shift today.", highlight: ["Save this", "the shift"], emoji: "🚀" },
  ],
  caption: "This mindset shift will change how you see everything 🧠👇\n\n.\n.\n.\n#mindset #psychology #success #stoicism #viral",
};

// =========================================================
// META UPLOAD (unchanged)
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

  const pid = SECRETS.PAGE_OR_IG_ID;
  const token = await getPageToken(pid, SECRETS.PAGE_ACCESS_TOKEN);
  const size = videoBuffer.length;

  console.log("\n📤 Uploading reel to Meta…");

  const initRes = await fetch(`https://graph.facebook.com/v20.0/${pid}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_phase: "start", access_token: token }),
  });
  if (!initRes.ok) throw new Error(`Reel init failed: ${await initRes.text()}`);
  const { video_id, upload_url } = await initRes.json();
  console.log(`  Video ID: ${video_id}`);

  const transferRes = await fetch(upload_url, {
    method: "POST",
    headers: { "Authorization": `OAuth ${token}`, "Content-Type": "video/mp4", "offset": "0", "file_size": String(size) },
    body: videoBuffer,
  });
  if (!transferRes.ok) throw new Error(`Reel transfer failed: ${await transferRes.text()}`);
  console.log("  Transfer complete ✓");

  const publishRes = await fetch(`https://graph.facebook.com/v20.0/${pid}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase: "finish",
      video_id: video_id,
      access_token: token,
      video_state: "PUBLISHED",
      description: caption,
      title: caption.split("\n")[0].slice(0, 100),
    }),
  });
  if (!publishRes.ok) throw new Error(`Reel publish failed: ${await publishRes.text()}`);
  const result = await publishRes.json();
  console.log("✅ Reel published! ID:", result.post_id ?? result.id);
  return result;
}

// =========================================================
// MAIN
// =========================================================
async function run() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🎬 FB/IG Reels Bot — High Quality + Algorithm Hacks");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const niche = NICHES[Math.floor(Math.random() * NICHES.length)];
  console.log("🎯 Niche:", niche);

  let content = FALLBACK;
  try {
    console.log("💬 Generating content via Groq…");
    content = await generateContent(niche);
    console.log(`   Theme: "${content.theme_title}"  Slides: ${content.slides.length}`);
  } catch (e) {
    console.error("Groq failed — using fallback:", e.message);
  }

  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  console.log("🎨 Visual theme:", theme.name);

  const pngs = [];
  console.log("\n🖼 Rendering slides…");
  for (let i = 0; i < content.slides.length; i++) {
    process.stdout.write(`  Slide ${i + 1}/${content.slides.length}… `);
    pngs.push(await renderPng(content.slides[i], i, content.slides.length, theme, content.theme_title));
    console.log("✓");
  }

  const videoBuffer = await buildReel(pngs, niche, theme);

  console.log("\n📱 Caption:", content.caption.split("\n")[0]);
  await postReel(videoBuffer, content.caption);

  try { fs.unlinkSync(path.join(CONFIG.TEMP_DIR, "reel_final.mp4")); } catch {}

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  All done! ✅");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

run().catch(e => { console.error("\n💥 Fatal:", e.message); process.exit(1); });
