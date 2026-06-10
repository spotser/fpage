#!/usr/bin/env python3
"""
TikTok Profile → Facebook Reel
- Download: yt-dlp profile scraper (robust, archive-based)
- Anti-Copyright: 14-Layer FFmpeg DNA Fingerprint (audio intact, sirf alter)
- Caption: Groq AI (Facebook SEO Hinglish) → fallback
- Upload: Facebook Graph API (direct — no temp host)
- Dedupe: ID + MD5 Hash
- Watermark: Secret se (optional)
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
PAGE_ACCESS_TOKEN = os.environ.get("PAGE_ACCESS_TOKEN", "").strip()  # sys user token — startup pe page token se exchange ho jaata hai
GROQ_API_KEY      = os.environ.get("GROQ_API_KEY", "").strip()
WATERMARK_TEXT    = os.environ.get("WATERMARK_TEXT", "").strip()  # blank = no watermark

# PATHS
BASE_DIR      = Path("temp_work")
DOWNLOAD_DIR  = BASE_DIR / "downloads"
PROCESSED_DIR = BASE_DIR / "processed"
HISTORY_FILE  = Path("upload_history.txt")
HASH_HISTORY  = Path("hash_history.txt")

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
    return text.encode('ascii', 'ignore').decode('ascii').strip()

def setup_dirs():
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    for d in [DOWNLOAD_DIR, PROCESSED_DIR]:
        if d.exists():
            for f in d.glob("*"):
                try: f.unlink()
                except: pass
        d.mkdir(parents=True, exist_ok=True)

def validate_env():
    missing = []
    if not TIKTOK_PROFILES: missing.append("TIKTOK_PROFILE_ID")
    if not FB_PAGE_ID:         missing.append("FB_PAGE_ID")
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

def save_history(tiktok_id: str, fb_id: str, caption: str, file_hash: str = ""):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not HISTORY_FILE.exists():
        HISTORY_FILE.write_text("# TikTok → Facebook History\n\n", encoding="utf-8")
    with open(HISTORY_FILE, "a", encoding="utf-8") as f:
        f.write(f"{tiktok_id} | {fb_id} | {ts} | {caption[:80]}\n")
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
# TIKWM — PROFILE VIDEO LIST
# ==========================================

# ==========================================
# DOWNLOAD -- yt-dlp profile scraper (robust)
# ==========================================

YT_DLP_ARCHIVE = BASE_DIR / "yt_dlp_archive.txt"

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

    cmd = [
        "yt-dlp",
        profile_url,
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
        # 101 = max-downloads hit (success), 0 = no new videos
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
        log("Koi naya video nahi mila (sab already downloaded hain).", "INFO")
        return None

    v_file = video_files[0]
    vid_id = v_file.stem

    # Caption from info.json
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
# 14-LAYER DNA FINGERPRINT
# ==========================================

def process_video(input_path: Path) -> Path | None:
    output_path = PROCESSED_DIR / f"processed_{input_path.name}"
    log("14-Layer DNA Fingerprint apply kar raha hoon...", "STEP")

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
        "px_x":       random.randint(1, 3),
        "px_y":       random.randint(1, 3),
        "gamma_r":    round(random.uniform(0.97, 1.03), 3),
        "gamma_g":    round(random.uniform(0.97, 1.03), 3),
        "gamma_b":    round(random.uniform(0.97, 1.03), 3),
        "eq_freq":    random.choice([800, 1000, 1200, 1500]),
        "eq_gain":    round(random.uniform(0.5, 1.5), 2),
        "anoise":     round(random.uniform(0.00005, 0.0001), 6),
    }

    # Font setup
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
        "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",                                # Layer 1:  Standardize
        f"setpts={d['pts']}*PTS",                                                                             # Layer 2:  Speed shift
        f"crop=iw*{d['cw']}:ih*{d['cw']}:iw*{d['cx']}:ih*{d['cx']}",                                        # Layer 3:  Jitter crop
        f"eq=brightness={d['brightness']}:contrast={d['contrast']}:saturation={d['saturation']}:gamma=1.05", # Layer 4:  Color DNA
        f"hue=h={d['hue']}",                                                                                  # Layer 5:  Hue shift
        f"rotate={d['rotate']}:fillcolor=black:ow=iw:oh=ih",                                                 # Layer 6:  Micro-tilt
        "vignette=PI/4+0.1*sin(t)",                                                                           # Layer 7:  Dynamic vignette
        "noise=c0s=3:c0f=t+u",                                                                                # Layer 8:  Film grain
        "unsharp=3:3:1.2:3:3:0.0",                                                                           # Layer 9:  Sharpness
        f"fps={d['fps']}",                                                                                    # Layer 10: FPS shift
        watermark_filter,                                                                                      # Layer 11: Watermark (optional)
        f"pad=iw+{d['px_x']}:ih+{d['px_y']}:{d['px_x']}:{d['px_y']}:black,crop=1080:1920:0:0",              # Layer 12: Pixel shift (no flip)
        f"colorchannelmixer=rr={d['gamma_r']}:gg={d['gamma_g']}:bb={d['gamma_b']}",                          # Layer 13: Per-channel RGB DNA
        "colorspace=bt709",                                                                                    # Layer 14: Colorspace tag alter
        "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",                                # Final:    Resolution lock
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
# GROQ — FACEBOOK CAPTION
# ==========================================

def generate_fb_caption(raw_caption: str) -> str | None:
    if not GROQ_API_KEY: return None
    log("Groq se Facebook caption generate kar raha hoon...", "STEP")

    prompt = (
        f"You are a Facebook Reels Growth Expert for Indian audiences.\n"
        f"Current Date: {datetime.now().strftime('%B %d, %Y')}\n"
        f"TikTok Video Caption: {raw_caption}\n\n"
        f"Generate a VIRAL Facebook Reels caption in Hinglish (Hindi + English mix) for the 2026 algorithm.\n\n"
        f"Rules:\n"
        f"- Line 1: Attention-grabbing hook in Hinglish (curiosity gap, emotional trigger, or shocking fact). Max 100 chars.\n"
        f"- Line 2-4: 2-3 lines of engaging context, storytelling, or value in Hinglish. Conversational tone.\n"
        f"- Line 5: Strong CTA — like karo, share karo, comment mein batao, page follow karo.\n"
        f"- Line 6: EXACTLY 20 trending Facebook hashtags (mix of Hindi niche + viral + broad).\n\n"
        f"IMPORTANT:\n"
        f"- No markdown, no asterisks, no bold text\n"
        f"- No placeholders\n"
        f"- Return valid JSON only\n"
        f"Format: {{\"caption\": \"full caption with hashtags\"}}"
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
        if resp.status_code != 200:
            log(f"Groq error: {resp.text}", "ERR")
        resp.raise_for_status()
        data = json.loads(resp.json()["choices"][0]["message"]["content"])
        return data.get("caption", "")
    except Exception as e:
        log(f"Groq caption fail: {e}", "WARN")
        return None

def get_final_caption(raw_caption: str) -> str:
    ai_caption = generate_fb_caption(raw_caption)
    if ai_caption:
        log("AI caption ready.")
        return ai_caption

    log("Fallback caption use kar raha hoon.", "INFO")
    clean = re.sub(r'#(tiktok|fyp|foryou|foryoupage)\S*', '', raw_caption, flags=re.IGNORECASE)
    clean = re.sub(r'\s+', ' ', clean).strip()

    hooks = [
        "Ye dekhke aankhen khuli ki khuli reh jayengi! 😱",
        "Isko dekho aur batao kya tumhare saath bhi aisa hua hai? 🔥",
        "Yaar ye toh kamal ki cheez hai! 💯",
        "Itna viral kyun ho raha hai ye? Khud dekho! 👇",
        "Sach mein? Ye possible hai? Mind blown! 🤯",
    ]
    hashtags = (
        "#reels #viral #trending #facebook #hinglish "
        "#desi #india #fbreels #indiancreator #hindicontent "
        "#relatable #foryou #viralvideo #trending2026 #reelsviral "
        "#explore #vibes #dailyreels #saveworthy #facebookreels"
    )
    hook = random.choice(hooks)
    body = f"{clean[:120]}\n\nPage follow karo aur notification on karo — roz aisi videos aati hain! 🔔" if clean else ""
    return f"{hook}\n\n{body}\n\n{hashtags}".strip()

# ==========================================
# TOKEN EXCHANGE — SYS USER → PAGE TOKEN
# ==========================================

BASE = "https://graph.facebook.com/v19.0"

def exchange_sys_user_token(sys_token: str, page_id: str) -> str | None:
    """
    System User Token se Page Access Token nikalta hai.
    Requires: pages_read_engagement + pages_manage_posts permission on sys user.
    """
    log("System User Token se Page Access Token exchange kar raha hoon...", "STEP")
    try:
        r = requests.get(
            f"{BASE}/{page_id}",
            params={
                "fields":       "access_token",
                "access_token": sys_token,
            },
            timeout=15,
        )
        data = r.json()
        if "access_token" in data:
            log("Token exchange successful.")
            return data["access_token"]
        log(f"Token exchange fail: {data.get('error', {}).get('message', data)}", "ERR")
        return None
    except Exception as e:
        log(f"Token exchange exception: {e}", "ERR")
        return None

# ==========================================
# FACEBOOK REEL UPLOAD
# ==========================================

def fb_upload_reel(video_path: Path, caption: str) -> str | None:
    """
    Facebook Reel upload — 2 step:
    1. Initialize upload session → upload_url milta hai
    2. Video binary upload → POST to upload_url
    3. Publish
    """
    log("FB Reel upload shuru kar raha hoon...", "STEP")

    # Step 1: Initialize
    init = requests.post(
        f"{BASE}/{FB_PAGE_ID}/video_reels",
        data={
            "upload_phase": "start",
            "access_token": PAGE_ACCESS_TOKEN,
        },
        timeout=30).json()

    if "video_id" not in init:
        log(f"FB init error: {init}", "ERR"); return None

    video_id  = init["video_id"]
    upload_url = init.get("upload_url", "")
    log(f"video_id={video_id}")

    # Step 2: Upload binary
    log("Video binary upload kar raha hoon...", "STEP")
    file_size = video_path.stat().st_size
    with open(video_path, "rb") as f:
        upload_resp = requests.post(
            upload_url,
            headers={
                "Authorization":       f"OAuth {PAGE_ACCESS_TOKEN}",
                "offset":              "0",
                "file_size":           str(file_size),
                "Content-Type":        "application/octet-stream",
            },
            data=f,
            timeout=300)

    if upload_resp.status_code not in (200, 201):
        log(f"Upload fail: {upload_resp.text}", "ERR"); return None
    log("Binary upload ok")

    # Step 3: Publish
    log("FB Reel publish kar raha hoon...", "STEP")
    pub = requests.post(
        f"{BASE}/{FB_PAGE_ID}/video_reels",
        data={
            "upload_phase":    "finish",
            "video_id":        video_id,
            "title":           caption[:100],
            "description":     caption[:2200],
            "video_state":     "PUBLISHED",
            "access_token":    PAGE_ACCESS_TOKEN,
        },
        timeout=30).json()

    if pub.get("success") or "id" in pub:
        log(f"FB Reel published! video_id={video_id}")
        return video_id

    log(f"FB publish error: {pub}", "ERR"); return None

# ==========================================
# MAIN
# ==========================================

def main():
    validate_env()
    setup_dirs()

    # PAGE_ACCESS_TOKEN mein sys user token hai — page token se exchange karo
    global PAGE_ACCESS_TOKEN
    PAGE_ACCESS_TOKEN = exchange_sys_user_token(PAGE_ACCESS_TOKEN, FB_PAGE_ID) or ""
    if not PAGE_ACCESS_TOKEN:
        log("Page token exchange fail — exit.", "ERR")
        sys.exit(1)

    log("══════════════════════════════════════════════")
    log(f"  profiles={TIKTOK_PROFILES} | Page={FB_PAGE_ID}")
    log(f"  watermark={'ON' if WATERMARK_TEXT else 'OFF'}")
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

        # 3. 14-Layer Fingerprint
        p_file = process_video(v_file)
        if not p_file:
            return

        # 4. Facebook Reel upload
        fb_id = fb_upload_reel(p_file, caption)
        if not fb_id:
            return

        # 5. Save history
        save_history(vid_id, fb_id, caption, file_hash)
        log(f"Done! fb_video_id={fb_id}")

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
