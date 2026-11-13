"""
GameVibe Local Game Director (100% Free, Zero-Cloud, High-Performance)
Consolidates:
1. Active Game Window Detection
2. WinRT Hardware OCR (Subtitles, Dialogue, Location banners)
3. OpenCV/PIL Computer Vision (Letterbox cutscenes, Screen wipes, Lighting)
4. Input & Game Audio Surge Detection
5. Dynamic Music Style & Query Generator

Outputs:
- data/live-sensor.json
- data/scene-director.json
- data/live-dialogue.json
"""
import os
import sys
import time
import json
import io
import re
import base64
import urllib.request
import urllib.error
import ctypes
from ctypes import wintypes
import asyncio
from PIL import Image, ImageStat, ImageOps, ImageEnhance, ImageChops
import cv2
import numpy as np

# Ensure UTF-8 stdout
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR = os.path.join(ROOT, 'data')
os.makedirs(DATA_DIR, exist_ok=True)

LIVE_SENSOR_FILE = os.path.join(DATA_DIR, 'live-sensor.json')
LIVE_SENSOR_TMP = os.path.join(DATA_DIR, 'live-sensor.tmp.json')
SCENE_DIRECTOR_FILE = os.path.join(DATA_DIR, 'scene-director.json')
SCENE_DIRECTOR_TMP = os.path.join(DATA_DIR, 'scene-director.tmp.json')
DIALOGUE_FILE = os.path.join(DATA_DIR, 'live-dialogue.json')
DIALOGUE_TMP = os.path.join(DATA_DIR, 'live-dialogue.tmp.json')
APP_STATE_FILE = os.path.join(DATA_DIR, 'app-state.json')
USER_INTEGRATIONS_FILE = os.path.join(DATA_DIR, 'user-integrations.json')
GSI_FILE = os.path.join(DATA_DIR, 'live-gsi.json')

DENYLIST_PROCESSES = {
    'explorer', 'msedge', 'chrome', 'firefox', 'opera', 'brave', 'vivaldi', 'chrome-headless-shell',
    'code', 'devenv', 'cursor', 'idea64', 'pycharm64', 'notepad', 'notepad++', 'windowsterminal',
    'powershell', 'pwsh', 'cmd', 'conhost', 'gamemusick', 'gamevibe', 'electron', 'interactive_sensor', 'node', 'python', 'antigravity',
    'searchhost', 'startmenuexperiencehost', 'shellexperiencehost', 'applicationframehost',
    'taskmgr', 'audiodg', 'system', 'idle', 'textinputhost', 'lockapp', 'dwm', 'csrss',
    'discord', 'telegram', 'slack', 'teams', 'whatsapp', 'steam', 'steamwebhelper',
    'epicgameslauncher', 'nvcontainer', 'nvidia share', 'nvidia overlay', 'gamebar', 'xboxpcappft',
    'happ', 'hydra', 'v2ray', 'clash', 'nekoray', 'sing-box', 'xray', 'anydesk', 'teamviewer', '1password', 'keepass', 'bitwarden'
}

DRAMA_WORDS = {
    'death', 'die', 'dead', 'kill', 'killed', 'blood', 'curse', 'cursed', 'darkness',
    'grave', 'loss', 'lost', 'sorrow', 'grief', 'tear', 'tears', 'goodbye', 'forgive',
    'fallen', 'void', 'spiral', 'end', 'despair', 'trapped', 'sacrifice', 'mourn',
    'смерть', 'умер', 'убит', 'кровь', 'проклятие', 'тьма', 'могила', 'потеря', 'скорбь',
    'слезы', 'прощай', 'прости', 'жертва', 'отчаяние', 'боль', 'мрак', 'погиб', 'погибель'
}

MAJESTIC_WORDS = {
    'light', 'hope', 'future', 'world', 'save', 'saved', 'freedom', 'free', 'sunrise',
    'dawn', 'horizon', 'sky', 'dream', 'believe', 'eternal', 'reborn', 'rise', 'glory',
    'victory', 'triumph', 'miracle', 'sacred', 'grace', 'divine', 'sanctuary',
    'свет', 'надежда', 'будущее', 'мир', 'свобода', 'рассвет', 'горизонт', 'небо',
    'мечта', 'вечность', 'возрождение', 'победа', 'триумф', 'чудо', 'священный', 'святилище'
}

COMBAT_WORDS = {
    'attack', 'fight', 'strike', 'enemy', 'boss', 'destroy', 'surrender', 'defeat',
    'blade', 'sword', 'weapon', 'flesh', 'prepare to die', 'have at you', 'crush',
    'combat', 'slain', 'battle', 'danger',
    'атака', 'бой', 'битва', 'враг', 'босс', 'уничтожь', 'сдайся', 'клинок', 'меч', 'умри', 'сражение'
}

MENU_WORDS = {
    'inventory', 'equipment', 'crafting', 'merchant', 'skills', 'settings', 'main menu',
    'select hero', 'draft', 'accept', 'match found', 'queue', 'loadout', 'level up',
    'инвентарь', 'снаряжение', 'крафт', 'торговец', 'навыки', 'настройки', 'меню',
    'выбор героя', 'драфт', 'принять', 'поиск игры', 'задание'
}

COZY_WORDS = {
    'tavern', 'camp', 'bonfire', 'inn', 'rest', 'hearth', 'safe zone', 'sanctuary', 'village',
    'таверна', 'лагерь', 'костер', 'отдых', 'убежище', 'деревня', 'сохранить'
}

HORROR_WORDS = {
    'hide', 'run', 'monster', 'battery', 'sanity', 'locked', 'alarm', 'basement', 'stalker',
    'прячься', 'беги', 'монстр', 'тревога', 'заперто', 'подвал', 'опасно', 'шум'
}

LOCATION_WORDS = {
    'castle', 'corridor', 'tower', 'dungeon', 'crypt', 'ruins', 'hall', 'temple', 'cavern',
    'abyss', 'chapel', 'garden', 'forest', 'swamp', 'factory', 'peak', 'city', 'street',
    'harbor', 'gates', 'chamber', 'throne', 'entrance', 'sanctuary', 'mines', 'citadel',
    'святилище', 'замок', 'башня', 'подземелье', 'руины', 'коридор', 'склеп', 'пещера',
    'бездна', 'лес', 'часовня', 'трон', 'врата', 'палаты', 'город', 'вход', 'цитадель'
}

# Key codes for attack & actions
ATTACK_VKEYS = [
    0x01, 0x02,             # Mouse Left, Mouse Right
    0x5A, 0x58, 0x43, 0x56, # Z, X, C, V
    0x51, 0x45, 0x52, 0x46, # Q, E, R, F
    0x4A, 0x4B, 0x4C,       # J, K, L
    0x20,                   # Space
    0x31, 0x32, 0x33, 0x34  # 1, 2, 3, 4
]

ONLINE_COMPETITIVE_GAMES = {
    'dota2', 'cs2', 'csgo', 'counter-strike', 'counterstrike', 'valorant',
    'league of legends', 'leagueclient', 'deadlock', 'r5apex', 'apex',
    'overwatch', 'pubg', 'tslgame', 'fortnite', 'rainbowsix', 'r6', 'marvelrivals'
}

