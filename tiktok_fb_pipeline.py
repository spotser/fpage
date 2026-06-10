#!/usr/bin/env python3
"""
TikTok Profile → Facebook Reel + Instagram Reel & Story
- Download: yt-dlp profile scraper
- Anti-Copyright: 13-Layer FFmpeg DNA Fingerprint
- Caption: Groq AI (English) → fallback
- FB Upload: Facebook Graph API (direct)
- Insta Upload: uguu.se temp host → Instagram Graph API (Reel + Story)
- Dedupe: ID + MD5 Hash
- Watermark: env secret (optional)
- FB and Insta pipelines are INDEPENDENT — one fail = other still runs
"""

import os
import re
import sys
import json
import subprocess
import requests
import time
import random
import hashlib
from pathlib import Path
from datetime import datetime

# ==========================================
# CONFIGURATION
# ==========================================

TIKTOK_PROFILES   = [p.strip().lstrip("@") for p in os.environ.get("TIKTOK_PROFILE_ID", "").split(",") if p.strip()]
FB_PAGE_ID        = os.environ.get("FB_PAGE_ID", "").strip()
PAGE_ACCESS_TOKEN = os.environ.get("PAGE_ACCESS_TOKEN", "").strip()  # Sys User Token
GROQ_API_KEY      = os.environ.get("GROQ_API_KEY", "").strip()
WATERMARK_TEXT    = os.environ.get("WATERMARK_TEXT", "").strip()

# Runtime mein Page ID se auto-fetch honge — koi extra secret nahi
INSTA_ACCOUNT_ID   = ""
INSTA_ACCESS_TOKEN = ""

# PATHS
BASE_DIR      = Path("temp_work")
DOWNLOAD_DIR  = BASE_DIR / "downloads"
PROCESSED_DIR = BASE_DIR / "processed"
HISTORY_FILE  = Path("upload_history.txt")
HASH_HISTORY  = Path("hash_history.txt")
YT_DLP_ARCHIVE = BASE_DIR / "yt_dlp_archive.txt"

FB_BASE   = "https://graph.facebook.com/v19.0"
INSTA_BASE = "https://graph.facebook.com/v19.0"

# ==========================================
# HELPERS
# ==========================================

