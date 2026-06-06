#!/usr/bin/env python3
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PSYCHOLOGY SECRETS REEL BOT v5
  "Mindset Factory" Branded | Film Scratch + Grain Effect
  - Branded pill top-center "Mindset Factory"
  - @MindsetFactory footer watermark
  - Film scratch / grain / white flicker overlay
  - Music: FreeToUse API (https://api.freetouse.com/v3, no key needed)
  - No numbered labels (label text only)
  - FB Reel + Story auto-share
  - No fade-in (heading visible from frame 0)
  - Fade-out only at end (start+end fade, heading visible in thumbnail)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os, sys, json, random, requests, datetime, re, tempfile, wave, time
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ============================================================
# 1. CONFIGURATION
# ============================================================
GROQ_API_KEY   = os.environ["GROQ_API_KEY"]
PAGE_OR_IG_ID     = os.environ["PAGE_OR_IG_ID"]
PAGE_ACCESS_TOKEN  = os.environ["PAGE_ACCESS_TOKEN"]

GROQ_MODEL     = "llama-3.1-8b-instant"
FB_API_VERSION = "v19.0"

W, H           = 1080, 1920
REEL_DURATION  = 14
FPS            = 24

FONT_DIR       = Path("fonts")
OUTPUT_DIR     = Path("output_reels")
AUDIO_DIR      = Path("audio_pool")
OUTPUT_DIR.mkdir(exist_ok=True)
AUDIO_DIR.mkdir(exist_ok=True)

F_BOLD         = FONT_DIR / "Poppins-Bold.ttf"
F_SEMIBOLD     = FONT_DIR / "Poppins-SemiBold.ttf"
F_REGULAR      = FONT_DIR / "Poppins-Regular.ttf"

PAGE_NAME      = os.environ.get("PAGE_NAME", "Psychology Daily")
BRAND_NAME     = os.environ.get("BRAND_NAME", "Mindset Factory")
BRAND_HANDLE   = os.environ.get("BRAND_HANDLE", "@MindsetFactory")

# Local audio folder — MP3/WAV files rakh do yahan
# Structure (optional subfolders by mood, ya sab ek hi folder mein):
#   audio_pool/dark/track1.mp3
#   audio_pool/lofi/track2.mp3
#   audio_pool/track3.mp3   ← flat bhi chalega
AUDIO_SUBFOLDERS = {
    "dark ambient":           ["dark", "ambient"],
    "mysterious ambient":     ["ambient", "mysterious"],
    "inspiring motivational": ["motivational", "inspiring"],
    "calm ambient":           ["ambient", "calm"],
    "dark cinematic":         ["dark", "cinematic"],
    "emotional ambient":      ["ambient", "emotional"],
    "lofi chill":             ["lofi", "chill"],
    "romantic soft":          ["romantic", "soft"],
    "melancholic ambient":    ["ambient", "melancholic"],
    "motivational upbeat":    ["motivational", "upbeat"],
    "calm meditation":        ["meditation", "calm"],
    "dark tension":           ["dark", "tension"],
    "powerful motivational":  ["motivational", "powerful"],
    "lofi peaceful":          ["lofi", "peaceful"],
    "dark mysterious":        ["dark", "mysterious"],
    "sad ambient":            ["ambient", "sad"],
    "cinematic ambient":      ["cinematic", "ambient"],
    "tension dark":           ["dark", "tension"],
    "upbeat positive":        ["upbeat", "positive"],
}

# ============================================================
# 2. TOPICS
# ============================================================
TOPICS = [
    {
        "key":        "PSYCHOLOGY",
        "heading":    "Human Psychology : Dark Secrets",
        "label_type": "Dark Secret",
        "music_query": "dark ambient",
        "hashtags":   ["psychology", "humanpsychology", "psychologyfacts", "mindscience", "psychologyofsuccess"],
    },
    {
        "key":        "HUMAN BEHAVIOR",
        "heading":    "Human Behavior : Hidden Truths",
        "label_type": "Hidden Truth",
        "music_query": "mysterious ambient",
        "hashtags":   ["humanbehavior", "behaviorscience", "humanmind", "peoplewatch", "behaviorpatterns"],
    },
    {
        "key":        "MINDSET",
        "heading":    "Mindset : Dark Secrets",
        "label_type": "Power Mindset",
        "music_query": "inspiring motivational",
        "hashtags":   ["mindset", "growthmindset", "mindsetshift", "mindsetcoach", "mindsetmatters"],
    },
    {
        "key":        "SELF AWARENESS",
        "heading":    "Self Awareness : Hidden Facts",
        "label_type": "Inner Truth",
        "music_query": "calm ambient",
        "hashtags":   ["selfawareness", "knowyourself", "selfgrowth", "innerwork", "selfmastery"],
    },
    {
        "key":        "DARK TRUTHS",
        "heading":    "Life : Dark Truths",
        "label_type": "Raw Truth",
        "music_query": "dark cinematic",
        "hashtags":   ["darktruth", "hardtruths", "rawtruth", "truthbombs", "realtalk"],
    },
    {
        "key":        "EMOTIONAL INTELLIGENCE",
        "heading":    "Emotional Intelligence : Secrets",
        "label_type": "EQ Insight",
        "music_query": "emotional ambient",
        "hashtags":   ["emotionalintelligence", "eq", "emotionalawareness", "emotionalgrowth", "emotionalhealth"],
    },
    {
        "key":        "SOCIAL SKILLS",
        "heading":    "Social Skills : Hidden Secrets",
        "label_type": "Social Power",
        "music_query": "lofi chill",
        "hashtags":   ["socialskills", "socialintelligence", "peopleskills", "communication", "socialpower"],
    },
    {
        "key":        "RELATIONSHIPS",
        "heading":    "Relationships : Dark Secrets",
        "label_type": "Love Truth",
        "music_query": "romantic soft",
        "hashtags":   ["relationships", "relationshipadvice", "lovepsychology", "relationshipfacts", "truelove"],
    },
    {
        "key":        "LONELINESS",
        "heading":    "Loneliness : Hidden Truths",
        "label_type": "Lone Truth",
        "music_query": "melancholic ambient",
        "hashtags":   ["loneliness", "alone", "mentalhealth", "innerpeace", "solitude"],
    },
    {
        "key":        "SUCCESS MINDSET",
        "heading":    "Success Mindset : Dark Secrets",
        "label_type": "Success Law",
        "music_query": "motivational upbeat",
        "hashtags":   ["success", "successmindset", "successhabits", "successquotes", "buildingsuccess"],
    },
    {
        "key":        "OVERTHINKING",
        "heading":    "Overthinking : Dark Secrets",
        "label_type": "Mind Trap",
        "music_query": "calm meditation",
        "hashtags":   ["overthinking", "anxietytips", "mentalhealthawareness", "overthinker", "quietmind"],
    },
    {
        "key":        "MANIPULATION",
        "heading":    "Manipulation : Hidden Signs",
        "label_type": "Red Flag",
        "music_query": "dark tension",
        "hashtags":   ["manipulation", "toxicpeople", "narcissist", "gaslighting", "protectyourenergy"],
    },
    {
        "key":        "CONFIDENCE",
        "heading":    "Confidence : Dark Secrets",
        "label_type": "Alpha Truth",
        "music_query": "powerful motivational",
        "hashtags":   ["confidence", "selfconfidence", "selfesteem", "believeinyourself", "mindsetcoach"],
    },
    {
        "key":        "INTROVERT",
        "heading":    "Introvert : Hidden Truths",
        "label_type": "Quiet Fact",
        "music_query": "lofi peaceful",
        "hashtags":   ["introvert", "introvertlife", "introvertproblems", "quietpeople", "introvertedmind"],
    },
    {
        "key":        "TOXIC PEOPLE",
        "heading":    "Toxic People : Warning Signs",
        "label_type": "Warning Sign",
        "music_query": "dark mysterious",
        "hashtags":   ["toxicpeople", "toxicrelationship", "narcissist", "boundaries", "selfrespect"],
    },
    {
        "key":        "GRIEF",
        "heading":    "Grief : Hidden Truths",
        "label_type": "Healing Truth",
        "music_query": "sad ambient",
        "hashtags":   ["grief", "healing", "mentalhealth", "emotionalhealing", "innerpeace"],
    },
    {
        "key":        "BODY LANGUAGE",
        "heading":    "Body Language : Hidden Secrets",
        "label_type": "Body Signal",
        "music_query": "lofi chill",
        "hashtags":   ["bodylanguage", "nonverbalcommunication", "readingpeople", "socialpsychology", "communication"],
    },
    {
        "key":        "MEMORY",
        "heading":    "Memory : Dark Secrets",
        "label_type": "Brain Fact",
        "music_query": "cinematic ambient",
        "hashtags":   ["memory", "brainscience", "neuroscience", "memorypower", "learnfaster"],
    },
    {
        "key":        "FEAR",
        "heading":    "Fear : Hidden Truths",
        "label_type": "Fear Factor",
        "music_query": "tension dark",
        "hashtags":   ["fear", "overcomingfear", "mentalstrength", "courage", "fearless"],
    },
    {
        "key":        "HAPPINESS",
        "heading":    "Happiness : Dark Secrets",
        "label_type": "Joy Fact",
        "music_query": "upbeat positive",
        "hashtags":   ["happiness", "happinessis", "joyful", "positivemind", "happinessquotes"],
    },
]

# ============================================================
# 3. PREMIUM PAPER THEMES
# ============================================================
PAPER_THEMES = {
    "PARCHMENT": {
        "bg_top":    (245, 234, 214),
        "bg_bot":    (228, 215, 192),
        "title":     (139,  26,  26),
        "label":     ( 61,  43,  31),
        "body":      ( 74,  55,  40),
        "divider":   (196, 168, 130),
        "border":    (180, 148, 110),
        "cta":       (138, 112,  96),
        "noise":     10,
        "style":     "parchment",
        "vignette":  True,
        "pill_bg":   (139,  26,  26),
        "pill_fg":   (255, 245, 230),
    },
    "LINEN": {
        "bg_top":    (237, 232, 223),
        "bg_bot":    (220, 214, 202),
        "title":     (192,  57,  43),
        "label":     ( 44,  44,  44),
        "body":      ( 58,  58,  58),
        "divider":   (181, 168, 152),
        "border":    (160, 148, 132),
        "cta":       (122, 112, 101),
        "noise":     7,
        "style":     "linen",
        "vignette":  True,
        "pill_bg":   (192,  57,  43),
        "pill_fg":   (255, 252, 248),
    },
    "NEWSPAPER": {
        "bg_top":    (242, 237, 219),
        "bg_bot":    (222, 216, 194),
        "title":     (153,  17,  17),
        "label":     ( 26,  26,  26),
        "body":      ( 42,  42,  42),
        "divider":   (200, 188, 152),
        "border":    (170, 155, 120),
        "cta":       (128,  96,  80),
        "noise":     16,
        "style":     "newspaper",
        "vignette":  True,
        "pill_bg":   (153,  17,  17),
        "pill_fg":   (255, 250, 235),
    },
    "DUSTY ROSE": {
        "bg_top":    (240, 232, 228),
        "bg_bot":    (220, 208, 202),
        "title":     (160,  40,  30),
        "label":     ( 46,  30,  26),
        "body":      ( 62,  46,  42),
        "divider":   (200, 172, 164),
        "border":    (178, 148, 140),
        "cta":       (144, 112, 104),
        "noise":     9,
        "style":     "dustyrose",
        "vignette":  True,
        "pill_bg":   (160,  40,  30),
        "pill_fg":   (255, 245, 240),
    },
    "COFFEE": {
        "bg_top":    ( 38,  28,  20),
        "bg_bot":    ( 52,  38,  26),
        "title":     (232, 160,  80),
        "label":     (240, 216, 176),
        "body":      (208, 192, 160),
        "divider":   (106,  80,  64),
        "border":    (130, 100,  72),
        "cta":       (160, 128,  96),
        "noise":     5,
        "style":     "coffee",
        "vignette":  True,
        "pill_bg":   (232, 160,  80),
        "pill_fg":   ( 30,  20,  12),
    },
}

# ============================================================
# 4. FONT HELPERS
# ============================================================
def fnt(path, size):
    try:
        return ImageFont.truetype(str(path), size)
    except Exception:
        try:
            return ImageFont.truetype(str(F_BOLD), size)
        except Exception:
            return ImageFont.load_default()

def text_w(draw, font, text):
    bb = draw.textbbox((0, 0), text, font=font)
    return bb[2] - bb[0]

def text_h(draw, font, text):
    bb = draw.textbbox((0, 0), text, font=font)
    return bb[3] - bb[1]

# ============================================================
# 5. PAPER TEXTURE HELPERS
# ============================================================
def paper_gradient(top, bot):
    arr = np.zeros((H, W, 3), dtype=np.float32)
    for ch in range(3):
        arr[:, :, ch] = np.linspace(top[ch], bot[ch], H)[:, np.newaxis]
    return Image.fromarray(arr.astype(np.uint8))

def add_paper_noise(img, intensity=10):
    arr = np.array(img).astype(np.float32)
    noise = np.random.normal(0, intensity, arr.shape)
    return Image.fromarray(np.clip(arr + noise, 0, 255).astype(np.uint8))

def add_linen_lines(img, color):
    draw = ImageDraw.Draw(img)
    r, g, b = color
    rng = np.random.default_rng(42)
    for y in range(0, H, 4):
        v = int(rng.integers(0, 14))
        draw.line([(0, y), (W, y)],
                  fill=(max(0, r - 8 + v), max(0, g - 8 + v), max(0, b - 8 + v)), width=1)
    return img

def add_vignette(img):
    arr = np.array(img).astype(np.float32)
    vy = np.linspace(0, 1, H)
    vx = np.linspace(0, 1, W)
    yy, xx = np.meshgrid(vy, vx, indexing='ij')
    dist = np.sqrt((yy - 0.5) ** 2 + (xx - 0.5) ** 2)
    vign = 1.0 - np.clip((dist - 0.3) / 0.5, 0, 1) * 0.45
    for ch in range(3):
        arr[:, :, ch] *= vign
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

def add_decorative_border(draw, color, padding=38):
    c = color
    draw.rectangle([padding, padding, W - padding, H - padding], outline=c, width=2)
    draw.rectangle([padding + 10, padding + 10, W - padding - 10, H - padding - 10], outline=c, width=1)
    sz = 14
    for cx, cy in [
        (padding, padding),
        (W - padding - sz, padding),
        (padding, H - padding - sz),
        (W - padding - sz, H - padding - sz),
    ]:
        draw.rectangle([cx, cy, cx + sz, cy + sz], outline=c, width=2)

# ============================================================
# 6. BRANDED PILL — "Mindset Factory" top center
# ============================================================
def draw_brand_pill(draw, img, T):
    """Draw a pill-shaped branded badge at the top center."""
    pill_font = fnt(F_BOLD, 38)
    label = BRAND_NAME.upper()

    # Exact bounding box from textbbox
    bb = draw.textbbox((0, 0), label, font=pill_font)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    # offset = how far the glyph top is from origin (descent correction)
    t_offset_y = bb[1]  # usually small positive number

    pad_x, pad_y = 44, 22
    pill_w = tw + pad_x * 2
    pill_h = th + pad_y * 2

    pill_x = (W - pill_w) // 2
    pill_y = 70

    r = pill_h // 2
    bg = T["pill_bg"]
    fg = T["pill_fg"]

    draw.rounded_rectangle(
        [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
        radius=r, fill=bg
    )
    draw.rounded_rectangle(
        [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
        radius=r, outline=fg, width=2
    )

    # Perfect centre: pill centre minus half text height, minus glyph offset
    tx = pill_x + (pill_w - tw) // 2 - bb[0]
    ty = pill_y + (pill_h - th) // 2 - t_offset_y
    draw.text((tx, ty), label, font=pill_font, fill=fg)

    return pill_y + pill_h

# ============================================================
# 7. AUTO FIT TEXT
# ============================================================
def auto_fit_text(draw, text, font_path, max_size, min_size, max_w):
    for size in range(max_size, min_size - 1, -1):
        font = fnt(font_path, size)
        lines = []
        current = ""
        for word in text.split():
            test = (current + " " + word).strip()
            if text_w(draw, font, test) <= max_w:
                current = test
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        if len(lines) <= 2:
            return font, lines
    font = fnt(font_path, min_size)
    lines = []
    current = ""
    for word in text.split():
        test = (current + " " + word).strip()
        if text_w(draw, font, test) <= max_w:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return font, lines[:2]

# Global: typing animation ke liye secret block positions
# render_reel_image() ise populate karega
_SECRET_BLOCKS = []

# ============================================================
# 8. RENDER STATIC IMAGE
#    - Branded pill top
#    - No numbered labels (label text only)
#    - @MindsetFactory footer watermark
# ============================================================
def render_reel_image(topic, secrets, theme_name, heading=None):
    global _SECRET_BLOCKS
    _SECRET_BLOCKS = []

    T = PAPER_THEMES[theme_name]
    np.random.seed(sum(ord(c) for c in theme_name))

    img = paper_gradient(T["bg_top"], T["bg_bot"])
    img = add_paper_noise(img, T["noise"])
    if T["style"] == "linen":
        img = add_linen_lines(img, T["bg_top"])
    if T.get("vignette"):
        img = add_vignette(img)

    draw = ImageDraw.Draw(img)
    add_decorative_border(draw, T["border"], padding=36)

    # Branded pill at top
    pill_bottom = draw_brand_pill(draw, img, T)

    font_label  = fnt(F_SEMIBOLD, 46)
    font_cta    = fnt(F_REGULAR,  36)
    font_handle = fnt(F_BOLD,     34)

    MARGIN  = 72
    CONTENT = W - MARGIN * 2
    BODY_MAX_SIZE  = 42
    BODY_MIN_SIZE  = 26
    LINE_H_LABEL   = 58
    GAP_AFTER_LABEL = 8
    GAP_AFTER_BLOCK = 32
    DIVIDER_PAD    = 40

    fitted = []
    for s in secrets:
        body_font, lines = auto_fit_text(
            draw, s["text"], F_REGULAR,
            BODY_MAX_SIZE, BODY_MIN_SIZE, CONTENT
        )
        line_h = int(text_h(draw, body_font, "Ag") * 1.25)
        fitted.append((body_font, lines, line_h))

    heading_text = heading if heading else topic["heading"]
    h_font, h_lines = auto_fit_text(draw, heading_text, F_BOLD, 68, 44, CONTENT)
    heading_h = sum(text_h(draw, h_font, ln) + 10 for ln in h_lines) + 6
    div_h     = 3 + DIVIDER_PAD * 2
    blocks_h  = 0
    for (body_font, lines, line_h) in fitted:
        blocks_h += LINE_H_LABEL + GAP_AFTER_LABEL
        blocks_h += len(lines) * line_h
        blocks_h += GAP_AFTER_BLOCK
    bot_div_h = 3 + 24 + text_h(draw, font_cta, "x") + 20
    handle_h  = text_h(draw, font_handle, BRAND_HANDLE) + 16

    total_h = heading_h + div_h + blocks_h + bot_div_h + handle_h

    SAFE_TOP = pill_bottom + 40
    SAFE_BOT = 1820
    ZONE = SAFE_BOT - SAFE_TOP
    y = SAFE_TOP + max(0, (ZONE - total_h) // 2)

    # ── Heading ──
    for h_line in h_lines:
        lw = text_w(draw, h_font, h_line)
        draw.text(((W - lw) // 2, y), h_line, font=h_font, fill=T["title"])
        y += text_h(draw, h_font, h_line) + 10
    y += 6  # small extra gap before divider

    # ── Top divider ──
    y += DIVIDER_PAD // 2
    draw.line([(MARGIN, y), (W - MARGIN, y)], fill=T["divider"], width=3)
    mid = W // 2
    draw.polygon([(mid - 8, y), (mid, y - 8), (mid + 8, y), (mid, y + 8)], fill=T["divider"])
    y += DIVIDER_PAD // 2 + 3

    # ── Secrets — draw on full image AND save positions for animation ──
    for i, s in enumerate(secrets):
        body_font, lines, line_h = fitted[i]

        label_text = s["label"]
        label_text = re.sub(r"^\s*#?\d+\s*[.:\-\)]\s*", "", label_text).strip()

        label_xy = (MARGIN, y)
        draw.text(label_xy, label_text, font=font_label, fill=T["label"])
        y += LINE_H_LABEL + GAP_AFTER_LABEL

        body_xy = (MARGIN, y)
        for line in lines:
            draw.text((MARGIN, y), line, font=body_font, fill=T["body"])
            y += line_h

        # Save block info for typing animation
        _SECRET_BLOCKS.append({
            "label":       label_text,
            "text":        s["text"],
            "label_xy":    label_xy,
            "label_font":  font_label,
            "label_color": T["label"],
            "body_xy":     body_xy,
            "body_font":   body_font,
            "body_color":  T["body"],
            "body_lines":  lines,
            "line_h":      line_h,
        })

        y += GAP_AFTER_BLOCK

    # ── Bottom divider ──
    y += 8
    draw.line([(MARGIN, y), (W - MARGIN, y)], fill=T["divider"], width=2)
    y += 24

    # ── CTA ──
    cta = f"Follow for daily {topic['key'].lower()} facts"
    cw  = text_w(draw, font_cta, cta)
    draw.text(((W - cw) // 2, y), cta, font=font_cta, fill=T["cta"])
    y += text_h(draw, font_cta, cta) + 20

    # ── @MindsetFactory handle ──
    hw2 = text_w(draw, font_handle, BRAND_HANDLE)
    draw.text(((W - hw2) // 2, y), BRAND_HANDLE, font=font_handle, fill=T["divider"])

    return img


def render_bg_only(topic, secrets, theme_name, heading=None):
    """
    Same as render_reel_image but secrets text blank — sirf bg, pill,
    heading, dividers, CTA, handle draw hote hain.
    Typing animation iske upar per-frame text composite karti hai.
    """
    T = PAPER_THEMES[theme_name]
    np.random.seed(sum(ord(c) for c in theme_name))

    img = paper_gradient(T["bg_top"], T["bg_bot"])
    img = add_paper_noise(img, T["noise"])
    if T["style"] == "linen":
        img = add_linen_lines(img, T["bg_top"])
    if T.get("vignette"):
        img = add_vignette(img)

    draw = ImageDraw.Draw(img)
    add_decorative_border(draw, T["border"], padding=36)
    pill_bottom = draw_brand_pill(draw, img, T)

    font_label  = fnt(F_SEMIBOLD, 46)
    font_cta    = fnt(F_REGULAR,  36)
    font_handle = fnt(F_BOLD,     34)

    MARGIN  = 72
    CONTENT = W - MARGIN * 2
    BODY_MAX_SIZE  = 42
    BODY_MIN_SIZE  = 26
    LINE_H_LABEL   = 58
    GAP_AFTER_LABEL = 8
    GAP_AFTER_BLOCK = 32
    DIVIDER_PAD    = 40

    fitted = []
    for s in secrets:
        body_font, lines = auto_fit_text(
            draw, s["text"], F_REGULAR,
            BODY_MAX_SIZE, BODY_MIN_SIZE, CONTENT
        )
        line_h = int(text_h(draw, body_font, "Ag") * 1.25)
        fitted.append((body_font, lines, line_h))

    heading_text = heading if heading else topic["heading"]
    h_font, h_lines = auto_fit_text(draw, heading_text, F_BOLD, 68, 44, CONTENT)
    heading_h = sum(text_h(draw, h_font, ln) + 10 for ln in h_lines) + 6
    div_h     = 3 + DIVIDER_PAD * 2
    blocks_h  = 0
    for (body_font, lines, line_h) in fitted:
        blocks_h += LINE_H_LABEL + GAP_AFTER_LABEL
        blocks_h += len(lines) * line_h
        blocks_h += GAP_AFTER_BLOCK
    bot_div_h = 3 + 24 + text_h(draw, font_cta, "x") + 20
    handle_h  = text_h(draw, font_handle, BRAND_HANDLE) + 16
    total_h   = heading_h + div_h + blocks_h + bot_div_h + handle_h

    SAFE_TOP = pill_bottom + 40
    SAFE_BOT = 1820
    ZONE     = SAFE_BOT - SAFE_TOP
    y        = SAFE_TOP + max(0, (ZONE - total_h) // 2)

    # Heading — frame 0 se visible, multi-line centered
    for h_line in h_lines:
        lw = text_w(draw, h_font, h_line)
        draw.text(((W - lw) // 2, y), h_line, font=h_font, fill=T["title"])
        y += text_h(draw, h_font, h_line) + 10
    y += 6  # small extra gap before divider

    # Top divider
    y += DIVIDER_PAD // 2
    draw.line([(MARGIN, y), (W - MARGIN, y)], fill=T["divider"], width=3)
    mid = W // 2
    draw.polygon([(mid - 8, y), (mid, y - 8), (mid + 8, y), (mid, y + 8)], fill=T["divider"])
    y += DIVIDER_PAD // 2 + 3

    # Secrets area — skip (typing animation draws here)
    for i, _ in enumerate(secrets):
        _, lines, line_h = fitted[i]
        y += LINE_H_LABEL + GAP_AFTER_LABEL
        y += len(lines) * line_h
        y += GAP_AFTER_BLOCK

    # Bottom divider
    y += 8
    draw.line([(MARGIN, y), (W - MARGIN, y)], fill=T["divider"], width=2)
    y += 24

    # CTA
    cta = f"Follow for daily {topic['key'].lower()} facts"
    cw  = text_w(draw, font_cta, cta)
    draw.text(((W - cw) // 2, y), cta, font=font_cta, fill=T["cta"])
    y += text_h(draw, font_cta, cta) + 20

    # Handle
    hw2 = text_w(draw, font_handle, BRAND_HANDLE)
    draw.text(((W - hw2) // 2, y), BRAND_HANDLE, font=font_handle, fill=T["divider"])

    return img


# ============================================================
# 9. FILM SCRATCH / GRAIN / FLICKER EFFECT
#    Real film aesthetic: scratch lines, grain, white flicker
# ============================================================
def build_film_overlays(total_frames, fps):
    """
    Pre-build per-frame film effects:
    - Film grain (random per frame)
    - Scratch lines (vertical bright lines, random position)
    - White flicker frames (brief bright flash)
    Returns dict of arrays indexed by frame number.
    """
    rng = np.random.default_rng(42)

    # Grain: subtle random noise per frame
    grain_intensity = 18  # higher = more gritty

    # Scratch lines: appear randomly, linger 2-5 frames
    scratch_schedule = {}  # frame_idx -> list of (x, width, brightness)
    frame = 0
    while frame < total_frames:
        if rng.random() < 0.08:  # ~8% chance per frame to start a scratch
            scratch_x = int(rng.integers(80, W - 80))
            scratch_w = int(rng.integers(1, 4))
            scratch_bright = float(rng.uniform(180, 255))
            scratch_duration = int(rng.integers(2, 6))
            for f in range(frame, min(frame + scratch_duration, total_frames)):
                scratch_schedule.setdefault(f, []).append(
                    (scratch_x, scratch_w, scratch_bright)
                )
        frame += 1

    # White flicker: sudden brightness spike (1-2 frames)
    flicker_schedule = set()
    for f in range(0, total_frames, int(fps * 1.8)):
        if rng.random() < 0.25:
            flicker_schedule.add(f)
            if rng.random() < 0.4:
                flicker_schedule.add(min(f + 1, total_frames - 1))

    # Brightness variation (subtle CRT pulse, NOT a slow fade-in)
    brightness = rng.uniform(0.97, 1.00, total_frames)
    for f in range(0, total_frames, int(fps * 2.5)):
        brightness[f] = rng.uniform(0.91, 0.96)

    # Scanline mask (static, computed once)
    scanline_mask = np.ones((H, W), dtype=np.float32)
    for row in range(0, H, 4):
        scanline_mask[row, :] = 0.92

    return {
        "grain_intensity": grain_intensity,
        "scratch_schedule": scratch_schedule,
        "flicker_schedule": flicker_schedule,
        "brightness": brightness,
        "scanline_mask": scanline_mask,
    }

def apply_film_effects(frame_arr, frame_idx, fx, rng):
    """Apply film effects to a single frame (float32 array H x W x 3)."""
    grain_intensity = fx["grain_intensity"]
    scanline_mask   = fx["scanline_mask"]
    brightness      = fx["brightness"]
    scratch_schedule = fx["scratch_schedule"]
    flicker_schedule = fx["flicker_schedule"]

    # 1. Scanlines
    frame_arr[:, :, 0] *= scanline_mask
    frame_arr[:, :, 1] *= scanline_mask
    frame_arr[:, :, 2] *= scanline_mask

    # 2. Film grain (fresh per frame)
    grain = rng.normal(0, grain_intensity, frame_arr.shape).astype(np.float32)
    frame_arr += grain

    # 3. Brightness flicker
    b = brightness[frame_idx]
    frame_arr *= b

    # 4. Scratch lines (bright vertical streaks)
    if frame_idx in scratch_schedule:
        for (sx, sw, sbright) in scratch_schedule[frame_idx]:
            x0 = max(0, sx - sw)
            x1 = min(W, sx + sw)
            frame_arr[:, x0:x1, :] = np.clip(
                frame_arr[:, x0:x1, :] + sbright * 0.6, 0, 255
            )

    # 5. White flicker (entire frame bright flash)
    if frame_idx in flicker_schedule:
        frame_arr = np.clip(frame_arr + rng.uniform(40, 90), 0, 255)

    return frame_arr

# ============================================================
# 10. CREATE ANIMATED REEL
#    - Fade-in: heading ke saath hi start (frame 0 se visible)
#    - Typing effect: har secret block ek saath type hota hai
#      (label + text dono ek saath reveal, character by character)
#    - Fade-out: last 1.5s
#    - Film grain + scratch + flicker (scanlines removed)
# ============================================================
def create_animated_reel(image_path, audio_path, output_path,
                          duration=14, fps=24):
    from moviepy import VideoClip, AudioFileClip
    from PIL import Image, ImageDraw, ImageFont

    base_img    = Image.open(image_path).convert("RGB")
    base_arr    = np.array(base_img)
    W_i, H_i    = base_img.size

    total_frames = int(duration * fps)
    fx           = build_film_overlays(total_frames, fps)
    rng          = np.random.default_rng(99)

    FADE_OUT_START = duration - 1.5

    # ── Pre-render: extract per-secret text blocks ──────────────
    # We render each secret block progressively on top of bg
    # bg_only = image without secrets drawn (just background + pill + heading)
    # We'll composite typed text frame-by-frame

    # Timing: secrets start appearing at t=0.5s, evenly spaced
    N_SECRETS   = 5
    REVEAL_START = 0.5   # seconds before first secret starts typing
    # Each secret gets equal share of remaining time
    per_secret_time = (duration - REVEAL_START - 1.5) / N_SECRETS  # ~2.0s each at 14s

    # Characters per second for typing speed
    # We'll type label+text together, total chars spread over per_secret_time*0.6
    TYPING_FRACTION = 0.55  # first 55% of slot = typing, rest = pause

    def make_frame(t):
        frame = base_arr.copy().astype(np.float32)
        fi    = min(int(t * fps), total_frames - 1)

        # ── Film effects (no scanlines) ──────────────────────────
        grain_intensity = fx["grain_intensity"]
        brightness      = fx["brightness"]
        scratch_schedule = fx["scratch_schedule"]
        flicker_schedule = fx["flicker_schedule"]

        # Grain
        grain = rng.normal(0, grain_intensity, frame.shape).astype(np.float32)
        frame += grain

        # Brightness flicker
        frame *= brightness[fi]

        # Scratch lines
        if fi in scratch_schedule:
            for (sx, sw, sbright) in scratch_schedule[fi]:
                x0 = max(0, sx - sw)
                x1 = min(W_i, sx + sw)
                frame[:, x0:x1, :] = np.clip(
                    frame[:, x0:x1, :] + sbright * 0.6, 0, 255
                )

        # White flicker
        if fi in flicker_schedule:
            frame = np.clip(frame + rng.uniform(40, 90), 0, 255)

        # ── Typing overlay ───────────────────────────────────────
        # We overlay typed text by drawing on a PIL image and compositing
        overlay = Image.fromarray(np.clip(frame, 0, 255).astype(np.uint8))
        draw_ov = ImageDraw.Draw(overlay)

        # We need to re-access the layout info — pass via closure
        for i, block in enumerate(_SECRET_BLOCKS):
            slot_start = REVEAL_START + i * per_secret_time
            slot_end   = slot_start + per_secret_time
            typing_end = slot_start + per_secret_time * TYPING_FRACTION

            if t < slot_start:
                break  # secrets after this not yet started

            full_label = block["label"]
            full_text  = block["text"]
            combined   = full_label + "  " + full_text
            total_chars = len(combined)

            if t >= typing_end:
                chars_shown = total_chars
            else:
                progress    = (t - slot_start) / (per_secret_time * TYPING_FRACTION)
                chars_shown = int(progress * total_chars)

            visible = combined[:chars_shown]
            label_visible = visible[:len(full_label)]
            rest_visible  = visible[len(full_label):]
            # strip leading spaces from rest
            rest_visible  = rest_visible.lstrip()

            lx, ly = block["label_xy"]
            # Draw label chars
            if label_visible:
                draw_ov.text((lx, ly), label_visible,
                             font=block["label_font"], fill=block["label_color"])
            # Draw body text chars (wrapped)
            if rest_visible:
                bx, by = block["body_xy"]
                # Simple left-aligned wrap
                body_font  = block["body_font"]
                body_color = block["body_color"]
                body_lines = block["body_lines"]
                # Figure out how many chars to show per line
                char_budget = len(rest_visible)
                used = 0
                for line in body_lines:
                    if used >= char_budget:
                        break
                    take = min(len(line), char_budget - used)
                    draw_ov.text((bx, by), line[:take],
                                 font=body_font, fill=body_color)
                    used += len(line)
                    by   += block["line_h"]

        frame = np.array(overlay).astype(np.float32)

        # ── Fade-out ─────────────────────────────────────────────
        if t > FADE_OUT_START:
            alpha = 1.0 - (t - FADE_OUT_START) / 1.5
            frame *= max(0.0, alpha)

        return np.clip(frame, 0, 255).astype(np.uint8)

    video_clip = VideoClip(make_frame, duration=duration).with_fps(fps)
    audio_clip = AudioFileClip(str(audio_path))

    if audio_clip.duration > duration:
        audio_clip = audio_clip.subclipped(0, duration)

    final = video_clip.with_audio(audio_clip)
    final.write_videofile(
        str(output_path),
        codec="libx264",
        audio_codec="aac",
        fps=fps,
        logger=None,
        threads=2,
    )
    print(f"[OK] Reel created: {output_path}")

# ============================================================
# 11. LOCAL AUDIO PICKER — audio_pool folder se random track
# ============================================================
def pick_local_audio(music_query):
    """
    audio_pool/ folder se mood-matched ya random MP3/WAV pick karo.

    Priority:
      1. audio_pool/<subfolder>/ mein mood-matched files
      2. audio_pool/ ke saare MP3/WAV (flat)
      3. Generate karo fallback sine-wave audio

    Folder structure (dono kaam karti hain):
      audio_pool/dark/bgm1.mp3          ← mood subfolders
      audio_pool/lofi/chill_track.mp3
      audio_pool/any_track.mp3          ← flat bhi chalega
    """
    mood_folders = AUDIO_SUBFOLDERS.get(music_query, [])

    # Step 1: mood subfolder mein dhundo
    candidates = []
    for folder_name in mood_folders:
        sub = AUDIO_DIR / folder_name
        if sub.is_dir():
            candidates += list(sub.glob("*.mp3")) + list(sub.glob("*.wav"))

    # Step 2: agar mood folder mein kuch nahi, saari files lo
    if not candidates:
        candidates = (
            list(AUDIO_DIR.glob("*.mp3")) +
            list(AUDIO_DIR.glob("*.wav")) +
            list(AUDIO_DIR.glob("**/*.mp3")) +
            list(AUDIO_DIR.glob("**/*.wav"))
        )
        # fallback_ prefix wali files last priority pe rakho
        real = [f for f in candidates if not f.name.startswith("fallback_")]
        candidates = real if real else candidates

    if candidates:
        chosen = random.choice(candidates)
        # title = filename se (extension hatao, underscore → space)
        track_title = chosen.stem.replace("_", " ").replace("-", " ").title()
        print(f"[MUSIC] Local audio: {chosen.name}  (mood: {music_query})")
        return chosen, track_title, "Local"

    # Step 3: koi file nahi — generate karo
    print("[MUSIC] audio_pool/ mein koi file nahi — generating fallback")
    return get_fallback_audio(), "ambient", "fallback"

def get_fallback_audio():
    pool = list(AUDIO_DIR.glob("fallback_*.wav"))
    if pool:
        return random.choice(pool)

    print("[AUDIO] Generating fallback ambient track...")
    sr  = 44100
    dur = REEL_DURATION
    t   = np.linspace(0, dur, sr * dur)
    audio = (
        0.25 * np.sin(2 * np.pi * 261.63 * t) +
        0.18 * np.sin(2 * np.pi * 329.63 * t) +
        0.15 * np.sin(2 * np.pi * 392.00 * t) +
        0.12 * np.sin(2 * np.pi * 130.81 * t)
    )
    fade = sr * 2
    audio[:fade]  *= np.linspace(0, 1, fade)
    audio[-fade:] *= np.linspace(1, 0, fade)
    audio /= np.max(np.abs(audio)) * 1.3
    audio_int = (audio * 32767).astype(np.int16)

    path = AUDIO_DIR / "fallback_ambient.wav"
    with wave.open(str(path), 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(audio_int.tobytes())

    return path

# ============================================================
# 12. GROQ — dynamic labels (NO numbers)
# ============================================================
def groq_generate(prompt, max_tokens=900):
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type":  "application/json"
    }
    payload = {
        "model":       GROQ_MODEL,
        "messages":    [{"role": "user", "content": prompt}],
        "max_tokens":  max_tokens,
        "temperature": 0.85,
    }
    r = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers=headers, json=payload, timeout=30
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()

def safe_json_parse(text):
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text).strip()
    s = text.find("{")
    e = text.rfind("}") + 1
    if s >= 0 and e > s:
        return json.loads(text[s:e])
    raise ValueError(f"No JSON found: {text[:200]}")

def gen_secrets(topic):
    label_type = topic["label_type"]
    prompt = f"""
You are a viral psychology facts content creator for Facebook Reels.

Topic: {topic['key']}
Label style for this topic: "{label_type}"

Write exactly 5 dark/interesting facts about {topic['key'].lower()}.
Each fact: surprising, relatable, emotionally resonant. Max 15 words.
No emojis in facts. English only.

IMPORTANT for labels:
- Do NOT use any numbers (no "1", "2", "#1", "1st" etc.)
- Do NOT use "1st Secret", "2nd Secret" etc.
- Use ONLY thematic text labels based on "{label_type}" style.
- Examples: "Dark Secret :", "Hidden Truth :", "Raw Fact :", "The Trap :", "The Law :"
- Keep labels SHORT (max 4 words + colon), NO numbers at all.

Also write a viral HEADING for this reel about {topic['key'].lower()}.
Heading rules:
- Style like: "95% People Never Notice This", "The Dark Truth About Human Behavior", "Why People Suddenly Change After Success"
- Must be catchy, curiosity-driven, scroll-stopping
- NO brand name, NO emojis
- Prefer single line. If two lines needed, keep it natural — max 8 words per line
- Max total 12 words

Return ONLY valid JSON, no extra text:
{{
  "heading": "Your viral heading here",
  "hook": "One punchy caption sentence for the post with 2-3 emojis.",
  "secrets": [
    {{"label": "{label_type} :", "text": "..."}},
    {{"label": "The Truth :", "text": "..."}},
    {{"label": "Hidden Law :", "text": "..."}},
    {{"label": "Dark Fact :", "text": "..."}},
    {{"label": "The Secret :", "text": "..."}}
  ]
}}
"""
    raw = groq_generate(prompt)
    return safe_json_parse(raw)

# ============================================================
# 13. CAPTION
# ============================================================
def build_caption(hook, topic, track_title, artist_name):
    tags = " ".join(f"#{t}" for t in topic["hashtags"])
    # Local audio = no attribution needed
    return f"{hook}\n\nFollow {PAGE_NAME} for daily facts!\n\n{tags}"

# ============================================================
# 14. FACEBOOK — page token + reel + story upload
# ============================================================
def get_page_token():
    url = f"https://graph.facebook.com/{FB_API_VERSION}/{PAGE_OR_IG_ID}"
    r = requests.get(url, params={
        "fields":       "access_token",
        "access_token": PAGE_ACCESS_TOKEN,
    }, timeout=15)
    r.raise_for_status()
    data = r.json()
    if "access_token" not in data:
        raise Exception(f"Token exchange failed: {data}")
    print("[FB] Page token obtained")
    return data["access_token"]

def get_instagram_account_id(page_token):
    """FB Page se linked Instagram Business Account ID fetch karo."""
    r = requests.get(
        f"https://graph.facebook.com/{FB_API_VERSION}/{PAGE_OR_IG_ID}",
        params={
            "fields":       "instagram_business_account",
            "access_token": page_token,
        },
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    if "instagram_business_account" not in data:
        raise Exception(f"No Instagram account linked to this FB Page: {data}")
    ig_id = data["instagram_business_account"]["id"]
    print(f"[IG] Account ID fetched: {ig_id}")
    return ig_id

def post_reel_to_facebook(video_path, caption, page_token):
    video_size = os.path.getsize(video_path)

    # Step 1: Init upload session
    init_url = f"https://graph.facebook.com/{FB_API_VERSION}/{PAGE_OR_IG_ID}/video_reels"
    init_resp = requests.post(init_url, data={
        "upload_phase": "start",
        "access_token": page_token,
    }, timeout=30)
    init_resp.raise_for_status()
    init_data  = init_resp.json()
    video_id   = init_data["video_id"]
    upload_url = init_data["upload_url"]
    print(f"[FB REEL] Session started. Video ID: {video_id}")

    # Step 2: Upload binary
    with open(video_path, "rb") as f:
        video_data = f.read()

    upload_resp = requests.post(
        upload_url,
        headers={
            "Authorization": f"OAuth {page_token}",
            "offset":        "0",
            "file_size":     str(video_size),
        },
        data=video_data,
        timeout=180,
    )
    upload_resp.raise_for_status()
    print("[FB REEL] Video uploaded")

    # Step 3: Publish reel
    pub_resp = requests.post(init_url, data={
        "access_token": page_token,
        "video_id":     video_id,
        "upload_phase": "finish",
        "video_state":  "PUBLISHED",
        "description":  caption,
    }, timeout=30)
    pub_resp.raise_for_status()
    result = pub_resp.json()

    if result.get("success"):
        # Step 4: Fetch permalink for Instagram reuse
        video_url = None
        try:
            v_resp = requests.get(
                f"https://graph.facebook.com/{FB_API_VERSION}/{video_id}",
                params={"fields": "permalink_url", "access_token": page_token},
                timeout=15,
            )
            v_data = v_resp.json()
            video_url = v_data.get("permalink_url")
            if video_url and not video_url.startswith("http"):
                video_url = "https://www.facebook.com" + video_url
        except Exception as e:
            print(f"[FB] Could not fetch permalink (non-fatal): {e}")

        print(f"[SUCCESS] Reel published! Video ID: {video_id}")
        if video_url:
            print(f"[FB URL] {video_url}")
        return video_id, video_url

    raise Exception(f"Reel publish failed: {result}")

def post_story_to_facebook(video_path, page_token):
    """
    Auto-share the reel video to Facebook Story as well.
    Uses the photo_stories / video_stories endpoint.
    """
    print("[FB STORY] Uploading to Story...")
    video_size = os.path.getsize(video_path)

    try:
        # Step 1: Init story video upload
        story_init_url = f"https://graph.facebook.com/{FB_API_VERSION}/{PAGE_OR_IG_ID}/video_stories"
        init_resp = requests.post(story_init_url, data={
            "upload_phase":  "start",
            "access_token":  page_token,
        }, timeout=30)
        init_resp.raise_for_status()
        init_data  = init_resp.json()
        video_id   = init_data.get("video_id")
        upload_url = init_data.get("upload_url")

        if not video_id or not upload_url:
            raise Exception(f"Story init failed: {init_data}")

        print(f"[FB STORY] Session started. Video ID: {video_id}")

        # Step 2: Upload binary
        with open(video_path, "rb") as f:
            video_data = f.read()

        upload_resp = requests.post(
            upload_url,
            headers={
                "Authorization": f"OAuth {page_token}",
                "offset":        "0",
                "file_size":     str(video_size),
            },
            data=video_data,
            timeout=180,
        )
        upload_resp.raise_for_status()
        print("[FB STORY] Video uploaded")

        # Step 3: Publish story
        pub_resp = requests.post(story_init_url, data={
            "access_token": page_token,
            "video_id":     video_id,
            "upload_phase": "finish",
            "video_state":  "PUBLISHED",
        }, timeout=30)
        pub_resp.raise_for_status()
        result = pub_resp.json()

        if result.get("success"):
            print(f"[SUCCESS] Story published! Video ID: {video_id}")
            return video_id
        else:
            print(f"[FB STORY] Story publish result: {result}")
            return video_id

    except Exception as e:
        print(f"[FB STORY] Story post failed (non-fatal): {e}")
        return None

# ============================================================
# 15. UGUU.SE — Temp video hosting (24h public URL)
# ============================================================
def upload_to_uguu(video_path):
    """Video ko uguu.se pe upload karo, public URL wapas milegi (24h valid)."""
    print("[UGUU] Uploading video to uguu.se...", flush=True)
    with open(video_path, "rb") as f:
        resp = requests.post(
            "https://uguu.se/upload",
            files={"files[]": (Path(video_path).name, f, "video/mp4")},
            timeout=120,
        )
    resp.raise_for_status()
    data = resp.json()
    url = data["files"][0]["url"]
    print(f"[UGUU] Uploaded: {url}", flush=True)
    return url

# ============================================================
# 16. INSTAGRAM — Reel post
# ============================================================
def post_reel_to_instagram(ig_user_id, video_url, caption, page_token):
    """Instagram Reel post karo. video_url = uguu.se public URL."""
    print("[IG REEL] Creating media container...", flush=True)

    c_resp = requests.post(
        f"https://graph.facebook.com/{FB_API_VERSION}/{ig_user_id}/media",
        data={
            "access_token":  page_token,
            "media_type":    "REELS",
            "video_url":     video_url,
            "caption":       caption,
            "share_to_feed": "true",
        },
        timeout=30,
    )
    c_resp.raise_for_status()
    c_data = c_resp.json()
    if "id" not in c_data:
        raise Exception(f"IG Reel container failed: {c_data}")
    container_id = c_data["id"]
    print(f"[IG REEL] Container: {container_id}", flush=True)

    max_wait = 90
    waited   = 0
    interval = 8
    status   = ""
    while waited < max_wait:
        time.sleep(interval)
        waited += interval
        s = requests.get(
            f"https://graph.facebook.com/{FB_API_VERSION}/{container_id}",
            params={"fields": "status_code", "access_token": page_token},
            timeout=15,
        ).json()
        status = s.get("status_code", "")
        print(f"[IG REEL] Status: {status} ({waited}s)", flush=True)
        if status == "FINISHED":
            break
        if status == "ERROR":
            raise Exception(f"IG Reel container error: {s}")
    else:
        raise Exception(f"IG Reel timeout after {max_wait}s — last: {status}")

    print("[IG REEL] Publishing...", flush=True)
    p_resp = requests.post(
        f"https://graph.facebook.com/{FB_API_VERSION}/{ig_user_id}/media_publish",
        data={"access_token": page_token, "creation_id": container_id},
        timeout=30,
    )
    p_resp.raise_for_status()
    p_data = p_resp.json()
    if "id" not in p_data:
        raise Exception(f"IG Reel publish failed: {p_data}")
    print(f"[IG REEL] Published! Media ID: {p_data['id']}", flush=True)
    return p_data["id"]

# ============================================================
# 17. INSTAGRAM — Story post
# ============================================================
def post_story_to_instagram(ig_user_id, video_url, page_token):
    """Instagram Story post karo. video_url = uguu.se public URL."""
    print("[IG STORY] Creating story container...", flush=True)

    c_resp = requests.post(
        f"https://graph.facebook.com/{FB_API_VERSION}/{ig_user_id}/media",
        data={
            "access_token": page_token,
            "media_type":   "STORIES",
            "video_url":    video_url,
        },
        timeout=30,
    )
    c_resp.raise_for_status()
    c_data = c_resp.json()
    if "id" not in c_data:
        raise Exception(f"IG Story container failed: {c_data}")
    container_id = c_data["id"]
    print(f"[IG STORY] Container: {container_id}", flush=True)

    max_wait = 90
    waited   = 0
    interval = 8
    status   = ""
    while waited < max_wait:
        time.sleep(interval)
        waited += interval
        s = requests.get(
            f"https://graph.facebook.com/{FB_API_VERSION}/{container_id}",
            params={"fields": "status_code", "access_token": page_token},
            timeout=15,
        ).json()
        status = s.get("status_code", "")
        print(f"[IG STORY] Status: {status} ({waited}s)", flush=True)
        if status == "FINISHED":
            break
        if status == "ERROR":
            raise Exception(f"IG Story container error: {s}")
    else:
        raise Exception(f"IG Story timeout after {max_wait}s — last: {status}")

    print("[IG STORY] Publishing...", flush=True)
    p_resp = requests.post(
        f"https://graph.facebook.com/{FB_API_VERSION}/{ig_user_id}/media_publish",
        data={"access_token": page_token, "creation_id": container_id},
        timeout=30,
    )
    p_resp.raise_for_status()
    p_data = p_resp.json()
    if "id" not in p_data:
        raise Exception(f"IG Story publish failed: {p_data}")
    print(f"[IG STORY] Published! Media ID: {p_data['id']}", flush=True)
    return p_data["id"]

# ============================================================
# 15. MAIN
# ============================================================
def main():
    print("\n" + "=" * 60)
    print(f"      PSYCHOLOGY SECRETS REEL BOT v5 — {BRAND_NAME}")
    print(f"      {datetime.date.today()} | {datetime.datetime.now().strftime('%H:%M')}")
    print("=" * 60)

    topic = random.choice(TOPICS)
    theme = random.choice(list(PAPER_THEMES.keys()))
    print(f"[SELECT] Topic: {topic['key']} | Theme: {theme}")
    print(f"[LABEL]   {topic['label_type']} | Music: {topic['music_query']}")

    # ── Generate secrets ──
    print("[GROQ] Generating content...")
    try:
        data = gen_secrets(topic)
        print(f"[HOOK] {data['hook']}")
        print(f"[HEADING] {data.get('heading', topic['heading'])}")
        for s in data["secrets"]:
            print(f"  {s['label']} {s['text'][:55]}")
    except Exception as e:
        print(f"[ERROR] Groq failed: {e}")
        sys.exit(1)

    # ── Render image ──
    print("[RENDER] Creating image...")
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    try:
        reel_heading = data.get("heading", topic["heading"])
        img      = render_reel_image(topic, data["secrets"], theme, heading=reel_heading)
        img_path = OUTPUT_DIR / f"img_{ts}_{topic['key'].replace(' ', '_')}.jpg"
        img.save(str(img_path), "JPEG", quality=96)
        print(f"[OK] Image: {img_path}")

        # bg_only: secrets area blank (for typing animation base)
        bg_img  = render_bg_only(topic, data["secrets"], theme, heading=reel_heading)
        bg_path = OUTPUT_DIR / f"bg_{ts}_{topic['key'].replace(' ', '_')}.jpg"
        bg_img.save(str(bg_path), "JPEG", quality=96)
        print(f"[OK] BG image: {bg_path}")
    except Exception as e:
        print(f"[ERROR] Render failed: {e}")
        sys.exit(1)

    # ── Pick music from local audio_pool folder ──
    audio_path, track_title, artist_name = pick_local_audio(topic["music_query"])

    # ── Create animated reel ──
    print("[VIDEO] Encoding reel...")
    try:
        video_path = OUTPUT_DIR / f"reel_{ts}_{topic['key'].replace(' ', '_')}.mp4"
        create_animated_reel(bg_path, audio_path, video_path,
                             duration=REEL_DURATION, fps=FPS)
    except Exception as e:
        print(f"[ERROR] Video failed: {e}")
        sys.exit(1)

    # ── Caption ──
    caption = build_caption(data["hook"], topic, track_title, artist_name)
    print(f"[CAPTION]\n{caption}\n")

    # ── FB token ──
    print("[FB] Getting page token...")
    try:
        page_token = get_page_token()
    except Exception as e:
        print(f"[ERROR] Token failed: {e}")
        sys.exit(1)

    # ── IG Account ID (FB se auto-fetch) ──
    ig_user_id = None
    try:
        ig_user_id = get_instagram_account_id(page_token)
    except Exception as e:
        print(f"[WARN] IG account ID fetch failed (non-fatal): {e}")

    # ── Post reel to FB ──
    print("[FB] Uploading reel...", flush=True)
    fb_reel_id   = None
    fb_video_url = None
    try:
        fb_reel_id, fb_video_url = post_reel_to_facebook(str(video_path), caption, page_token)
        print(f"[REEL DONE] FB ID: {fb_reel_id}", flush=True)
    except Exception as e:
        print(f"[ERROR] FB Reel post failed: {e}", flush=True)
        print("[ABORT] FB post failed — skipping Story and Instagram.", flush=True)
        sys.exit(1)

    # ── Post to FB Story ──
    print("[FB] Auto-sharing to Story...", flush=True)
    story_id = post_story_to_facebook(str(video_path), page_token)
    if story_id:
        print(f"[STORY DONE] ID: {story_id}", flush=True)
    else:
        print("[STORY] Skipped or failed (non-fatal)", flush=True)

    # ── Upload to uguu.se (Instagram ke liye public URL) ──
    uguu_url = None
    if ig_user_id:
        try:
            uguu_url = upload_to_uguu(str(video_path))
        except Exception as e:
            print(f"[UGUU] Upload failed (non-fatal): {e}", flush=True)

    # ── Post to Instagram Reel + Story ──
    if uguu_url and ig_user_id:
        try:
            ig_reel_id = post_reel_to_instagram(ig_user_id, uguu_url, caption, page_token)
            print(f"[IG REEL DONE] ID: {ig_reel_id}", flush=True)
        except Exception as e:
            print(f"[ERROR] IG Reel failed (non-fatal): {e}", flush=True)
            print("[INFO] FB already posted successfully.", flush=True)

        try:
            ig_story_id = post_story_to_instagram(ig_user_id, uguu_url, page_token)
            print(f"[IG STORY DONE] ID: {ig_story_id}", flush=True)
        except Exception as e:
            print(f"[ERROR] IG Story failed (non-fatal): {e}", flush=True)
    else:
        print("[IG] Skipped — uguu URL or IG account ID not available.", flush=True)

    print("\n[ALL DONE] FB Reel + FB Story + IG Reel + IG Story posted!", flush=True)

    # ── Cleanup: disk space bachane ke liye output files delete karo ──
    for f in [img_path, bg_path, video_path]:
        try:
            Path(f).unlink(missing_ok=True)
            print(f"[CLEANUP] Deleted: {f}", flush=True)
        except Exception as e:
            print(f"[CLEANUP] Could not delete {f}: {e}", flush=True)


if __name__ == "__main__":
    main()