def is_online_competitive_game(proc: str) -> bool:
    if not proc:
        return False
    p = proc.lower()
    return any(g in p for g in ONLINE_COMPETITIVE_GAMES)

UI_GARBAGE_PATTERNS = [
    'gamemusick', 'gamevibe', 'youtube', 'soundtrack', 'ost', 'audio',
    'stream', 'playlist', 'spotify', 'deftones', 'kavinsky', 'brian eno',
    'celldweller', 'combat battle action', 'game audio', 'dota 2 combat',
    'magnus', 'power of the horde', 'frostivus', 'invincible'
]

def contains_ui_garbage(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    return any(p in t for p in UI_GARBAGE_PATTERNS)


def is_valid_dialogue_text(text: str) -> bool:
    """Reject WinRT OCR hallucinations from UI graphics/textures (bullets, mixed-script glyphs, non-vowel fragments)."""
    if not text:
        return False
    clean = ' '.join(text.strip().split())
    if len(clean) < 6 or len(clean) > 220 or contains_ui_garbage(clean):
        return False

    # Reject UI/glyph noise commonly hallucinated by WinRT OCR on game textures
    if re.search(r'[•«»ø§¤°¬|~^_\[\]{}<>■□◆◇★☆]', clean):
        return False

    allowed_chars = sum(1 for c in clean if c.isalnum() or c in " .,!?:'\"-—–…()")
    if (allowed_chars / len(clean)) < 0.85:
        return False

    non_space = [c for c in clean if not c.isspace()]
    if not non_space:
        return False
    alpha_ratio = sum(1 for c in non_space if c.isalpha()) / len(non_space)
    if alpha_ratio < 0.70:
        return False

    tokens = re.findall(r"[A-Za-zА-Яа-яЁё0-9']+", clean)
    if len(tokens) < 2:
        return False

    vowels = set('aeiouyAEIOUYаеёиоуыэюяАЕЁИОУЫЭЮЯ')
    valid_words = 0
    for tok in tokens:
        has_lat = bool(re.search(r'[A-Za-z]', tok))
        has_cyr = bool(re.search(r'[А-Яа-яЁё]', tok))
        has_dig = any(c.isdigit() for c in tok)
        # Mixed Cyrillic+Latin or digits inside letters = classic OCR texture artifact (e.g. "Crpens6a", "ropøsoutan")
        if (has_lat and has_cyr) or (has_dig and (has_lat or has_cyr)):
            return False
        letters_only = re.sub(r"[^A-Za-zА-Яа-яЁё]", '', tok)
        if len(letters_only) >= 2:
            if len(letters_only) >= 3 and not any(ch in vowels for ch in letters_only):
                continue
            valid_words += 1

    return valid_words >= 2 and (valid_words / len(tokens)) >= 0.65

def get_user_favorite_artists():
    try:
        acc_file = os.path.join(DATA_DIR, 'accounts.json')
        if os.path.exists(acc_file):
            with open(acc_file, 'r', encoding='utf-8') as f:
                d = json.load(f)
                active_id = d.get('activeAccountId')
                for acc in d.get('accounts', []):
                    if acc.get('id') == active_id:
                        return acc.get('favoriteArtists', []), acc.get('favoriteGenres', [])
    except Exception:
        pass
    return [], []

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32

class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ('biSize', wintypes.DWORD),
        ('biWidth', wintypes.LONG),
        ('biHeight', wintypes.LONG),
        ('biPlanes', wintypes.WORD),
        ('biBitCount', wintypes.WORD),
        ('biCompression', wintypes.DWORD),
        ('biSizeImage', wintypes.DWORD),
        ('biXPelsPerMeter', wintypes.LONG),
        ('biYPelsPerMeter', wintypes.LONG),
        ('biClrUsed', wintypes.DWORD),
        ('biClrImportant', wintypes.DWORD)
    ]

class BITMAPINFO(ctypes.Structure):
    _fields_ = [
        ('bmiHeader', BITMAPINFOHEADER),
        ('bmiColors', wintypes.DWORD * 3)
    ]

user32.GetForegroundWindow.restype = wintypes.HWND
kernel32.OpenProcess.restype = wintypes.HANDLE
kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
kernel32.QueryFullProcessImageNameW.argtypes = [
    wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)
]
kernel32.CloseHandle.argtypes = [wintypes.HANDLE]

try:
    import winocr
    HAS_WINOCR = True
except Exception:
    HAS_WINOCR = False


def find_running_game():
    try:
        hdesk = user32.OpenInputDesktop(0, False, 0x01FF)
        if hdesk:
            user32.SetThreadDesktop(hdesk)
    except Exception:
        pass

    found = None
    def cb(hwnd, lparam):
        nonlocal found
        if not user32.IsWindowVisible(hwnd):
            return 1
        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        w = rect.right - rect.left
        h = rect.bottom - rect.top
        if w < 300 or h < 200:
            return 1
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value == 0:
            return 1
        hproc = kernel32.OpenProcess(0x1000, False, pid.value)
        if not hproc:
            return 1
        buf = ctypes.create_unicode_buffer(520)
        size = wintypes.DWORD(520)
        name = ''
        if kernel32.QueryFullProcessImageNameW(hproc, 0, buf, ctypes.byref(size)):
            name = os.path.splitext(os.path.basename(buf.value))[0].lower()
        kernel32.CloseHandle(hproc)
        if name and name not in DENYLIST_PROCESSES and not any(d in name for d in DENYLIST_PROCESSES):
            tbuf = ctypes.create_unicode_buffer(256)
            user32.GetWindowTextW(hwnd, tbuf, 256)
            title = tbuf.value.strip() or name
            if not any(d in title.lower() for d in ['nvidia', 'geforce', 'overlay', 'settings']):
                found = {
                    'hwnd': hwnd,
                    'pid': pid.value,
                    'process': name,
                    'title': title,
                    'rect': (rect.left, rect.top, w, h)
                }
                return 0
        return 1
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p)
    user32.EnumWindows(WNDENUMPROC(cb), 0)
    return found


def get_foreground_game():
    hwnd = user32.GetForegroundWindow()
    if hwnd:
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value != 0:
            hproc = kernel32.OpenProcess(0x1000, False, pid.value)
            name = ''
            if hproc:
                buf = ctypes.create_unicode_buffer(520)
                size = wintypes.DWORD(520)
                if kernel32.QueryFullProcessImageNameW(hproc, 0, buf, ctypes.byref(size)):
                    name = os.path.splitext(os.path.basename(buf.value))[0].lower()
                kernel32.CloseHandle(hproc)

            if name and name not in DENYLIST_PROCESSES and not any(d in name for d in DENYLIST_PROCESSES):
                rect = wintypes.RECT()
                user32.GetWindowRect(hwnd, ctypes.byref(rect))
                w = rect.right - rect.left
                h = rect.bottom - rect.top
                if w >= 240 and h >= 180:
                    title_buf = ctypes.create_unicode_buffer(256)
                    user32.GetWindowTextW(hwnd, title_buf, 256)
                    raw_title = title_buf.value.strip()
                    clean_title = raw_title if raw_title else name
                    return {
                        'hwnd': hwnd,
                        'pid': pid.value,
                        'process': name,
                        'title': clean_title,
                        'rect': (rect.left, rect.top, w, h)
                    }

    # Fallback: check if an active game window is running on the system
    return find_running_game()


