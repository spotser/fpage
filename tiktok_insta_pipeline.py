#!/usr/bin/env python3
"""
TikTok Profile → Instagram Reel + Story
- Download: TikWM (primary) → yt-dlp (fallback)
- Anti-Copyright: 11-Layer FFmpeg DNA Fingerprint (audio intact, sirf alter)
- Caption: Groq AI (Instagram SEO) → fallback
- Temp Host: uggu.se
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

TIKTOK_PROFILE_ID = os.environ.get("TIKTOK_PROFILE_ID", "").strip()
IG_ACCESS_TOKEN   = os.environ.get("IG_ACCESS_TOKEN", "").strip()
IG_USER_ID        = os.environ.get("IG_USER_ID", "").strip()
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
    for d in [DOWNLOAD_DIR, PROCESSED_DIR]:
        if d.exists():
            for f in d.glob("*"):
                try: f.unlink()
                except: pass
        d.mkdir(parents=True, exist_ok=True)

def validate_env():
    missing = []
    if not TIKTOK_PROFILE_ID: missing.append("TIKTOK_PROFILE_ID")
    if not IG_ACCESS_TOKEN:   missing.append("IG_ACCESS_TOKEN")
    if not IG_USER_ID:        missing.append("IG_USER_ID")
    if missing:
        log(f"Missing secrets: {', '.join(missing)}", "ERR")
        sys.exit(1)

# ==========================================
# HISTORY / DEDUPE
# ==========================================

def load_history() -> tuple[set, set]:
    if not HISTORY_FILE.exists():
        return set(), set()
    ids, captions = set(), set()
    for line in HISTORY_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 1: ids.add(parts[0])
            if len(parts) >= 4: captions.add(parts[3].lower())
    return ids, captions

def save_history(tiktok_id: str, ig_id: str, caption: str, file_hash: str = ""):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not HISTORY_FILE.exists():
        HISTORY_FILE.write_text("# TikTok → Instagram History\n\n", encoding="utf-8")
    with open(HISTORY_FILE, "a", encoding="utf-8") as f:
        f.write(f"{tiktok_id} | {ig_id} | {ts} | {caption[:80]}\n")
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

def tikwm_list(username: str) -> list:
    log(f"TikWM: @{username} ki videos fetch kar raha hoon...", "STEP")
    videos, cursor = [], 0
    while True:
        try:
            r = requests.post(
                "https://www.tikwm.com/api/user/posts",
                data={"unique_id": username, "count": 20, "cursor": cursor},
                timeout=15)
            d = r.json()
            if d.get("code") != 0:
                log(f"TikWM API error: {d.get('msg')}", "ERR"); break
            items = d["data"].get("videos", [])
            if not items: break
            for v in items:
                videos.append({
                    "id":      str(v["video_id"]),
                    "url":     v["play"],
                    "caption": v.get("title", ""),
                })
            if not d["data"].get("hasMore"): break
            cursor = d["data"]["cursor"]
            time.sleep(0.8)
        except Exception as e:
            log(f"TikWM fetch error: {e}", "ERR"); break
    log(f"TikWM: {len(videos)} videos mili")
    return videos

# ==========================================
# DOWNLOAD — TikWM primary → yt-dlp fallback
# ==========================================

def download_video(video: dict, out: Path) -> bool:
    # Primary: TikWM direct URL
    try:
        r = requests.get(video["url"], stream=True, timeout=30,
                         headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        with open(out, "wb") as f:
            for chunk in r.iter_content(8192): f.write(chunk)
        if out.stat().st_size > 50_000:
            log(f"TikWM download ok: {out.name}"); return True
        out.unlink(missing_ok=True)
    except Exception as e:
        log(f"TikWM download fail: {e}", "WARN")

    # Fallback: yt-dlp
    log("yt-dlp fallback...", "STEP")
    url = f"https://www.tiktok.com/@{TIKTOK_PROFILE_ID.lstrip('@')}/video/{video['id']}"
    result = subprocess.run(
        ["yt-dlp", "-f", "mp4", "-o", str(out),
         "--no-warnings", "--quiet", "--no-playlist", url],
        capture_output=True, timeout=90)
    if out.exists() and out.stat().st_size > 50_000:
        log(f"yt-dlp download ok: {out.name}"); return True
    log("Download fail (dono try ho gaye)", "ERR"); return False

# ==========================================
# 11-LAYER DNA FINGERPRINT
# ==========================================

def process_video(input_path: Path) -> Path | None:
    output_path = PROCESSED_DIR / f"processed_{input_path.name}"
    log("11-Layer DNA Fingerprint apply kar raha hoon...", "STEP")

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
        # Extra video DNA (no flip — text/caption wale videos safe rahen)
        "px_x":       random.randint(1, 3),                    # 1-3px positional shift X
        "px_y":       random.randint(1, 3),                    # 1-3px positional shift Y
        "gamma_r":    round(random.uniform(0.97, 1.03), 3),    # per-channel gamma R
        "gamma_g":    round(random.uniform(0.97, 1.03), 3),    # per-channel gamma G
        "gamma_b":    round(random.uniform(0.97, 1.03), 3),    # per-channel gamma B
        # Extra audio DNA
        "eq_freq":    random.choice([800, 1000, 1200, 1500]),  # EQ center frequency
        "eq_gain":    round(random.uniform(0.5, 1.5), 2),      # subtle EQ boost/cut
        "anoise":     round(random.uniform(0.00005, 0.0001), 6), # imperceptible noise
    }

    # Font setup
    possible_fonts = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "C:\\Windows\\Fonts\\arial.ttf"
    ]
    font_path = next((f for f in possible_fonts if os.path.exists(f)), "")
    font_config = f"fontfile='{font_path.replace(chr(92), '/')}':" if font_path else ""

    # Watermark layer (only if WATERMARK_TEXT secret set hai)
    safe_wm = escape_ffmpeg_text(WATERMARK_TEXT)
    watermark_filter = (
        f"drawtext={font_config}text='{safe_wm}'"
        f":fontcolor=white@0.35:fontsize=32"
        f":x=(w-tw)/2:y=h*0.88"
        f":shadowcolor=black@0.5:shadowx=2:shadowy=2"
    ) if safe_wm else ""

    v_filters = [
        "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",                               # Layer 1:  Standardize
        f"setpts={d['pts']}*PTS",                                                                            # Layer 2:  Speed shift
        f"crop=iw*{d['cw']}:ih*{d['cw']}:iw*{d['cx']}:ih*{d['cx']}",                                       # Layer 3:  Jitter crop
        f"eq=brightness={d['brightness']}:contrast={d['contrast']}:saturation={d['saturation']}:gamma=1.05", # Layer 4:  Color DNA
        f"hue=h={d['hue']}",                                                                                 # Layer 5:  Hue shift
        f"rotate={d['rotate']}:fillcolor=black:ow=iw:oh=ih",                                                # Layer 6:  Micro-tilt
        "vignette=PI/4+0.1*sin(t)",                                                                          # Layer 7:  Dynamic vignette
        "noise=c0s=3:c0f=t+u",                                                                               # Layer 8:  Film grain
        "unsharp=3:3:1.2:3:3:0.0",                                                                          # Layer 9:  Sharpness
        f"fps={d['fps']}",                                                                                   # Layer 10: FPS shift
        watermark_filter,                                                                                     # Layer 11: Watermark (optional)
        # Extra DNA layers (no flip)
        f"pad=iw+{d['px_x']}:ih+{d['px_y']}:{d['px_x']}:{d['px_y']}:black,crop=1080:1920:0:0",             # Layer 12: Pixel shift (no mirror)
        f"colorchannelmixer=rr={d['gamma_r']}:gg={d['gamma_g']}:bb={d['gamma_b']}",                         # Layer 13: Per-channel color DNA
        "colorspace=bt709",                                                                                   # Layer 14: Colorspace tag alter
        "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",                               # Final:    Resolution lock
    ]
    vf = ",".join(f for f in v_filters if f)

    # Audio: pitch + tempo + EQ + imperceptible noise + sample rate bounce
    af = ",".join([
        f"asetrate=44100*{d['pitch']}",          # pitch shift
        f"atempo={d['pts']}/{d['pitch']}",        # tempo correct
        "aresample=48000",                        # bounce 44k→48k (waveform alter)
        f"equalizer=f={d['eq_freq']}:t=o:w=200:g={d['eq_gain']}",  # EQ fingerprint
        f"volume=1.0+{d['anoise']}",              # imperceptible volume jitter
        "aresample=44100",                        # back to 44.1k
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
# UGGU.SE — TEMP HOST
# ==========================================

def upload_uggu(path: Path) -> str:
    log("uggu.se pe upload kar raha hoon...", "STEP")
    with open(path, "rb") as f:
        r = requests.post(
            "https://uguu.se/upload",
            files={"files[]": (path.name, f, "video/mp4")},
            timeout=120)
    r.raise_for_status()
    data = r.json()
    url = data["files"][0]["url"]
    log(f"uggu.se ok: {url}")
    return url

# ==========================================
# GROQ — INSTAGRAM CAPTION
# ==========================================

def generate_ig_caption(raw_caption: str) -> str | None:
    if not GROQ_API_KEY: return None
    log("Groq se Instagram caption generate kar raha hoon...", "STEP")

    prompt = (
        f"You are an Instagram Reels Growth Expert for Indian audiences.\n"
        f"Current Date: {datetime.now().strftime('%B %d, %Y')}\n"
        f"TikTok Video Caption: {raw_caption}\n\n"
        f"Generate a VIRAL Instagram Reels caption in Hinglish (Hindi + English mix) for the 2026 algorithm.\n\n"
        f"Rules:\n"
        f"- Line 1: Attention-grabbing hook in Hinglish (curiosity gap, emotional trigger, or shocking fact). Max 100 chars.\n"
        f"- Line 2-4: 2-3 lines of engaging context, storytelling, or value in Hinglish. Keep it conversational.\n"
        f"- Line 5: Strong CTA — follow karo, save karo, share karo, or comment mein batao.\n"
        f"- Line 6: EXACTLY 25 trending Instagram hashtags (mix of Hindi niche + viral + broad). "
        f"Include: #reels #viral #trending #explore #hinglish and niche-relevant tags.\n\n"
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
    # AI first
    ai_caption = generate_ig_caption(raw_caption)
    if ai_caption:
        log("AI caption ready.")
        return ai_caption

    # Fallback
    log("Fallback caption use kar raha hoon.", "INFO")
    clean = re.sub(r'#(tiktok|fyp|foryou|foryoupage)\S*', '', raw_caption, flags=re.IGNORECASE)
    clean = re.sub(r'\s+', ' ', clean).strip()

    hooks = [
        "Ye dekhke aankhen khuli ki khuli reh jayengi! 😱",
        "Isko dekho aur batao kya tumhare saath bhi aisa hua hai? 🔥",
        "Yaar ye toh kamal ki cheez hai, save karo baad mein dekhna! 💯",
        "Itna viral kyun ho raha hai ye? Khud dekho! 👇",
        "Sach mein? Ye possible hai? Mind blown! 🤯",
    ]
    hashtags = (
        "#reels #viral #trending #explore #hinglish #desi #india "
        "#instareels #reelsindia #reelsviral #explorepage #viralreels "
        "#indiancreator #hindicontent #relatable #foryou #fyp "
        "#reelsinstagram #viralvideo #instaviral #trending2026 "
        "#dailyreels #reelitfeelit #vibes #saveworthy"
    )
    hook = random.choice(hooks)
    body = f"{clean[:120]}\n\nFollow karo aur notification on karo — roz aisi videos aati hain! 🔔" if clean else ""
    return f"{hook}\n\n{body}\n\n{hashtags}".strip()

# ==========================================
# INSTAGRAM — REEL PUBLISH
# ==========================================

BASE = "https://graph.facebook.com/v19.0"

def ig_upload_reel(video_url: str, caption: str) -> str | None:
    log("IG Reel container create kar raha hoon...", "STEP")
    r = requests.post(f"{BASE}/{IG_USER_ID}/media", data={
        "media_type":    "REELS",
        "video_url":     video_url,
        "caption":       caption[:2200],
        "share_to_feed": "true",
        "access_token":  IG_ACCESS_TOKEN,
    }, timeout=30).json()

    if "id" not in r:
        log(f"Container error: {r}", "ERR"); return None

    cid = r["id"]
    log(f"container_id={cid} — processing wait...")

    for i in range(30):
        time.sleep(6)
        s = requests.get(f"{BASE}/{cid}", params={
            "fields": "status_code,status",
            "access_token": IG_ACCESS_TOKEN
        }, timeout=15).json()
        status = s.get("status_code", "UNKNOWN")
        log(f"Processing: {status} ({i+1}/30)")
        if status == "FINISHED": break
        if status in ("ERROR", "EXPIRED"):
            log(f"Processing fail: {s}", "ERR"); return None
    else:
        log("Timeout 3min", "ERR"); return None

    pub = requests.post(f"{BASE}/{IG_USER_ID}/media_publish", data={
        "creation_id":  cid,
        "access_token": IG_ACCESS_TOKEN,
    }, timeout=30).json()

    if "id" not in pub:
        log(f"Publish error: {pub}", "ERR"); return None

    media_id = pub["id"]
    log(f"Reel published! media_id={media_id}")
    return media_id

# ==========================================
# INSTAGRAM — STORY SHARE
# ==========================================

def ig_share_story(media_id: str) -> bool:
    log("Story share kar raha hoon...", "STEP")
    r = requests.post(f"{BASE}/{IG_USER_ID}/media", data={
        "media_type":      "STORIES",
        "source_type":     "SHARE_FROM_FEED",
        "source_media_id": media_id,
        "access_token":    IG_ACCESS_TOKEN,
    }, timeout=30).json()

    if "id" not in r:
        log(f"Story container error: {r}", "ERR"); return False

    time.sleep(4)
    pub = requests.post(f"{BASE}/{IG_USER_ID}/media_publish", data={
        "creation_id":  r["id"],
        "access_token": IG_ACCESS_TOKEN,
    }, timeout=30).json()

    if "id" in pub:
        log(f"Story live! id={pub['id']}"); return True
    log(f"Story publish error: {pub}", "ERR"); return False

# ==========================================
# MAIN
# ==========================================

def main():
    validate_env()
    setup_dirs()

    history_ids, history_captions = load_history()

    log("══════════════════════════════════════════════")
    log(f"  @{TIKTOK_PROFILE_ID} | watermark={'ON' if WATERMARK_TEXT else 'OFF'}")
    log(f"  history={len(history_ids)} videos")
    log("══════════════════════════════════════════════")

    # Fetch all videos from profile
    all_vids = tikwm_list(TIKTOK_PROFILE_ID)
    new_vids = [v for v in all_vids if v["id"] not in history_ids]

    if not new_vids:
        log("Sab videos already processed hain."); return

    log(f"{len(new_vids)} naye videos milein — ek ek karke process hoga")

    for idx, video in enumerate(new_vids):
        vid_id      = video["id"]
        raw_caption = video["caption"]
        log(f"\n▶ [{idx+1}/{len(new_vids)}] id={vid_id}")
        log(f"  caption: {raw_caption[:80]}")

        v_file = DOWNLOAD_DIR / f"{vid_id}.mp4"
        p_file = None

        try:
            # 1. Download
            if not download_video(video, v_file):
                continue

            # 2. Hash dedupe (same content, alag ID)
            file_hash = get_file_hash(v_file)
            if is_duplicate_hash(file_hash):
                log("Duplicate content (hash match) — skip", "WARN")
                v_file.unlink(missing_ok=True); continue

            # 3. Caption
            caption = get_final_caption(raw_caption)

            # 4. 11-Layer Fingerprint
            p_file = process_video(v_file)
            if not p_file:
                continue

            # 5. uggu.se upload
            pub_url = upload_uggu(p_file)

            # 6. Instagram Reel
            media_id = ig_upload_reel(pub_url, caption)
            if not media_id:
                continue

            # 7. Story share
            ig_share_story(media_id)

            # 8. Save history
            save_history(vid_id, media_id, caption, file_hash)
            log(f"✅ Done! [{idx+1}/{len(new_vids)}]")
            break  # per run sirf 1 video

        except Exception as e:
            log(f"Video {vid_id} fail: {e}", "ERR")
        finally:
            for f in [v_file, p_file]:
                if f and Path(f).exists():
                    try: Path(f).unlink()
                    except: pass

    log("\n══ PIPELINE COMPLETE ══")

if __name__ == "__main__":
    main()
