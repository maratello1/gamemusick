"""
GameVibe Vision Director.

Every few seconds takes a downscaled frame of the *foreground game window only*
and asks a Gemini vision model to understand the scene: location, mood, what is
happening (combat / dialogue / cutscene / exploration ...), whether the music that
is playing right now still fits, and which real released tracks would fit next.

Output: data/scene-director.json (consumed by /api/telemetry and the player).

Setup: put GEMINI_API_KEY=... into .env.local in the project root (file is gitignored).
Optional: GEMINI_MODEL (default gemini-2.5-flash), DIRECTOR_INTERVAL (default 10 sec).

Privacy: only the foreground window of a *non-denylisted* process is captured.
Browsers, editors, messengers, file manager etc. are never sent anywhere.
"""
import ctypes
import io
import json
import os
import sys
import time
from ctypes import wintypes
from typing import List, Literal

from PIL import Image, ImageChops, ImageStat
from pydantic import BaseModel, Field

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR = os.path.join(ROOT, 'data')
OUT_FILE = os.path.join(DATA_DIR, 'scene-director.json')
TMP_FILE = os.path.join(DATA_DIR, 'scene-director.tmp.json')
APP_STATE = os.path.join(DATA_DIR, 'app-state.json')

# Processes whose windows must NEVER be captured (privacy).
DENYLIST = {
    'chrome', 'msedge', 'firefox', 'opera', 'brave', 'vivaldi', 'chrome-headless-shell',
    'code', 'devenv', 'cursor', 'idea64', 'pycharm64', 'notepad', 'notepad++', 'explorer',
    'telegram', 'discord', 'slack', 'teams', 'whatsapp', 'outlook', 'thunderbird',
    'windowsterminal', 'powershell', 'cmd', 'conhost', 'electron', 'gamevibe', 'hydra',
    'searchhost', 'startmenuexperiencehost', 'shellhost', 'applicationframehost', 'taskmgr',
    '1password', 'keepass', 'bitwarden', 'mstsc', 'anydesk', 'teamviewer', 'ledkeeper2',
}


def load_env():
    path = os.path.join(ROOT, '.env.local')
    if os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


class MusicPick(BaseModel):
    artist: str
    title: str


class Scene(BaseModel):
    game: str = Field(description='Best guess of the game title, or "unknown"')
    scene_type: Literal[
        'combat', 'boss', 'dialogue', 'cutscene', 'exploration', 'safe_area',
        'menu', 'stealth', 'victory', 'tragedy',
    ]
    vibe: Literal['EXPLORE', 'MAJESTIC', 'DRAMA', 'COMBAT', 'BOSSFIGHT', 'STEALTH', 'VICTORY']
    mood: str = Field(description='2-4 english words, e.g. "lonely gothic dread"')
    tension: int = Field(ge=0, le=10)
    location: str = Field(description='Where the player is, short')
    summary: str = Field(description='One sentence in Russian: what is happening on screen')
    on_screen_text: str = Field(description='Readable subtitle/dialogue text, else empty')
    music_style: str = Field(description='Short english brief of the ideal music right now')
    change_music: bool = Field(
        description='True only if the currently playing track clearly no longer fits the scene'
    )
    picks: List[MusicPick] = Field(
        description='5 REAL, officially released tracks that fit this scene and this game world'
    )


user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
user32.GetForegroundWindow.restype = wintypes.HWND
kernel32.OpenProcess.restype = wintypes.HANDLE
kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
kernel32.QueryFullProcessImageNameW.argtypes = [
    wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)
]
kernel32.CloseHandle.argtypes = [wintypes.HANDLE]


def foreground_game_window():
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    hproc = kernel32.OpenProcess(0x1000, False, pid.value)  # PROCESS_QUERY_LIMITED_INFORMATION
    name = ''
    if hproc:
        buf = ctypes.create_unicode_buffer(520)
        size = wintypes.DWORD(520)
        if kernel32.QueryFullProcessImageNameW(hproc, 0, buf, ctypes.byref(size)):
            name = os.path.splitext(os.path.basename(buf.value))[0].lower()
        kernel32.CloseHandle(hproc)
    if not name or name in DENYLIST:
        return None
    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    w, h2 = rect.right - rect.left, rect.bottom - rect.top
    if w < 320 or h2 < 240:
        return None
    buf = ctypes.create_unicode_buffer(256)
    user32.GetWindowTextW(hwnd, buf, 256)
    return {'process': name, 'title': buf.value, 'bbox': (rect.left, rect.top, rect.right, rect.bottom)}


def grab(bbox):
    from PIL import ImageGrab
    img = ImageGrab.grab(bbox=bbox, all_screens=True).convert('RGB')
    img.thumbnail((896, 896))
    return img