def grab_window_crop(rect, x_rel, y_rel, w_rel, h_rel):
    x, y, total_w, total_h = rect
    cx = x + int(total_w * x_rel)
    cy = y + int(total_h * y_rel)
    cw = max(10, int(total_w * w_rel))
    ch = max(10, int(total_h * h_rel))

    hdc_screen = user32.GetDC(0)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
    hbm = gdi32.CreateCompatibleBitmap(hdc_screen, cw, ch)
    old_obj = gdi32.SelectObject(hdc_mem, hbm)

    gdi32.BitBlt(hdc_mem, 0, 0, cw, ch, hdc_screen, cx, cy, 0x00CC0020)

    bmi = BITMAPINFO()
    bmi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.bmiHeader.biWidth = cw
    bmi.bmiHeader.biHeight = -ch
    bmi.bmiHeader.biPlanes = 1
    bmi.bmiHeader.biBitCount = 32
    bmi.bmiHeader.biCompression = 0

    buf = ctypes.create_string_buffer(cw * ch * 4)
    gdi32.GetDIBits(hdc_mem, hbm, 0, ch, buf, ctypes.byref(bmi), 0)

    gdi32.SelectObject(hdc_mem, old_obj)
    gdi32.DeleteObject(hbm)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(0, hdc_screen)

    img = Image.frombuffer('RGBA', (cw, ch), buf, 'raw', 'BGRA', 0, 1).convert('RGB')
    return img


async def ocr_crop(img, lang='en-US'):
    if not HAS_WINOCR:
        return ''
    try:
        # Preprocessing: upscale if small, enhance contrast for crisp character recognition
        w, h = img.size
        if w < 500:
            scale = 2
            img = img.resize((w * scale, h * scale), Image.Resampling.BILINEAR)

        enhancer = ImageEnhance.Contrast(img)
        enhanced = enhancer.enhance(1.8)

        res = await winocr.recognize_pil(enhanced, lang)
        text = ' '.join(res.text.strip().split())
        if not is_valid_dialogue_text(text):
            return ''
        return text
    except Exception:
        return ''