def log(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    icons = {"INFO": "✅", "WARN": "⚠️ ", "ERR": "❌", "STEP": "🔄"}
    print(f"[{ts}] {icons.get(level, '•')}  {msg}", flush=True)

def run_cmd(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()

def escape_ffmpeg_text(text: str) -> str:
    if not text: return ""
    text = text.replace("'", "").replace(":", "")
    text = text.replace("\\", "\\\\").replace(",", "\\,")
    text = text.replace("%", "%%")  # % crash fix
    return text.encode('ascii', 'ignore').decode('ascii').strip()

def setup_dirs():
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    for d in [DOWNLOAD_DIR, PROCESSED_DIR]:
        if d.exists():
            for f in d.glob("*"):
                try: f.unlink()
                except: pass
        d.mkdir(parents=True, exist_ok=True)
    if YT_DLP_ARCHIVE.exists():
        try: YT_DLP_ARCHIVE.unlink()
        except: pass

def validate_env():
    missing = []
    if not TIKTOK_PROFILES: missing.append("TIKTOK_PROFILE_ID")
    if not FB_PAGE_ID:       missing.append("FB_PAGE_ID")
    if not PAGE_ACCESS_TOKEN: missing.append("PAGE_ACCESS_TOKEN")
    if missing:
        log(f"Missing secrets: {', '.join(missing)}", "ERR")
        sys.exit(1)

# ==========================================
# HISTORY / DEDUPE
# ==========================================

def load_history() -> set:
    if not HISTORY_FILE.exists(): return set()
    ids = set()
    for line in HISTORY_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            parts = [p.strip() for p in line.split("|")]
            if parts: ids.add(parts[0])
    return ids

def save_history(tiktok_id: str, fb_id: str, insta_id: str, caption: str, file_hash: str = ""):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not HISTORY_FILE.exists():
        HISTORY_FILE.write_text("# TikTok → FB + Insta History\n\n", encoding="utf-8")
    with open(HISTORY_FILE, "a", encoding="utf-8") as f:
        f.write(f"{tiktok_id} | fb:{fb_id} | insta:{insta_id} | {ts} | {caption[:80]}\n")
    if file_hash:
        with open(HASH_HISTORY, "a", encoding="utf-8") as f:
            f.write(f"{file_hash}\n")
    log(f"History updated: {tiktok_id}")

def get_file_hash(path: Path) -> str:
    hasher = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

def is_duplicate_hash(file_hash: str) -> bool:
    if not HASH_HISTORY.exists(): return False
    return file_hash in [h.strip() for h in HASH_HISTORY.read_text().splitlines() if h.strip()]

# ==========================================
# DOWNLOAD — yt-dlp
# ==========================================

def download_video() -> tuple[Path, str, str] | None:
    for profile in TIKTOK_PROFILES:
        result = _try_download_profile(profile)
        if result:
            return result
    log("Koi bhi profile se naya video nahi mila.", "INFO")
    return None

def _try_download_profile(profile: str) -> tuple[Path, str, str] | None:
    profile_url = f"https://www.tiktok.com/@{profile}"
    log(f"yt-dlp: {profile_url} try kar raha hoon...", "STEP")

    # Already-uploaded IDs inject karo taaki yt-dlp skip kare
    uploaded_ids = load_history()
    if uploaded_ids and not YT_DLP_ARCHIVE.exists():
        try:
            with open(YT_DLP_ARCHIVE, "w", encoding="utf-8") as af:
                for uid in uploaded_ids:
                    af.write(f"tiktok {uid}\n")
            log(f"Archive mein {len(uploaded_ids)} IDs inject kiye", "INFO")
        except Exception as e:
            log(f"Archive inject fail: {e}", "WARN")

    cmd = [
        "yt-dlp", profile_url,
        "--download-archive", str(YT_DLP_ARCHIVE),
        "--socket-timeout", "300",
        "--retries", "100",
        "--fragment-retries", "100",
        "--concurrent-fragments", "1",
        "-f", "wv*[vcodec*=avc1]+wa/b[ext=mp4]/b",
        "-S", "res:720",
        "--force-ipv4",
        "--max-downloads", "1",
        "--write-info-json",
        "-o", str(DOWNLOAD_DIR / "%(id)s.%(ext)s"),
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode not in [0, 101]:
            log(f"yt-dlp error (code {result.returncode}): {result.stderr[:300]}", "ERR")
            return None
    except Exception as e:
        log(f"yt-dlp execution fail: {e}", "ERR")
        return None

    video_files = []
    for ext in ["*.mp4", "*.mkv", "*.webm", "*.mov"]:
        video_files.extend(DOWNLOAD_DIR.glob(ext))

    if not video_files:
        log("Koi naya video nahi mila.", "INFO")
        return None

    v_file = video_files[0]
    vid_id = v_file.stem

    info_path = DOWNLOAD_DIR / f"{vid_id}.info.json"
    raw_caption = "New Video"
    if info_path.exists():
        try:
            meta = json.loads(info_path.read_text(encoding="utf-8"))
            raw_caption = meta.get("title") or meta.get("description") or "New Video"
        except Exception as e:
            log(f"info.json read fail: {e}", "WARN")
        try: info_path.unlink()
        except: pass

    log(f"Downloaded: {v_file.name} | caption: {raw_caption[:80]}")
    return v_file, vid_id, raw_caption

# ==========================================
# 13-LAYER DNA FINGERPRINT
# ==========================================

def process_video(input_path: Path) -> Path | None:
    output_path = PROCESSED_DIR / f"processed_{input_path.name}"
    log("13-Layer DNA Fingerprint apply kar raha hoon...", "STEP")

    d = {
        "pts":        round(random.uniform(0.98, 1.02), 4),
        "cw":         round(random.uniform(0.97, 0.99), 3),
        "cx":         round(random.uniform(0.001, 0.005), 4),
        "brightness": round(random.uniform(-0.02, 0.02), 3),
        "contrast":   round(random.uniform(0.98, 1.05), 3),
        "saturation": round(random.uniform(0.98, 1.10), 3),
        "hue":        round(random.uniform(-2, 2), 1),
        "rotate":     round(random.uniform(-0.01, 0.01), 4),
        "fps":        random.choice([29.97, 30, 24]),
        "pitch":      round(random.uniform(0.98, 1.02), 3),
        "gamma_r":    round(random.uniform(0.97, 1.03), 3),
        "gamma_g":    round(random.uniform(0.97, 1.03), 3),
        "gamma_b":    round(random.uniform(0.97, 1.03), 3),
        "eq_freq":    random.choice([800, 1000, 1200, 1500]),
        "eq_gain":    round(random.uniform(0.5, 1.5), 2),
        "anoise":     round(random.uniform(0.00005, 0.0001), 6),
    }

    possible_fonts = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "C:\\Windows\\Fonts\\arial.ttf"
    ]
    font_path = next((f for f in possible_fonts if os.path.exists(f)), "")
    font_config = f"fontfile='{font_path.replace(chr(92), '/')}':" if font_path else ""

    safe_wm = escape_ffmpeg_text(WATERMARK_TEXT)
    watermark_filter = (
        f"drawtext={font_config}text='{safe_wm}'"
        f":fontcolor=white@0.35:fontsize=32"
        f":x=(w-tw)/2:y=h*0.88"
        f":shadowcolor=black@0.5:shadowx=2:shadowy=2"
    ) if safe_wm else ""

    v_filters = [
        f"setpts={d['pts']}*PTS",
        f"crop=iw*{d['cw']}:ih*{d['cw']}:iw*{d['cx']}:ih*{d['cx']}",
        f"eq=brightness={d['brightness']}:contrast={d['contrast']}:saturation={d['saturation']}:gamma=1.05",
        f"hue=h={d['hue']}",
        f"rotate={d['rotate']}:fillcolor=black:ow=iw:oh=ih",
        "vignette=PI/4+0.1*sin(t)",
        "noise=c0s=3:c0f=t+u",
        "unsharp=3:3:1.2:3:3:0.0",
        f"fps={d['fps']}",
        watermark_filter,
        f"colorchannelmixer=rr={d['gamma_r']}:gg={d['gamma_g']}:bb={d['gamma_b']}",
        "format=yuv420p",
        "deflicker=size=3:mode=am",
    ]
    vf = ",".join(f for f in v_filters if f)

    af = ",".join([
        f"asetrate=44100*{d['pitch']}",
        f"atempo={d['pts']}/{d['pitch']}",
        "aresample=48000",
        f"equalizer=f={d['eq_freq']}:t=o:w=200:g={d['eq_gain']}",
        f"volume=1.0+{d['anoise']}",
        "aresample=44100",
    ])

    cmd = (
        f'ffmpeg -y -i "{input_path}" '
        f'-vf "{vf}" '
        f'-af "{af}" '
        f'-c:v libx264 -preset veryfast -crf 22 '
        f'-c:a aac -b:a 192k '
        f'-map_metadata -1 '
        f'-movflags +faststart '
        f'"{output_path}"'
    )

    try:
        run_cmd(cmd)
        log(f"Fingerprint ok — speed={d['pts']} pitch={d['pitch']} hue={d['hue']:+} fps={d['fps']}")
        return output_path
    except Exception as e:
        log(f"FFmpeg fail: {e}", "ERR")
        return None

# ==========================================
# GROQ — CAPTION
# ==========================================

def generate_caption(raw_caption: str) -> str | None:
    if not GROQ_API_KEY: return None
    log("Groq se caption generate kar raha hoon...", "STEP")

    prompt = (
        f"You are a Facebook Reels Growth Expert for Indian audiences.\n"
        f"Current Date: {datetime.now().strftime('%B %d, %Y')}\n"
        f"TikTok Video Caption: {raw_caption}\n\n"
        f"Generate a VIRAL Facebook Reels caption in ENGLISH ONLY for the 2026 algorithm.\n\n"
        f"STRICT FORMAT — 4 blocks, each separated by a blank line:\n\n"
        f"Block 1 — Hook: PATTERN INTERRUPT — must stop the scroll in under 2 seconds. "
        f"Use something shocking, counter-intuitive, or emotionally triggering. "
        f"Add 1-2 power emojis. Max 100 chars. NO generic openers like 'Did you know' or 'Most people'.\n\n"
        f"Block 2 — Body: 2-3 lines of high-value insight, raw truth, or storytelling in English. "
        f"Each line should make the reader feel something. Add 1 relevant emoji per line.\n\n"
        f"Block 3 — CTA: Must start on a NEW line after a blank line. Exactly 3 lines:\n"
        f"Line 1: Save this 🔖 — you'll need it later.\n"
        f"Line 2: Share this with someone who needs to hear this today 👇\n"
        f"Line 3: Follow the page for your daily dose of truth 🔔\n\n"
        f"Block 4 — Hashtags: Must start on a NEW line after a blank line. "
        f"EXACTLY 20 trending Facebook hashtags separated by spaces. No emojis in hashtags.\n\n"
        f"IMPORTANT:\n"
        f"- ENGLISH ONLY — absolutely no Hindi or Hinglish\n"
        f"- Hook must be UNEXPECTED — not a motivational cliche\n"
        f"- No markdown, no asterisks, no bold text\n"
        f"- No placeholders\n"
        f"- Return valid JSON only\n"
        f"Format: {{\"caption\": \"full caption text with \\n newlines between blocks\"}}"
    )

    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"}
            },
            timeout=25)
        resp.raise_for_status()
        data = json.loads(resp.json()["choices"][0]["message"]["content"])
        return data.get("caption", "")
    except Exception as e:
        log(f"Groq caption fail: {e}", "WARN")
        return None

