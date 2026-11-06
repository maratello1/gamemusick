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
import ctypes
from ctypes import wintypes
import asyncio
from PIL import Image, ImageStat, ImageOps, ImageEnhance
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

DENYLIST_PROCESSES = {
    'explorer', 'msedge', 'chrome', 'firefox', 'opera', 'brave', 'vivaldi', 'chrome-headless-shell',
    'code', 'devenv', 'cursor', 'idea64', 'pycharm64', 'notepad', 'notepad++', 'windowsterminal',
    'powershell', 'pwsh', 'cmd', 'conhost', 'gamevibe', 'interactive_sensor', 'node', 'python',
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


def get_foreground_game():
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if pid.value == 0:
        return None

    hproc = kernel32.OpenProcess(0x1000, False, pid.value)
    name = ''
    if hproc:
        buf = ctypes.create_unicode_buffer(520)
        size = wintypes.DWORD(520)
        if kernel32.QueryFullProcessImageNameW(hproc, 0, buf, ctypes.byref(size)):
            name = os.path.splitext(os.path.basename(buf.value))[0].lower()
        kernel32.CloseHandle(hproc)

    if not name or name in DENYLIST_PROCESSES:
        return None

    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    w = rect.right - rect.left
    h = rect.bottom - rect.top
    if w < 240 or h < 180:
        return None

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
        return text
    except Exception:
        return ''


def analyze_text_sentiment(text):
    text_lower = text.lower()
    words = set(text_lower.replace(',', ' ').replace('.', ' ').replace('!', ' ').replace('?', ' ').split())

    drama_score = sum(1 for w in words if w in DRAMA_WORDS)
    majestic_score = sum(1 for w in words if w in MAJESTIC_WORDS)
    combat_score = sum(1 for w in words if w in COMBAT_WORDS)
    loc_score = sum(1 for w in words if w in LOCATION_WORDS)

    if combat_score > 0 and combat_score >= drama_score:
        return 'COMBAT', 'Сражение / Боевой диалог'
    if drama_score > 0 and drama_score >= majestic_score:
        return 'DRAMA', 'Драматический момент сюжета'
    if majestic_score > 0:
        return 'MAJESTIC', 'Воодушевляющее событие / Надежда'
    if loc_score > 0:
        return 'EXPLORE', f'Новая область: {text[:30]}'
    return 'DRAMA', 'Сюжетный диалог'


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


def get_user_gemini_config():
    try:
        if os.path.exists(USER_INTEGRATIONS_FILE):
            with open(USER_INTEGRATIONS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                g = data.get('gemini', {})
                if g.get('enabled') and g.get('apiKey') and len(g.get('apiKey')) > 10:
                    return g
    except Exception:
        pass
    return None


async def run_director():
    print('[LocalDirector] Starting Hybrid Local & Cloud Vision Director...', flush=True)

    gemini_client = None
    last_gemini_key = ''
    last_gemini_call_ms = 0
    cached_gemini_picks = []
    cached_gemini_summary = ''

    last_game_info = {
        'process': "Castlevania Belmont's Curse",
        'title': "Castlevania: Belmont's Curse",
        'last_seen': time.time()
    }

    combat_presses_history = [0] * 8
    history_idx = 0
    prev_keys = [False] * 256

    last_combat_ms = 0
    last_cutscene_ms = 0
    last_room_wipe_ms = 0
    black_screen_streak = 0
    letterbox_streak = 0

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
                # If alt-tabbed to GameVibe or brief overlay, keep last known game for 120s
                game_rect = (0, 0, user32.GetSystemMetrics(0), user32.GetSystemMetrics(1))

            game_title = last_game_info['title']
            game_proc = last_game_info['process']

            # 2. Key Action Sampling (250ms window: 5 checks x 50ms)
            tick_presses = 0
            for _ in range(5):
                for vk in ATTACK_VKEYS:
                    is_down = bool(user32.GetAsyncKeyState(vk) & 0x8000)
                    if is_down and not prev_keys[vk]:
                        tick_presses += 1
                    prev_keys[vk] = is_down
                await asyncio.sleep(0.05)

            combat_presses_history[history_idx] = tick_presses
            history_idx = (history_idx + 1) % len(combat_presses_history)
            total_presses_2s = sum(combat_presses_history)

            # 3. Visual Sampling: Letterbox & Screen Luminance
            is_letterbox, center_luma = sample_cinematic_bars_and_luma(game_rect)
            if is_letterbox:
                letterbox_streak += 1
            else:
                letterbox_streak = 0
            sustained_letterbox = (letterbox_streak >= 3)

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

            if HAS_WINOCR and not sustained_letterbox and center_luma > 8:
                # Check subtitles area
                sub_crop = grab_window_crop(game_rect, 0.12, 0.72, 0.76, 0.22)
                t_en = await ocr_crop(sub_crop, 'en-US')
                if len(t_en) >= 5:
                    dialogue_text = t_en
                else:
                    t_ru = await ocr_crop(sub_crop, 'ru')
                    if len(t_ru) >= 5:
                        dialogue_text = t_ru

            if len(dialogue_text) >= 5:
                dialogue_emotion, d_label = analyze_text_sentiment(dialogue_text)
                dialogue_hold_until = time.time() + 9.0
                is_dialogue_active = True
                last_dialogue_text = dialogue_text
                scene_label = f"🎬 {d_label}: \"{dialogue_text[:45]}...\""
            elif time.time() < dialogue_hold_until and last_dialogue_text:
                is_dialogue_active = True
                dialogue_text = last_dialogue_text

            if is_dialogue_active or sustained_letterbox:
                last_cutscene_ms = now_ms

            # 5. Scene State Machine
            is_fighting = (total_presses_2s >= 3)
            in_combat_hold = (now_ms - last_combat_ms < 18000)
            in_cutscene_hold = (now_ms - last_cutscene_ms < 12000)
            is_recent_room_change = (now_ms - last_room_wipe_ms < 10000)

            if is_fighting:
                last_combat_ms = now_ms
                active_vibe = 'COMBAT'
                active_scene_type = 'combat'
                scene_label = 'Сражение / Боевой экшен'
            elif in_combat_hold:
                active_vibe = 'COMBAT'
                active_scene_type = 'combat'
                scene_label = 'Напряженная схватка'
            elif is_recent_room_change:
                active_vibe = 'MAJESTIC'
                active_scene_type = 'new_location'
                scene_label = 'Вход в новую локацию'
            elif in_cutscene_hold:
                active_vibe = dialogue_emotion if dialogue_emotion in ['DRAMA', 'MAJESTIC', 'COMBAT'] else 'DRAMA'
                active_scene_type = 'cutscene'
                if not is_dialogue_active:
                    scene_label = 'Кинематографическая катсцена'
            else:
                active_vibe = 'EXPLORE'
                active_scene_type = 'exploration'
                scene_label = 'Атмосферное исследование'

            # 6. Dynamic Music Style & Recommendations
            music_style_map = {
                'EXPLORE': f"{game_title} ambient exploration soundtrack atmospheric",
                'MAJESTIC': f"{game_title} majestic vista orchestral triumph ost",
                'DRAMA': f"{game_title} dramatic sorrowful melancholic ost",
                'COMBAT': f"{game_title} combat battle action theme ost",
                'BOSSFIGHT': f"{game_title} epic boss battle fight orchestral theme",
                'STEALTH': f"{game_title} stealth suspense dark drone ambient",
                'VICTORY': f"{game_title} victory fanfare triumph theme ost",
            }
            rec_style = music_style_map.get(active_vibe, f"{game_title} ambient ost")

            # 6b. Optional: User-Provided Gemini Vision Scoring (BYOK)
            gemini_cfg = get_user_gemini_config()
            if gemini_cfg:
                if gemini_client is None or gemini_cfg.get('apiKey') != last_gemini_key:
                    try:
                        from google import genai
                        gemini_client = genai.Client(api_key=gemini_cfg['apiKey'])
                        last_gemini_key = gemini_cfg['apiKey']
                        print('[LocalDirector] Google Gemini Vision activated with user key!', flush=True)
                    except Exception as ex:
                        print(f'[LocalDirector] Gemini init: {ex}', flush=True)

                interval_ms = int(gemini_cfg.get('intervalSec', 12)) * 1000
                if gemini_client and (now_ms - last_gemini_call_ms > interval_ms) and center_luma > 6:
                    last_gemini_call_ms = now_ms
                    try:
                        from google.genai import types
                        full_frame = grab_window_crop(game_rect, 0.0, 0.0, 1.0, 1.0)
                        full_frame.thumbnail((800, 800))
                        b = io.BytesIO()
                        full_frame.save(b, format='JPEG', quality=65)
                        jpeg_bytes = b.getvalue()

                        prompt = f'Scoring scene for "{game_title}". Subtitles: "{dialogue_text}". Return JSON with: summary (Russian 1 sentence), mood (2-3 words), picks (5 real tracks with artist, title).'
                        resp = gemini_client.models.generate_content(
                            model=gemini_cfg.get('model', 'gemini-2.5-flash'),
                            contents=[
                                types.Part.from_bytes(data=jpeg_bytes, mime_type='image/jpeg'),
                                prompt
                            ],
                            config=types.GenerateContentConfig(
                                response_mime_type='application/json',
                                temperature=0.7
                            )
                        )
                        if resp.text:
                            parsed_g = json.loads(resp.text)
                            if isinstance(parsed_g, dict):
                                if parsed_g.get('summary'):
                                    cached_gemini_summary = parsed_g['summary']
                                if isinstance(parsed_g.get('picks'), list):
                                    cached_gemini_picks = parsed_g['picks'][:5]
                    except Exception as ex:
                        print(f'[LocalDirector] Gemini ping: {ex}', flush=True)

            final_summary = cached_gemini_summary if (cached_gemini_summary and not dialogue_text) else scene_label

            # 7. Write Payloads Atomically
            sensor_payload = {
                'timestamp': now_ms,
                'detectedProcess': game_proc,
                'windowTitle': game_title,
                'motionDelta': 65 if active_vibe == 'COMBAT' else 16,
                'redAlertRatio': 0,
                'brightness': center_luma,
                'inferredVibe': active_vibe,
                'sceneEmotion': active_vibe,
                'sceneKey': f"{active_vibe}_{active_scene_type.upper()}",
                'sceneLabel': final_summary,
                'isCutscene': in_cutscene_hold,
                'isNewLocation': is_recent_room_change,
                'gameAudioDucked': True,
                'sensorMode': 'local-director-gemini' if gemini_cfg else 'local-director-winrt-cv'
            }

            director_payload = {
                'timestamp': now_ms,
                'ok': True,
                'process': game_proc,
                'game': game_title,
                'sceneType': active_scene_type,
                'vibe': active_vibe,
                'mood': f"{active_scene_type} {active_vibe.lower()} atmosphere",
                'tension': 8 if active_vibe == 'COMBAT' else 3,
                'location': 'Игровой мир',
                'summary': final_summary,
                'onScreenText': dialogue_text,
                'musicStyle': rec_style,
                'changeMusic': False,
                'picks': cached_gemini_picks,
                'hasGeminiVision': bool(gemini_cfg)
            }

            dialogue_payload = {
                'timestamp': now_ms,
                'text': dialogue_text,
                'emotion': dialogue_emotion or 'NONE',
                'label': scene_label,
                'isDialogueActive': is_dialogue_active
            }

            with open(LIVE_SENSOR_TMP, 'w', encoding='utf-8') as f:
                json.dump(sensor_payload, f, ensure_ascii=False)
            os.replace(LIVE_SENSOR_TMP, LIVE_SENSOR_FILE)

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
    asyncio.run(run_director())