def get_active_audio_mode():
    try:
        if os.path.exists(APP_STATE_FILE):
            with open(APP_STATE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                mode = data.get('audioMode')
                if mode in ('custom', 'game-vibe'):
                    return mode
    except Exception:
        pass
    return 'game-vibe'


def read_fresh_sensor():
    try:
        if os.path.exists(LIVE_SENSOR_FILE):
            if time.time() - os.path.getmtime(LIVE_SENSOR_FILE) < 3.5:
                with open(LIVE_SENSOR_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
    except Exception:
        pass
    return None


def analyze_text_sentiment(text):
    text_lower = text.lower()
    if any(p in text_lower for p in ['you died', 'вы погибли', 'потрачено', 'game over', 'wasted', 'defeat']):
        return 'DRAMA', 'Экран гибели / Поражение', 'tragedy_drama'
    if any(p in text_lower for p in ['victory', 'felled', 'slain', 'победа', 'враг повержен', 'босс повержен', 'quest completed']):
        return 'VICTORY', 'Триумф и Победа', 'victory_triumph'
    if any(p in text_lower for p in HORROR_WORDS):
        return 'STEALTH', f'Угроза / Саспенс: {text[:28]}', 'horror_dread'
    if any(p in text_lower for p in MENU_WORDS):
        return 'EXPLORE', f'Меню / Подготовка: {text[:28]}', 'menu_lobby'
    if any(p in text_lower for p in COZY_WORDS):
        return 'EXPLORE', f'Убежище / Отдых: {text[:28]}', 'cozy_hub'

    words = set(text_lower.replace(',', ' ').replace('.', ' ').replace('!', ' ').replace('?', ' ').split())

    drama_score = sum(1 for w in words if w in DRAMA_WORDS)
    majestic_score = sum(1 for w in words if w in MAJESTIC_WORDS)
    combat_score = sum(1 for w in words if w in COMBAT_WORDS)
    loc_score = sum(1 for w in words if w in LOCATION_WORDS)

    if combat_score > 0 and combat_score >= drama_score:
        return 'COMBAT', 'Сражение / Боевой диалог', 'skirmish_combat'
    if drama_score > 0 and drama_score >= majestic_score:
        return 'DRAMA', 'Драматический момент сюжета', 'tragedy_drama'
    if majestic_score > 0:
        return 'MAJESTIC', 'Воодушевляющее событие / Надежда', 'vista_wonder'
    if loc_score > 0:
        return 'EXPLORE', f'Новая область: {text[:28]}', 'vista_wonder'
    return 'DRAMA', 'Сюжетный диалог', 'dialogue_story'


def detect_boss_healthbar(rect):
    """
    Fast heuristic detector for wide horizontal Boss HP bars at top (y=8..14%) or bottom (y=83..89%) of screen.
    """
    try:
        for y_rel in (0.08, 0.85):
            strip = grab_window_crop(rect, 0.24, y_rel, 0.52, 0.045)
            small = strip.resize((64, 6), Image.Resampling.NEAREST)
            pixels = list(small.getdata())
            red_cols = 0
            for x_col in range(64):
                col_has_hp = False
                for y_row in range(6):
                    r, g, b = pixels[y_row * 64 + x_col]
                    # Deep crimson / bright red boss HP bar OR bright gold/amber boss bar
                    is_crimson = (r > 135 and g < 55 and b < 55 and (r - max(g, b)) > 85)
                    is_gold_hp = (r > 185 and g > 130 and b < 60 and (r - b) > 120)
                    if is_crimson or is_gold_hp:
                        col_has_hp = True
                        break
                if col_has_hp:
                    red_cols += 1
            # If >= 58% of the horizontal center strip has contiguous crimson/gold HP pixels
            if red_cols >= 37:
                return True
    except Exception:
        pass
    return False


def sample_cinematic_bars_and_luma(rect):
    x, y, w, h = rect
    # Sample top 3% and bottom 3% for cinematic 21:9 letterbox black bars
    top_bar = grab_window_crop(rect, 0.1, 0.01, 0.8, 0.04)
    bot_bar = grab_window_crop(rect, 0.1, 0.95, 0.8, 0.04)
    center = grab_window_crop(rect, 0.25, 0.25, 0.5, 0.5)

    top_stat = ImageStat.Stat(top_bar.convert('L'))
    bot_stat = ImageStat.Stat(bot_bar.convert('L'))
    center_stat = ImageStat.Stat(center.convert('L'))

    top_luma = top_stat.mean[0]
    bot_luma = bot_stat.mean[0]
    center_luma = center_stat.mean[0]

    is_letterbox = (top_luma < 6 and bot_luma < 6 and center_luma >= 12)
    return is_letterbox, int(center_luma)


def read_fresh_gsi(max_age_ms: int = 12000):
    """Read official Valve Dota 2 / CS2 GSI telemetry if fresh and not in standby."""
    try:
        if not os.path.exists(GSI_FILE):
            return None
        with open(GSI_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict) or data.get('isStandby'):
            return None
        ts = int(data.get('timestamp') or 0)
        now_ms = int(time.time() * 1000)
        if ts <= 0 or (now_ms - ts) > max_age_ms:
            return None
        return data
    except Exception:
        return None


def _read_env_gemini_key() -> str:
    env_key = os.environ.get('GEMINI_API_KEY', '').strip()
    if env_key:
        return env_key
    try:
        env_file = os.path.join(ROOT, '.env.local')
        if os.path.exists(env_file):
            with open(env_file, 'r', encoding='utf-8') as ef:
                for line in ef:
                    line = line.strip()
                    if line.startswith('GEMINI_API_KEY='):
                        return line.split('=', 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return ''


def get_active_ai_vision_config():
    """Resolve active AI Vision provider (none | gemini | ollama | openrouter | openai-compat)."""
    try:
        data = {}
        if os.path.exists(USER_INTEGRATIONS_FILE):
            with open(USER_INTEGRATIONS_FILE, 'r', encoding='utf-8') as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    data = loaded

        ai_cfg = data.get('aiVision') if isinstance(data.get('aiVision'), dict) else {}
        gem_cfg = data.get('gemini') if isinstance(data.get('gemini'), dict) else {}

        provider = str(ai_cfg.get('provider') or '').strip().lower()
        if not provider:
            # Backward-compat with v2 config format
            provider = 'gemini' if gem_cfg.get('enabled') else 'none'

        # If no explicit choice in integrations file yet, allow .env.local GEMINI_API_KEY bootstrap
        if provider == 'none' and not ai_cfg.get('provider'):
            env_key = _read_env_gemini_key()
            if len(env_key) > 10:
                return {
                    'provider': 'gemini',
                    'apiKey': env_key,
                    'baseUrl': 'https://generativelanguage.googleapis.com',
                    'model': str(gem_cfg.get('model') or 'gemini-3.5-flash-lite'),
                    'intervalSec': int(gem_cfg.get('intervalSec') or 12),
                }
            return None

        if provider == 'none':
            return None

        interval_sec = int(ai_cfg.get('intervalSec') or gem_cfg.get('intervalSec') or 12)
        if provider == 'gemini':
            key = str(ai_cfg.get('apiKey') or gem_cfg.get('apiKey') or _read_env_gemini_key()).strip()
            if len(key) < 10:
                return None
            model_name = str(ai_cfg.get('model') or gem_cfg.get('model') or 'gemini-3.5-flash-lite').strip()
            if '2.5' in model_name or '2.0' in model_name or not model_name:
                model_name = 'gemini-3.5-flash-lite'
            return {
                'provider': 'gemini',
                'apiKey': key,
                'baseUrl': 'https://generativelanguage.googleapis.com',
                'model': model_name,
                'intervalSec': max(8, interval_sec),
            }

        if provider == 'ollama':
            base_url = str(ai_cfg.get('baseUrl') or 'http://127.0.0.1:11434/v1').strip().rstrip('/')
            model_name = str(ai_cfg.get('model') or 'qwen3-vl:2b').strip()
            if not base_url or not model_name:
                return None
            return {
                'provider': 'ollama',
                'apiKey': str(ai_cfg.get('apiKey') or 'ollama').strip(),
                'baseUrl': base_url,
                'model': model_name,
                'intervalSec': max(5, interval_sec),
            }

        # openrouter | openai-compat
        default_url = 'https://openrouter.ai/api/v1' if provider == 'openrouter' else 'http://127.0.0.1:1234/v1'
        base_url = str(ai_cfg.get('baseUrl') or default_url).strip().rstrip('/')
        key = str(ai_cfg.get('apiKey') or '').strip()
        model_name = str(ai_cfg.get('model') or ('google/gemini-2.5-flash-lite' if provider == 'openrouter' else '')).strip()
        if not base_url or not model_name or (provider == 'openrouter' and len(key) < 8):
            return None
        return {
            'provider': provider,
            'apiKey': key,
            'baseUrl': base_url,
            'model': model_name,
            'intervalSec': max(6, interval_sec),
        }
    except Exception:
        return None


def extract_json_payload(raw_text: str):
    """Parse JSON object from model output, stripping <think> tags or markdown fences."""
    if not raw_text:
        return None
    cleaned = re.sub(r'<think>[\s\S]*?</think>', '', raw_text, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        m = re.search(r'\{[\s\S]*\}', cleaned)
        if m:
            try:
                parsed = json.loads(m.group(0))
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                return None
    return None


def call_openai_compat_vision(cfg: dict, jpeg_bytes: bytes, prompt: str):
    """Call Ollama native /api/chat or OpenRouter/OpenAI-compatible /chat/completions with a frame."""
    provider = cfg.get('provider')
    base_url = str(cfg.get('baseUrl') or '').rstrip('/')
    model_name = str(cfg.get('model') or '').strip()
    api_key = str(cfg.get('apiKey') or '').strip()
    b64_img = base64.b64encode(jpeg_bytes).decode('ascii')

    headers = {'Content-Type': 'application/json'}
    if provider == 'ollama':
        root_url = base_url[:-3] if base_url.endswith('/v1') else base_url
        endpoint = f'{root_url}/api/chat'
        payload = {
            'model': model_name,
            'stream': False,
            'think': False,
            'format': 'json',
            'options': {'temperature': 0.4, 'num_predict': 350},
            'messages': [
                {'role': 'user', 'content': prompt, 'images': [b64_img]}
            ],
        }
    else:
        endpoint = f'{base_url}/chat/completions' if not base_url.endswith('/chat/completions') else base_url
        if api_key:
            headers['Authorization'] = f'Bearer {api_key}'
        if provider == 'openrouter':
            headers['HTTP-Referer'] = 'https://github.com/maratello1/gamemusick'
            headers['X-Title'] = 'GameMusick Director'
        payload = {
            'model': model_name,
            'temperature': 0.5,
            'max_tokens': 380,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{b64_img}'}},
                    ],
                }
            ],
        }

    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=22) as resp:
        body = json.loads(resp.read().decode('utf-8'))

    if provider == 'ollama':
        raw_content = ((body.get('message') or {}).get('content')) or ''
    else:
        choices = body.get('choices') or []
        raw_content = (((choices[0] if choices else {}).get('message') or {}).get('content')) or ''
    return extract_json_payload(raw_content)


def compute_frame_visual_delta(prev_thumb, cur_thumb) -> float:
    """Mean grayscale difference (0..255) on tiny 48x27 frame thumbnails to gate duplicate API calls."""
    if prev_thumb is None or cur_thumb is None:
        return 255.0
    try:
        diff_img = ImageChops.difference(cur_thumb, prev_thumb)
        return float(ImageStat.Stat(diff_img).mean[0])
    except Exception:
        return 255.0