def get_final_caption(raw_caption: str) -> str:
    ai_caption = generate_caption(raw_caption)
    if ai_caption:
        log("AI caption ready.")
        return ai_caption

    log("Fallback caption use kar raha hoon.", "INFO")
    clean = re.sub(r'#(tiktok|fyp|foryou|foryoupage)\S*', '', raw_caption, flags=re.IGNORECASE)
    clean = re.sub(r'\s+', ' ', clean).strip()
    hooks = [
        "The uncomfortable truth nobody wants to admit 😤",
        "Stop lying to yourself — this is why you're stuck 🔥",
        "The one habit that separates winners from everyone else 💀",
        "You're not lazy. You've just been doing it wrong 😮",
        "This single mindset shift will hit you hard 🧠",
        "They never teach this in school — and it shows 💯",
        "Your comfort zone is quietly killing your potential ⚡",
        "The reason you're tired isn't what you think 🎯",
    ]
    hashtags = (
        "#motivation #mindset #success #nevergiveup #dailymotivation "
        "#personaldevelopment #growthmindset #inspiration #selflove #hustle "
        "#reels #viral #trending #facebookreels #reelsviral "
        "#explore #quotes #positivevibes #lifelessons #winning"
    )
    hook = random.choice(hooks)
    body = f"{clean[:120]}\n\nEvery small step forward counts. Keep pushing, keep growing." if clean else ""
    cta = "Save this 🔖 — you'll need it later.\nShare this with someone who needs to hear this today 👇\nFollow the page for your daily dose of truth 🔔"
    return f"{hook}\n\n{body}\n\n{cta}\n\n{hashtags}".strip()