def to_jpeg(img):
    b = io.BytesIO()
    img.save(b, format='JPEG', quality=70)
    return b.getvalue()


def read_now_playing():
    try:
        with open(APP_STATE, encoding='utf-8') as f:
            st = json.load(f)
        t = st.get('currentTrack') or {}
        if st.get('isPlaying') and t.get('title'):
            return f"{t.get('artist', '?')} - {t.get('title', '?')}"
    except Exception:
        pass
    return ''


def write_out(payload):
    with open(TMP_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)
    os.replace(TMP_FILE, OUT_FILE)


def build_prompt(game_hint, prev_summaries, now_playing, used):
    return f"""You are the music director of a game-soundtrack app. Look at this game frame and decide what
music the player should hear RIGHT NOW, like a film composer scoring the scene.

Window title hint: "{game_hint}"
Previous scene notes (oldest first): {prev_summaries or 'none'}
Currently playing: {now_playing or 'nothing'}
Already used recently (do NOT pick again): {used or 'none'}

Rules:
- Judge the real scene: location, lighting, characters, UI, subtitles, danger, emotion.
- Combat/boss only if enemies/health bars/action are actually visible. Menus and pause screens are 'menu'.
- change_music=true only when the current track clearly mismatches the scene (or nothing is playing).
  Do not flip for small changes; music should breathe and follow the story.
- picks: 5 REAL, officially released tracks (game OSTs, film scores, neoclassical, ambient, post-rock,
  electronic - whatever truly fits THIS game's world and THIS moment). Prefer the game's own OST or its
  sonic world. Sometimes pure ambient atmosphere is the best choice. No remixes, covers, live versions,
  royalty-free/stock library music, or "dark ambient for studying" style filler. Only tracks you are
  highly confident exist; artist and exact title must be correct.
- summary must be in Russian, one sentence."""


def main():
    load_env()
    key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if not key:
        print('[Director] GEMINI_API_KEY not found. Add it to .env.local and restart.', flush=True)
        write_out({'timestamp': int(time.time() * 1000), 'ok': False, 'error': 'no_api_key'})
        sys.exit(1)

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=key)
    model = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
    base_interval = float(os.environ.get('DIRECTOR_INTERVAL', '10'))
    print(f'[Director] model={model} interval={base_interval}s', flush=True)

    prev_img = None
    notes: List[str] = []
    used: List[str] = []
    backoff = 0.0
    interval = base_interval

    while True:
        time.sleep(interval)
        interval = base_interval
        win = foreground_game_window()
        if not win:
            continue
        try:
            img = grab(win['bbox'])
        except Exception as e:
            print(f'[Director] grab failed: {e}', flush=True)
            continue

        st = ImageStat.Stat(img.convert('L'))
        if st.mean[0] < 3:  # black frame (exclusive fullscreen / loading)
            continue
        if prev_img is not None:
            diff = ImageStat.Stat(ImageChops.difference(img.convert('L'), prev_img.convert('L'))).mean[0]
            if diff < 2.0:  # nothing changed -> save quota
                interval = base_interval * 3
                continue
        prev_img = img

        prompt = build_prompt(win['title'], ' | '.join(notes[-4:]), read_now_playing(), '; '.join(used[-12:]))
        try:
            resp = client.models.generate_content(
                model=model,
                contents=[types.Part.from_bytes(data=to_jpeg(img), mime_type='image/jpeg'), prompt],
                config=types.GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=Scene,
                    temperature=0.7,
                ),
            )
            scene = resp.parsed if isinstance(resp.parsed, Scene) else Scene.model_validate_json(resp.text)
            backoff = 0.0
        except Exception as e:
            msg = str(e)
            backoff = min(120.0, max(15.0, backoff * 2 or 15.0)) if ('429' in msg or 'RESOURCE_EXHAUSTED' in msg) else 5.0
            print(f'[Director] API error ({msg[:120]}); retry in {backoff:.0f}s', flush=True)
            interval = backoff
            continue

        notes.append(scene.summary)
        if scene.change_music:
            used.extend(f'{p.artist} - {p.title}' for p in scene.picks)
        payload = {
            'timestamp': int(time.time() * 1000),
            'ok': True,
            'process': win['process'],
            'game': scene.game,
            'sceneType': scene.scene_type,
            'vibe': scene.vibe,
            'mood': scene.mood,
            'tension': scene.tension,
            'location': scene.location,
            'summary': scene.summary,
            'onScreenText': scene.on_screen_text,
            'musicStyle': scene.music_style,
            'changeMusic': scene.change_music,
            'picks': [p.model_dump() for p in scene.picks],
        }
        write_out(payload)
        print(f"[Director] {scene.vibe}/{scene.scene_type} change={scene.change_music} | {scene.summary}", flush=True)


if __name__ == '__main__':
    main()