def should_trigger_gemini_vision(
    now_ms: int,
    last_call_ms: int,
    backoff_until_ms: int,
    interval_ms: int,
    visual_delta: float,
    scene_tag: str,
    last_gemini_tag: str,
    dialogue_text: str,
    last_dialogue_sent: str,
) -> bool:
    """Send frames to Gemini only on meaningful scene/dialogue changes or a 45s static heartbeat."""
    if now_ms < backoff_until_ms:
        return False
    min_cooldown_ms = max(8000, interval_ms)
    elapsed_ms = now_ms - last_call_ms
    if last_call_ms > 0 and elapsed_ms < min_cooldown_ms:
        return False
    if last_call_ms == 0 or visual_delta >= 7.5:
        return True
    if scene_tag != last_gemini_tag:
        return True
    if dialogue_text and dialogue_text != last_dialogue_sent:
        return True
    heartbeat_ms = max(45000, interval_ms * 4)
    return elapsed_ms >= heartbeat_ms


async def run_director():
    print('[LocalDirector] Starting Hybrid Local & Cloud Vision Director...', flush=True)

    gemini_client = None
    last_gemini_key = ''
    last_gemini_call_ms = 0
    gemini_backoff_until_ms = 0
    gemini_backoff_sec = 0
    prev_gemini_thumb = None
    last_gemini_tag = ''
    last_dialogue_sent = ''
    cached_gemini_picks = []
    cached_gemini_summary = ''
    cached_gemini_meta = {}
    last_vision_proc = ''
    prev_emitted_tag = 'explore_wander'
    last_change_music_ms = 0

    last_game_info = {
        'process': "Ожидание игры",
        'title': "Ожидание игры",
        'last_seen': 0
    }

    combat_presses_history = [0] * 8
    history_idx = 0
    prev_keys = [False] * 256

    last_combat_ms = 0
    combat_streak_start_ms = 0
    last_boss_ms = 0
    last_stealth_ms = 0
    last_cutscene_ms = 0
    last_room_wipe_ms = 0
    black_screen_streak = 0
    letterbox_streak = 0
    boss_bar_streak = 0

    active_vibe = 'EXPLORE'
    active_scene_type = 'exploration'
    scene_label = 'Спокойное исследование'

    last_dialogue_text = ''
    dialogue_hold_until = 0.0

    while True:
        try:
            now_ms = int(time.time() * 1000)

            # 1. Foreground Game Detection
            game = get_foreground_game()
            if game:
                last_game_info['process'] = game['process']
                last_game_info['title'] = game['title']
                last_game_info['last_seen'] = time.time()
                game_rect = game['rect']
            else:
                if time.time() - last_game_info.get('last_seen', 0) > 6:
                    last_game_info['process'] = "Ожидание игры"
                    last_game_info['title'] = "Ожидание игры"
                game_rect = (0, 0, user32.GetSystemMetrics(0), user32.GetSystemMetrics(1))

            game_title = last_game_info['title']
            game_proc = last_game_info['process']

            if game_proc == "Ожидание игры":
                # Standby mode: no game is running! Keep audio peaceful, no phantom triggers
                director_payload = {
                    'timestamp': now_ms,
                    'ok': True,
                    'process': 'Ожидание игры',
                    'game': 'Ожидание игры',
                    'sceneType': 'standby',
                    'sceneTag': 'standby',
                    'vibe': 'EXPLORE',
                    'mood': 'calm ambient',
                    'energy': 12,
                    'tension': 8,
                    'valence': 10,
                    'location': 'Рабочий стол',
                    'summary': 'Ожидание запуска игры...',
                    'onScreenText': '',
                    'musicStyle': 'ambient relaxing soundtrack',
                    'changeMusic': False,
                    'picks': [],
                    'hasGeminiVision': False
                }
                dialogue_payload = {
                    'timestamp': now_ms,
                    'text': '',
                    'emotion': 'NONE',
                    'label': 'Ожидание игры',
                    'isDialogueActive': False
                }
                with open(SCENE_DIRECTOR_TMP, 'w', encoding='utf-8') as f:
                    json.dump(director_payload, f, ensure_ascii=False)
                os.replace(SCENE_DIRECTOR_TMP, SCENE_DIRECTOR_FILE)
                with open(DIALOGUE_TMP, 'w', encoding='utf-8') as f:
                    json.dump(dialogue_payload, f, ensure_ascii=False)
                os.replace(DIALOGUE_TMP, DIALOGUE_FILE)
                await asyncio.sleep(1.0)
                continue

            # 2. Key Action Sampling (250ms window: 5 checks x 50ms)
            tick_presses = 0
            crouch_held = False
            for _ in range(5):
                for vk in ATTACK_VKEYS:
                    is_down = bool(user32.GetAsyncKeyState(vk) & 0x8000)
                    if is_down and not prev_keys[vk]:
                        tick_presses += 1
                    prev_keys[vk] = is_down
                # Check Stealth/Crouch keys: Left Ctrl (0x11 / 0xA2) or 'C' (0x43)
                if bool(user32.GetAsyncKeyState(0x11) & 0x8000) or bool(user32.GetAsyncKeyState(0x43) & 0x8000):
                    crouch_held = True
                await asyncio.sleep(0.05)

            combat_presses_history[history_idx] = tick_presses
            history_idx = (history_idx + 1) % len(combat_presses_history)
            total_presses_2s = sum(combat_presses_history)

            # 3. Visual Sampling: Letterbox, Screen Luminance & Boss HP Bar
            is_letterbox, center_luma = sample_cinematic_bars_and_luma(game_rect)
            if is_letterbox:
                letterbox_streak += 1
            else:
                letterbox_streak = 0
            sustained_letterbox = (letterbox_streak >= 3)

            has_boss_bar = detect_boss_healthbar(game_rect) if center_luma > 10 else False
            if has_boss_bar:
                boss_bar_streak += 1
            else:
                boss_bar_streak = max(0, boss_bar_streak - 1)
            sustained_boss_bar = (boss_bar_streak >= 2)

            # Screen wipe / Room transition (fade to black)
            if center_luma <= 3:
                black_screen_streak += 1
            else:
                if 1 <= black_screen_streak <= 6:
                    last_room_wipe_ms = now_ms
                black_screen_streak = 0

            # 4. OCR Dialogue & Subtitle Context (Lower 22% crop)
            dialogue_text = ''
            dialogue_emotion = ''
            is_dialogue_active = False

            fg_hwnd = user32.GetForegroundWindow()
            is_game_foreground = bool(game and fg_hwnd == game.get('hwnd'))
            is_online = is_online_competitive_game(game_proc)

            # Story dialogue OCR ONLY runs on foreground single-player story games!
            # Online competitive games (Dota 2, CS2) have no story cutscene dialogue.
            # Background windows must never be OCR-ed to avoid capturing music player UI!
            if HAS_WINOCR and is_game_foreground and not is_online and not sustained_letterbox and center_luma > 8:
                # Check subtitles area
                sub_crop = grab_window_crop(game_rect, 0.12, 0.72, 0.76, 0.22)
                t_en = await ocr_crop(sub_crop, 'en-US')
                if is_valid_dialogue_text(t_en):
                    dialogue_text = t_en
                else:
                    t_ru = await ocr_crop(sub_crop, 'ru')
                    if is_valid_dialogue_text(t_ru):
                        dialogue_text = t_ru

            if is_valid_dialogue_text(dialogue_text):
                dialogue_emotion, d_label, ocr_scene_tag = analyze_text_sentiment(dialogue_text)
                dialogue_hold_until = time.time() + 9.0
                is_dialogue_active = True
                last_dialogue_text = dialogue_text
                scene_label = f"{d_label}: \"{dialogue_text[:52]}\""
            elif time.time() < dialogue_hold_until and last_dialogue_text and not is_online and is_valid_dialogue_text(last_dialogue_text):
                is_dialogue_active = True
                dialogue_text = last_dialogue_text
                _, _, ocr_scene_tag = analyze_text_sentiment(last_dialogue_text)
            else:
                last_dialogue_text = ''
                dialogue_text = ''
                is_dialogue_active = False
                ocr_scene_tag = ''

            if is_dialogue_active or sustained_letterbox:
                last_cutscene_ms = now_ms

            # 5. Multi-Dimensional Scene Vector State Machine
            fresh_sensor = read_fresh_sensor()
            sensor_motion = int(fresh_sensor.get('motionDelta', 16)) if fresh_sensor else 16
            sensor_red = int(fresh_sensor.get('redAlertRatio', 0)) if fresh_sensor else 0
            sensor_hint = str(fresh_sensor.get('sceneHint', '') or '') if fresh_sensor else ''

            combat_threshold = 10 if is_online else 3
            is_fighting = (total_presses_2s >= combat_threshold) or (sensor_hint in ('COMBAT', 'TEAMFIGHT', 'BOSSFIGHT'))
            if is_fighting:
                if combat_streak_start_ms == 0:
                    combat_streak_start_ms = now_ms
                last_combat_ms = now_ms
            elif now_ms - last_combat_ms > 8000:
                combat_streak_start_ms = 0

            combat_duration_ms = (now_ms - combat_streak_start_ms) if combat_streak_start_ms > 0 else 0
            is_boss_escalated = (
                not is_online and (
                    (is_fighting and sustained_boss_bar)
                    or (combat_duration_ms > 32000 and total_presses_2s >= 5)
                    or sensor_hint == 'BOSSFIGHT'
                )
            )
            if is_boss_escalated:
                last_boss_ms = now_ms

            if crouch_held and not is_fighting and center_luma < 45:
                last_stealth_ms = now_ms

            in_boss_hold = not is_online and (now_ms - last_boss_ms < 22000)
            in_combat_hold = (now_ms - last_combat_ms < (6000 if is_online else 18000))
            in_stealth_hold = not is_online and (now_ms - last_stealth_ms < 14000)
            in_cutscene_hold = not is_online and (now_ms - last_cutscene_ms < 12000)
            is_recent_room_change = not is_online and (now_ms - last_room_wipe_ms < 10000)

            scene_tag = 'menu_lobby' if is_online else 'explore_wander'
            est_energy = sensor_motion
            est_tension = max(12, int(sensor_motion * 0.65 + sensor_red * 0.5))
            est_valence = 15 if center_luma >= 40 else -15

            if sensor_hint == 'RESPAWN':
                active_vibe = 'DRAMA'
                active_scene_type = 'respawn'
                scene_tag = 'respawn_downtime'
                scene_label = 'Респавн / Наблюдение'
                est_energy, est_tension, est_valence = 18, 22, -20
            elif is_boss_escalated or in_boss_hold:
                active_vibe = 'BOSSFIGHT'
                active_scene_type = 'boss_battle'
                scene_tag = 'boss_climax'
                scene_label = 'Битва с Боссом / Кульминация'
                est_energy, est_tension, est_valence = max(88, sensor_motion), 95, -25
            elif sensor_hint == 'CHASE_ESCAPE':
                active_vibe = 'COMBAT'
                active_scene_type = 'chase_escape'
                scene_tag = 'chase_escape'
                scene_label = 'Погоня / Побег'
                est_energy, est_tension, est_valence = max(80, sensor_motion), 92, -45
            elif is_fighting or in_combat_hold:
                active_vibe = 'COMBAT'
                active_scene_type = 'combat'
                scene_tag = 'teamfight_clash' if is_online else 'skirmish_combat'
                scene_label = 'Массовый замес / Клатч' if is_online else 'Стычка / Боевой экшен'
                est_energy = max(72 if not is_online else 80, sensor_motion)
                est_tension = max(68, est_tension)
                est_valence = -15
            elif is_recent_room_change or ocr_scene_tag == 'vista_wonder':
                active_vibe = 'MAJESTIC'
                active_scene_type = 'new_location'
                scene_tag = 'vista_wonder'
                scene_label = 'Панорама / Открытие локации'
                est_energy, est_tension, est_valence = 44, 25, 76
            elif ocr_scene_tag in ('menu_lobby', 'cozy_hub', 'horror_dread', 'victory_triumph'):
                scene_tag = ocr_scene_tag
                active_scene_type = ocr_scene_tag
                if ocr_scene_tag == 'victory_triumph':
                    active_vibe = 'VICTORY'
                    est_energy, est_tension, est_valence = 64, 20, 92
                elif ocr_scene_tag == 'horror_dread':
                    active_vibe = 'STEALTH'
                    est_energy, est_tension, est_valence = 26, 86, -80
                elif ocr_scene_tag == 'cozy_hub':
                    active_vibe = 'EXPLORE'
                    est_energy, est_tension, est_valence = 18, 10, 60
                else:
                    active_vibe = 'EXPLORE'
                    est_energy, est_tension, est_valence = 22, 18, 8
            elif in_cutscene_hold:
                active_vibe = dialogue_emotion if dialogue_emotion in ['DRAMA', 'MAJESTIC', 'COMBAT'] else 'DRAMA'
                active_scene_type = 'cutscene'
                scene_tag = 'tragedy_drama' if active_vibe == 'DRAMA' and dialogue_text else 'dialogue_story'
                if not is_dialogue_active:
                    scene_label = 'Сюжетная катсцена / Диалог'
                est_energy, est_tension, est_valence = 22, 48 if scene_tag == 'tragedy_drama' else 36, -65 if scene_tag == 'tragedy_drama' else -10
            elif in_stealth_hold or sensor_hint in ('STEALTH', 'HORROR_DREAD'):
                active_vibe = 'STEALTH'
                is_horror = (sensor_hint == 'HORROR_DREAD') or (center_luma < 24 and sensor_red > 10)
                scene_tag = 'horror_dread' if is_horror else 'stealth_infiltrate'
                active_scene_type = scene_tag
                scene_label = 'Хоррор / Саспенс' if is_horror else 'Скрытное проникновение'
                est_energy, est_tension, est_valence = 28, 82 if is_horror else 68, -75 if is_horror else -35
            elif sensor_hint == 'MENU_LOBBY' or is_online:
                active_vibe = 'EXPLORE'
                active_scene_type = 'menu_lobby'
                scene_tag = 'menu_lobby'
                scene_label = 'Меню / Лобби / Подготовка'
                est_energy, est_tension, est_valence = 22, 18, 8
            else:
                active_vibe = 'EXPLORE'
                active_scene_type = 'exploration'
                scene_tag = 'cozy_hub' if sensor_hint == 'COZY_HUB' else 'explore_wander'
                scene_label = 'Мирное убежище' if scene_tag == 'cozy_hub' else 'Атмосферное исследование'
                est_energy, est_tension, est_valence = max(18, sensor_motion), 22, 30 if scene_tag == 'cozy_hub' else 15

            # 6. Dynamic Music Style & Recommendations
            music_style_map = {
                'menu_lobby': f"{game_title} main menu lobby atmospheric synth ambient",
                'cozy_hub': f"{game_title} peaceful tavern sanctuary acoustic ambient ost",
                'explore_wander': f"{game_title} ambient exploration soundtrack atmospheric",
                'vista_wonder': f"{game_title} majestic vista orchestral wonder theme ost",
                'horror_dread': f"{game_title} horror dread dark eerie suspense drone ost",
                'stealth_infiltrate': f"{game_title} stealth espionage dark minimal tension",
                'dialogue_story': f"{game_title} emotional story dialogue piano strings ost",
                'tragedy_drama': f"{game_title} tragic sorrowful cello dramatic requiem ost",
                'respawn_downtime': "chill downtempo reflective lo-fi break",
                'skirmish_combat': f"{game_title} dynamic combat battle action theme ost",
                'teamfight_clash': f"{game_title} intense clash competitive adrenaline theme",
                'chase_escape': f"{game_title} frantic chase escape countdown synth ost",
                'boss_climax': f"{game_title} epic choir boss battle orchestral climax ost",
                'victory_triumph': f"{game_title} victory fanfare triumphant heroic theme ost",
            }
            rec_style = music_style_map.get(scene_tag, f"{game_title} ambient ost")

            # 6a. Official Game State Integration (Dota 2 / CS2) ground-truth override (0 Vision quota spent)
            gsi_snapshot = read_fresh_gsi()
            if gsi_snapshot:
                if gsi_snapshot.get('sceneTag'):
                    scene_tag = str(gsi_snapshot['sceneTag']).strip().lower()
                if gsi_snapshot.get('vibe'):
                    active_vibe = str(gsi_snapshot['vibe'])
                if gsi_snapshot.get('phase'):
                    active_scene_type = str(gsi_snapshot['phase'])
                if isinstance(gsi_snapshot.get('energy'), (int, float)):
                    est_energy = int(max(0, min(100, gsi_snapshot['energy'])))
                if isinstance(gsi_snapshot.get('tension'), (int, float)):
                    est_tension = int(max(0, min(100, gsi_snapshot['tension'])))
                if isinstance(gsi_snapshot.get('valence'), (int, float)):
                    est_valence = int(max(-100, min(100, gsi_snapshot['valence'])))
                if gsi_snapshot.get('summary'):
                    scene_label = str(gsi_snapshot['summary'])
                rec_style = music_style_map.get(scene_tag, rec_style)
                cached_gemini_summary = ''
                cached_gemini_meta = {}

            # 6b. Optional: Universal AI Vision Director (Gemini / Ollama / OpenRouter / OpenAI-compatible)
            ai_cfg = get_active_ai_vision_config()
            active_audio_mode = get_active_audio_mode()
            gemini_requested_change = False

            if last_vision_proc != game_proc or not ai_cfg:
                cached_gemini_picks = []
                cached_gemini_summary = ''
                cached_gemini_meta = {}
                last_vision_proc = game_proc

            if ai_cfg and not gsi_snapshot:
                ai_provider = ai_cfg.get('provider', 'gemini')
                if ai_provider == 'gemini':
                    if gemini_client is None or ai_cfg.get('apiKey') != last_gemini_key:
                        try:
                            from google import genai
                            gemini_client = genai.Client(api_key=ai_cfg['apiKey'])
                            last_gemini_key = ai_cfg['apiKey']
                            print(f"[LocalDirector] Google Gemini Vision activated ({ai_cfg.get('model')})!", flush=True)
                        except Exception as ex:
                            print(f'[LocalDirector] Gemini init: {ex}', flush=True)

                provider_ready = (gemini_client is not None) if ai_provider == 'gemini' else True
                interval_ms = int(ai_cfg.get('intervalSec', 12)) * 1000
                # Smart quota-saving trigger: analyze only on real scene/dialogue changes + heartbeat
                if provider_ready and is_game_foreground and center_luma > 6 and now_ms >= gemini_backoff_until_ms:
                    if last_gemini_call_ms == 0 or (now_ms - last_gemini_call_ms) >= max(5000 if ai_provider == 'ollama' else 8000, interval_ms):
                        full_frame = grab_window_crop(game_rect, 0.0, 0.0, 1.0, 1.0)
                        cur_thumb = full_frame.convert('L').resize((48, 27), Image.Resampling.BILINEAR)
                        v_delta = compute_frame_visual_delta(prev_gemini_thumb, cur_thumb)
                        if should_trigger_gemini_vision(
                            now_ms=now_ms,
                            last_call_ms=last_gemini_call_ms,
                            backoff_until_ms=gemini_backoff_until_ms,
                            interval_ms=interval_ms,
                            visual_delta=v_delta,
                            scene_tag=scene_tag,
                            last_gemini_tag=last_gemini_tag,
                            dialogue_text=dialogue_text,
                            last_dialogue_sent=last_dialogue_sent,
                        ):
                            last_gemini_call_ms = now_ms
                            last_gemini_tag = scene_tag
                            last_dialogue_sent = dialogue_text
                            prev_gemini_thumb = cur_thumb
                            try:
                                full_frame.thumbnail((640, 640))
                                b = io.BytesIO()
                                full_frame.save(b, format='JPEG', quality=60)
                                jpeg_bytes = b.getvalue()

                                fav_artists, fav_genres = get_user_favorite_artists()
                                if active_audio_mode == 'custom' and fav_artists:
                                    taste_rule = (
                                        f"PLAYER MODE IS 'MY ARTISTS'. You MUST ONLY pick real tracks by the user's favorite artists ({', '.join(fav_artists[:6])}) "
                                        f"or genres ({', '.join(fav_genres[:4])}) whose musical mood matches this game scene! NEVER pick game OSTs."
                                    )
                                else:
                                    taste_rule = (
                                        f"PLAYER MODE IS 'GAME VIBE & AMBIENT'. Pick fitting atmospheric tracks or OSTs/soundtracks matching this exact scene. "
                                        f"{('Blend seamlessly with tastes: ' + ', '.join(fav_artists[:3])) if fav_artists else ''}"
                                    )

                                prompt = (
                                    f'Analyze gameplay screenshot for "{game_title}". Subtitles: "{dialogue_text}". {taste_rule} '
                                    'Do NOT squeeze into 6 generic moods — describe the exact nuance (e.g. menu_lobby, cozy_hub, horror_dread, stealth_infiltrate, chase_escape, vista_wonder, skirmish_combat, boss_climax, tragedy_drama, dialogue_story, victory_triumph, or custom snake_case tag). '
                                    'Return strict JSON only: {"sceneTag": string, "sceneType": string, "mood": "2-4 English mood words", "summary": "1 concise Russian sentence", '
                                    '"location": "short location in Russian", "energy": 0..100 int, "tension": 0..100 int, "valence": -100..100 int, '
                                    '"musicStyle": "specific English musical instrumentation & tempo brief", "changeMusic": bool, "picks": [{"artist": str, "title": str}] (5 tracks)}.'
                                )

                                parsed_g = None
                                if ai_provider == 'gemini':
                                    from google.genai import types
                                    model_name = str(ai_cfg.get('model') or 'gemini-3.5-flash-lite').strip()
                                    def _call_gemini():
                                        return gemini_client.models.generate_content(
                                            model=model_name,
                                            contents=[
                                                types.Part.from_bytes(data=jpeg_bytes, mime_type='image/jpeg'),
                                                prompt,
                                            ],
                                            config=types.GenerateContentConfig(
                                                response_mime_type='application/json',
                                                temperature=0.6,
                                            ),
                                        )
                                    resp = await asyncio.to_thread(_call_gemini)
                                    if getattr(resp, 'text', None):
                                        parsed_g = extract_json_payload(resp.text)
                                else:
                                    parsed_g = await asyncio.to_thread(call_openai_compat_vision, ai_cfg, jpeg_bytes, prompt)

                                gemini_backoff_sec = 0
                                if isinstance(parsed_g, dict):
                                    if parsed_g.get('summary'):
                                        cached_gemini_summary = parsed_g['summary']
                                    if isinstance(parsed_g.get('picks'), list):
                                        cached_gemini_picks = parsed_g['picks'][:5]
                                    cached_gemini_meta = {
                                        'sceneTag': parsed_g.get('sceneTag'),
                                        'sceneType': parsed_g.get('sceneType'),
                                        'mood': parsed_g.get('mood'),
                                        'location': parsed_g.get('location'),
                                        'energy': parsed_g.get('energy'),
                                        'tension': parsed_g.get('tension'),
                                        'valence': parsed_g.get('valence'),
                                        'musicStyle': parsed_g.get('musicStyle'),
                                    }
                                    gemini_requested_change = bool(parsed_g.get('changeMusic', False))
                            except urllib.error.HTTPError as http_err:
                                if http_err.code == 429:
                                    gemini_backoff_sec = 60 if gemini_backoff_sec == 0 else min(300, gemini_backoff_sec * 2)
                                    gemini_backoff_until_ms = now_ms + gemini_backoff_sec * 1000
                                    print(f'[LocalDirector] {ai_provider} rate limit 429, cooling {gemini_backoff_sec}s', flush=True)
                                else:
                                    print(f'[LocalDirector] {ai_provider} HTTP {http_err.code}', flush=True)
                            except Exception as ex:
                                err_str = str(ex)
                                if '429' in err_str or 'RESOURCE_EXHAUSTED' in err_str or 'quota' in err_str.lower():
                                    gemini_backoff_sec = 60 if gemini_backoff_sec == 0 else min(300, gemini_backoff_sec * 2)
                                    gemini_backoff_until_ms = now_ms + gemini_backoff_sec * 1000
                                    print(f'[LocalDirector] {ai_provider} quota 429, cooling down {gemini_backoff_sec}s (local AI stays active)', flush=True)
                                else:
                                    print(f'[LocalDirector] {ai_provider} ping: {err_str[:160]}', flush=True)

            # Merge AI Vision rich scene vector when GSI is inactive and hardware combat isn't overriding
            if not gsi_snapshot and ai_cfg and cached_gemini_meta and not is_fighting and not is_boss_escalated:
                if cached_gemini_meta.get('sceneTag'):
                    scene_tag = str(cached_gemini_meta['sceneTag']).strip().lower().replace(' ', '_')[:40]
                if cached_gemini_meta.get('sceneType'):
                    active_scene_type = str(cached_gemini_meta['sceneType'])
                if cached_gemini_meta.get('musicStyle'):
                    rec_style = str(cached_gemini_meta['musicStyle'])
                if isinstance(cached_gemini_meta.get('energy'), (int, float)):
                    est_energy = int(max(0, min(100, cached_gemini_meta['energy'])))
                if isinstance(cached_gemini_meta.get('tension'), (int, float)):
                    est_tension = int(max(0, min(100, cached_gemini_meta['tension'])))
                if isinstance(cached_gemini_meta.get('valence'), (int, float)):
                    est_valence = int(max(-100, min(100, cached_gemini_meta['valence'])))

            should_change_music = gemini_requested_change or (
                scene_tag != prev_emitted_tag and (now_ms - last_change_music_ms > (2500 if gsi_snapshot else 5000))
            )
            if should_change_music:
                prev_emitted_tag = scene_tag
                last_change_music_ms = now_ms

            final_summary = cached_gemini_summary if (cached_gemini_summary and not dialogue_text and not gsi_snapshot) else scene_label

            # 7. Write Payloads Atomically
            director_payload = {
                'timestamp': now_ms,
                'ok': True,
                'process': game_proc,
                'game': game_title,
                'sceneType': active_scene_type,
                'sceneTag': scene_tag,
                'vibe': active_vibe,
                'mood': cached_gemini_meta.get('mood') or f"{scene_tag.replace('_', ' ')} mood",
                'energy': est_energy,
                'tension': est_tension,
                'valence': est_valence,
                'location': ('Dota 2 / CS2 (GSI)' if gsi_snapshot else (cached_gemini_meta.get('location') or 'Игровой мир')),
                'summary': final_summary,
                'onScreenText': dialogue_text,
                'musicStyle': rec_style,
                'changeMusic': should_change_music,
                'picks': cached_gemini_picks,
                'hasGeminiVision': bool(ai_cfg),
                'aiProvider': ('gsi' if gsi_snapshot else (ai_cfg.get('provider') if ai_cfg else 'none')),
                'gsiActive': bool(gsi_snapshot),
            }

            dialogue_payload = {
                'timestamp': now_ms,
                'text': dialogue_text,
                'emotion': dialogue_emotion or 'NONE',
                'label': scene_label,
                'isDialogueActive': is_dialogue_active
            }

            with open(SCENE_DIRECTOR_TMP, 'w', encoding='utf-8') as f:
                json.dump(director_payload, f, ensure_ascii=False)
            os.replace(SCENE_DIRECTOR_TMP, SCENE_DIRECTOR_FILE)

            with open(DIALOGUE_TMP, 'w', encoding='utf-8') as f:
                json.dump(dialogue_payload, f, ensure_ascii=False)
            os.replace(DIALOGUE_TMP, DIALOGUE_FILE)

        except Exception as e:
            print(f"[LocalDirector] Exception in loop: {e}", flush=True)
            await asyncio.sleep(0.5)


if __name__ == '__main__':
    kernel32.CreateMutexA.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCSTR]
    kernel32.CreateMutexA.restype = wintypes.HANDLE
    _h_mutex = kernel32.CreateMutexA(None, False, b"Local\\GameMusick_Director_Instance_Mutex")
    if kernel32.GetLastError() == 183:
        sys.exit(0)
    asyncio.run(run_director())