# ==========================================
# TOKEN EXCHANGE — SYS USER → PAGE TOKEN
# ==========================================

def exchange_sys_user_token(sys_token: str, page_id: str) -> tuple[str, str] | None:
    """Sys User Token se Page Token + Instagram Account ID dono fetch karo"""
    log("System User Token se Page Token + Insta ID fetch kar raha hoon...", "STEP")
    try:
        r = requests.get(
            f"{FB_BASE}/{page_id}",
            params={
                "fields":       "access_token,instagram_business_account",
                "access_token": sys_token,
            },
            timeout=15,
        )
        data = r.json()
        if "access_token" not in data:
            log(f"Token exchange fail: {data.get('error', {}).get('message', data)}", "ERR")
            return None

        page_token = data["access_token"]
        insta_id   = data.get("instagram_business_account", {}).get("id", "")

        if insta_id:
            log(f"Token exchange ok | Insta Account ID: {insta_id}")
        else:
            log("Token exchange ok | Insta Account ID nahi mila — Insta skip hoga", "WARN")

        return page_token, insta_id

    except Exception as e:
        log(f"Token exchange exception: {e}", "ERR")
        return None

# ==========================================
# UGUU.SE — TEMP HOST (for Instagram)
# ==========================================

def upload_to_uguu(video_path: Path) -> str | None:
    """Upload video to uguu.se, get public URL (valid ~3 days)"""
    log("uguu.se pe temp upload kar raha hoon...", "STEP")
    try:
        with open(video_path, "rb") as f:
            resp = requests.post(
                "https://uguu.se/upload",
                files={"files[]": (video_path.name, f, "video/mp4")},
                timeout=120
            )
        resp.raise_for_status()
        data = resp.json()
        # uguu returns: {"success": true, "files": [{"url": "...", "name": "..."}]}
        url = data.get("files", [{}])[0].get("url", "")
        if url:
            log(f"uguu.se upload ok: {url}")
            return url
        log(f"uguu.se response unexpected: {data}", "ERR")
        return None
    except Exception as e:
        log(f"uguu.se upload fail: {e}", "ERR")
        return None

# ==========================================
# FACEBOOK REEL UPLOAD
# ==========================================

def fb_upload_reel(video_path: Path, caption: str) -> str | None:
    log("FB Reel upload shuru kar raha hoon...", "STEP")

    init = requests.post(
        f"{FB_BASE}/{FB_PAGE_ID}/video_reels",
        data={"upload_phase": "start", "access_token": PAGE_ACCESS_TOKEN},
        timeout=30).json()

    if "video_id" not in init:
        log(f"FB init error: {init}", "ERR"); return None

    video_id   = init["video_id"]
    upload_url = init.get("upload_url", "")
    log(f"video_id={video_id}")

    file_size = video_path.stat().st_size
    with open(video_path, "rb") as f:
        upload_resp = requests.post(
            upload_url,
            headers={
                "Authorization": f"OAuth {PAGE_ACCESS_TOKEN}",
                "offset":        "0",
                "file_size":     str(file_size),
                "Content-Type":  "application/octet-stream",
            },
            data=f, timeout=300)

    if upload_resp.status_code not in (200, 201):
        log(f"FB binary upload fail: {upload_resp.text}", "ERR"); return None
    log("Binary upload ok")

    pub = requests.post(
        f"{FB_BASE}/{FB_PAGE_ID}/video_reels",
        data={
            "upload_phase": "finish",
            "video_id":     video_id,
            "title":        caption[:100],
            "description":  caption[:2200],
            "video_state":  "PUBLISHED",
            "access_token": PAGE_ACCESS_TOKEN,
        },
        timeout=30).json()

    if pub.get("success") or "id" in pub:
        log(f"FB Reel published! video_id={video_id}")
        return video_id

    log(f"FB publish error: {pub}", "ERR"); return None

# ==========================================
# INSTAGRAM REEL + STORY UPLOAD
# ==========================================

def insta_upload_reel(video_url: str, caption: str) -> str | None:
    """Instagram Reel upload via public video URL (uguu.se)"""
    if not INSTA_ACCOUNT_ID or not INSTA_ACCESS_TOKEN:
        log("Insta credentials missing — skip", "WARN")
        return None

    log("Instagram Reel container create kar raha hoon...", "STEP")

    # Step 1: Create container
    container = requests.post(
        f"{INSTA_BASE}/{INSTA_ACCOUNT_ID}/media",
        data={
            "media_type":    "REELS",
            "video_url":     video_url,
            "caption":       caption[:2200],
            "share_to_feed": "true",
            "access_token":  INSTA_ACCESS_TOKEN,
        },
        timeout=60).json()

    if "id" not in container:
        log(f"Insta container error: {container}", "ERR"); return None

    container_id = container["id"]
    log(f"Container id={container_id} — processing wait kar raha hoon...", "STEP")

    # Step 2: Wait for video processing (poll max 5 min)
    for attempt in range(20):
        time.sleep(15)
        status = requests.get(
            f"{INSTA_BASE}/{container_id}",
            params={"fields": "status_code", "access_token": INSTA_ACCESS_TOKEN},
            timeout=30).json()
        sc = status.get("status_code", "")
        log(f"  Container status: {sc} (attempt {attempt+1}/20)")
        if sc == "FINISHED":
            break
        if sc == "ERROR":
            log(f"Insta container processing error: {status}", "ERR"); return None
    else:
        log("Insta container processing timeout (5 min)", "ERR"); return None

    # Step 3: Publish reel
    pub = requests.post(
        f"{INSTA_BASE}/{INSTA_ACCOUNT_ID}/media_publish",
        data={
            "creation_id":  container_id,
            "access_token": INSTA_ACCESS_TOKEN,
        },
        timeout=30).json()

    if "id" not in pub:
        log(f"Insta publish error: {pub}", "ERR"); return None

    media_id = pub["id"]
    log(f"Instagram Reel published! media_id={media_id}")
    return media_id

def insta_upload_story(video_url: str) -> str | None:
    """Instagram Story upload via public video URL"""
    if not INSTA_ACCOUNT_ID or not INSTA_ACCESS_TOKEN:
        return None

    log("Instagram Story upload kar raha hoon...", "STEP")

    container = requests.post(
        f"{INSTA_BASE}/{INSTA_ACCOUNT_ID}/media",
        data={
            "media_type":  "STORIES",
            "video_url":   video_url,
            "access_token": INSTA_ACCESS_TOKEN,
        },
        timeout=60).json()

    if "id" not in container:
        log(f"Insta Story container error: {container}", "ERR"); return None

    container_id = container["id"]

    # Wait for processing
    for attempt in range(20):
        time.sleep(15)
        status = requests.get(
            f"{INSTA_BASE}/{container_id}",
            params={"fields": "status_code", "access_token": INSTA_ACCESS_TOKEN},
            timeout=30).json()
        sc = status.get("status_code", "")
        if sc == "FINISHED":
            break
        if sc == "ERROR":
            log(f"Insta Story container error: {status}", "ERR"); return None

    pub = requests.post(
        f"{INSTA_BASE}/{INSTA_ACCOUNT_ID}/media_publish",
        data={"creation_id": container_id, "access_token": INSTA_ACCESS_TOKEN},
        timeout=30).json()

    if "id" not in pub:
        log(f"Insta Story publish error: {pub}", "ERR"); return None

    log(f"Instagram Story published! media_id={pub['id']}")
    return pub["id"]

# ==========================================
# MAIN
# ==========================================

def main():
    validate_env()
    setup_dirs()

    # Sys User Token se Page Token + Insta Account ID dono fetch karo
    global PAGE_ACCESS_TOKEN, INSTA_ACCOUNT_ID, INSTA_ACCESS_TOKEN
    exchange_result = exchange_sys_user_token(PAGE_ACCESS_TOKEN, FB_PAGE_ID)
    if not exchange_result:
        log("Page token exchange fail — exit.", "ERR")
        sys.exit(1)

    PAGE_ACCESS_TOKEN  = exchange_result[0]
    INSTA_ACCOUNT_ID   = exchange_result[1]
    INSTA_ACCESS_TOKEN = PAGE_ACCESS_TOKEN  # Same token FB + Insta dono ke liye

    log("══════════════════════════════════════════════")
    log(f"  profiles={TIKTOK_PROFILES} | Page={FB_PAGE_ID}")
    log(f"  insta={'ON — ' + INSTA_ACCOUNT_ID if INSTA_ACCOUNT_ID else 'OFF (not linked)'} | watermark={'ON' if WATERMARK_TEXT else 'OFF'}")
    log("══════════════════════════════════════════════")

    result = download_video()
    if not result:
        log("Koi naya video nahi mila — exit.")
        return

    v_file, vid_id, raw_caption = result
    p_file = None

    try:
        # 1. Hash dedupe
        file_hash = get_file_hash(v_file)
        if is_duplicate_hash(file_hash):
            log("Duplicate content (hash match) — skip", "WARN")
            return

        # 2. Caption
        caption = get_final_caption(raw_caption)

        # 3. DNA Fingerprint
        p_file = process_video(v_file)
        if not p_file:
            log("Video processing fail — exit.", "ERR")
            return

        fb_id    = None
        insta_id = None

        # ── FACEBOOK PIPELINE (independent) ──────────────────
        try:
            log("── FB Pipeline start ──", "STEP")
            fb_id = fb_upload_reel(p_file, caption)
            if fb_id:
                log(f"FB done! video_id={fb_id}")
            else:
                log("FB upload fail — Insta pipeline continue karega", "WARN")
        except Exception as e:
            log(f"FB pipeline exception: {e} — Insta pipeline continue karega", "ERR")

        # ── INSTAGRAM PIPELINE (independent) ─────────────────
        if INSTA_ACCOUNT_ID and INSTA_ACCESS_TOKEN:
            try:
                log("── Insta Pipeline start ──", "STEP")
                video_url = upload_to_uguu(p_file)
                if video_url:
                    insta_id = insta_upload_reel(video_url, caption)
                    if insta_id:
                        log(f"Insta Reel done! media_id={insta_id}")
                        # Story bhi post karo same video se
                        insta_upload_story(video_url)
                    else:
                        log("Insta Reel upload fail", "WARN")
                else:
                    log("uguu.se upload fail — Insta skip", "WARN")
            except Exception as e:
                log(f"Insta pipeline exception: {e}", "ERR")
        else:
            log("Insta credentials nahi hain — skip", "INFO")

        # 5. Save history (dono ke results ke saath)
        if fb_id or insta_id:
            save_history(vid_id, fb_id or "skip", insta_id or "skip", caption, file_hash)
            log(f"Done! fb={fb_id or 'skip'} | insta={insta_id or 'skip'}")
        else:
            log("Dono pipelines fail — history save nahi ki", "WARN")

    except Exception as e:
        log(f"Pipeline fail: {e}", "ERR")
    finally:
        for f in [v_file, p_file]:
            if f and Path(f).exists():
                try: Path(f).unlink()
                except: pass

    log("══ PIPELINE COMPLETE ══")

if __name__ == "__main__":
    main()
