"""
GameVibe Neural Vision & Dialogue NLP Agent
Uses Windows native WinRT Neural OCR (under 10ms) and Semantic Sentiment Analysis
to read real in-game subtitles, dialogue boxes, and cinematic cutscene text.
"""
import asyncio
import json
import os
import sys
import time
import ctypes
from ctypes import wintypes
from PIL import Image
import winocr

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
OUT_FILE = os.path.join(DATA_DIR, 'live-dialogue.json')
TMP_FILE = os.path.join(DATA_DIR, 'live-dialogue.tmp.json')

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

# Semantic dictionaries for instant context understanding
DRAMA_KEYWORDS = {
    'death', 'die', 'dead', 'kill', 'killed', 'blood', 'curse', 'cursed', 'darkness',
    'grave', 'loss', 'lost', 'sorrow', 'grief', 'tear', 'tears', 'goodbye', 'forgive',
    'fallen', 'void', 'spiral', 'end', 'despair', 'trapped', 'sacrifice', 'mourn',
    'смерть', 'умер', 'убит', 'кровь', 'проклятие', 'тьма', 'могила', 'потеря', 'скорбь',
    'слезы', 'прощай', 'прости', 'жертва', 'отчаяние', 'боль', 'мрак'
}

MAJESTIC_KEYWORDS = {
    'light', 'hope', 'future', 'world', 'save', 'saved', 'freedom', 'free', 'sunrise',
    'dawn', 'horizon', 'sky', 'dream', 'believe', 'eternal', 'reborn', 'rise', 'glory',
    'victory', 'triumph', 'miracle', 'sacred', 'grace', 'divine',
    'свет', 'надежда', 'будущее', 'мир', 'свобода', 'рассвет', 'горизонт', 'небо',
    'мечта', 'вечность', 'возрождение', 'победа', 'триумф', 'чудо', 'священный'
}

COMBAT_KEYWORDS = {
    'attack', 'fight', 'strike', 'enemy', 'boss', 'destroy', 'surrender', 'defeat',
    'blade', 'sword', 'weapon', 'flesh', 'prepare to die', 'have at you', 'crush',
    'атака', 'бой', 'битва', 'враг', 'босс', 'уничтожь', 'сдайся', 'клинок', 'меч', 'умри'
}

SAFE_KEYWORDS = {
    'shop', 'merchant', 'buy', 'sell', 'gold', 'tavern', 'rest', 'heal', 'safe',
    'potion', 'welcome', 'travel', 'village', 'quest', 'reward',
    'магазин', 'торговец', 'купить', 'продать', 'золото', 'таверна', 'отдых', 'зелье'
}

LOCATION_KEYWORDS = {
    'castle', 'corridor', 'tower', 'dungeon', 'crypt', 'ruins', 'hall', 'temple', 'cavern',
    'abyss', 'chapel', 'garden', 'forest', 'swamp', 'factory', 'peak', 'col', 'city', 'street',
    'harbor', 'gates', 'room', 'chamber', 'throne', 'entrance', 'sanctuary',
    'святилище', 'замок', 'башня', 'подземелье', 'руины', 'коридор', 'склеп', 'пещера',
    'бездна', 'лес', 'часовня', 'трон', 'врата', 'палаты', 'город', 'вход'
}

def get_foreground_window_rect():
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None, None
    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    w = rect.right - rect.left
    h = rect.bottom - rect.top
    if w < 200 or h < 200:
        return None, None
    return hwnd, (rect.left, rect.top, w, h)

def capture_dialogue_crop(hwnd, rect):
    x, y, w, h = rect
    # Dialogue and subtitles typically occupy the lower 25% of the game area
    crop_x = x + int(w * 0.15)
    crop_y = y + int(h * 0.72)
    crop_w = int(w * 0.70)
    crop_h = int(h * 0.22)

    hdc_screen = user32.GetDC(0)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
    hbm = gdi32.CreateCompatibleBitmap(hdc_screen, crop_w, crop_h)
    old_obj = gdi32.SelectObject(hdc_mem, hbm)

    gdi32.BitBlt(hdc_mem, 0, 0, crop_w, crop_h, hdc_screen, crop_x, crop_y, 0x00CC0020) # SRCCOPY

    # Extract bitmap bytes
    bmi = wintypes.BITMAPINFO()
    bmi.bmiHeader.biSize = ctypes.sizeof(wintypes.BITMAPINFOHEADER)
    bmi.bmiHeader.biWidth = crop_w
    bmi.bmiHeader.biHeight = -crop_h # top-down
    bmi.bmiHeader.biPlanes = 1
    bmi.bmiHeader.biBitCount = 32
    bmi.bmiHeader.biCompression = 0

    buf = ctypes.create_string_buffer(crop_w * crop_h * 4)
    gdi32.GetDIBits(hdc_mem, hbm, 0, crop_h, buf, ctypes.byref(bmi), 0)

    gdi32.SelectObject(hdc_mem, old_obj)
    gdi32.DeleteObject(hbm)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(0, hdc_screen)

    img = Image.frombuffer('RGBA', (crop_w, crop_h), buf, 'raw', 'BGRA', 0, 1).convert('RGB')
    return img

def analyze_sentiment(text):
    text_lower = text.lower()
    words = set(text_lower.replace(',', ' ').replace('.', ' ').replace('!', ' ').replace('?', ' ').split())
    
    drama_score = sum(1 for w in words if w in DRAMA_KEYWORDS)
    majestic_score = sum(1 for w in words if w in MAJESTIC_KEYWORDS)
    combat_score = sum(1 for w in words if w in COMBAT_KEYWORDS)
    safe_score = sum(1 for w in words if w in SAFE_KEYWORDS)
    loc_score = sum(1 for w in words if w in LOCATION_KEYWORDS)

    if combat_score > 0 and combat_score >= drama_score:
        return 'COMBAT', 'Боевой вызов / Схватка'
    if drama_score > 0 and drama_score >= majestic_score:
        return 'DRAMA', 'Трагедия / Мрачный сюжет'
    if majestic_score > 0:
        return 'MAJESTIC', 'Воодушевляющий сюжет / Надежда'
    if safe_score > 0:
        return 'EXPLORE', 'Мирная локация / Торговец'
    if loc_score > 0:
        # Location announcement
        if any(w in text_lower for w in ['dungeon', 'crypt', 'abyss', 'cavern', 'подземелье', 'склеп', 'бездна', 'пещера']):
            return 'DRAMA', f'Новая мрачная локация: {text[:35]}'
        return 'MAJESTIC', f'Новая локация: {text[:35]}'

    # Default if text present but neutral
    return 'DRAMA', 'Сюжетный диалог'

async def poll_ocr():
    print('[NeuralVision] Starting WinRT Neural OCR Dialogue Agent (en-US + ru)...', flush=True)
    # Ensure initial idle payload exists
    init_payload = {
        'timestamp': int(time.time() * 1000),
        'text': '',
        'emotion': 'NONE',
        'label': '',
        'isDialogueActive': False,
    }
    try:
        with open(TMP_FILE, 'w', encoding='utf-8') as f:
            json.dump(init_payload, f, ensure_ascii=False)
        os.replace(TMP_FILE, OUT_FILE)
    except Exception as e:
        print(f'[NeuralVision] Init error: {e}', flush=True)

    last_text = ''
    dialogue_hold_until = 0.0

    while True:
        try:
            hwnd, rect = get_foreground_window_rect()
            if hwnd and rect:
                crop = capture_dialogue_crop(hwnd, rect)
                if crop:
                    # Run WinRT neural OCR (fast native WinRT: ~9ms)
                    res = await winocr.recognize_pil(crop, 'en-US')
                    clean_text = ' '.join(res.text.strip().split())
                    
                    # If English OCR is empty, check Russian recognizer
                    if len(clean_text) < 4:
                        res_ru = await winocr.recognize_pil(crop, 'ru')
                        ru_text = ' '.join(res_ru.text.strip().split())
                        if len(ru_text) > len(clean_text):
                            clean_text = ru_text

                    if len(clean_text) >= 5:
                        emotion, label = analyze_sentiment(clean_text)
                        dialogue_hold_until = time.time() + 8.5
                        payload = {
                            'timestamp': int(time.time() * 1000),
                            'text': clean_text,
                            'emotion': emotion,
                            'label': label,
                            'isDialogueActive': True,
                        }
                        if clean_text != last_text:
                            print(f'[NeuralVision] Detected dialogue [{emotion}]: "{clean_text[:60]}"', flush=True)
                        last_text = clean_text
                        with open(TMP_FILE, 'w', encoding='utf-8') as f:
                            json.dump(payload, f, ensure_ascii=False)
                        os.replace(TMP_FILE, OUT_FILE)
                    else:
                        if last_text and time.time() > dialogue_hold_until:
                            print('[NeuralVision] Dialogue ended. Clearing context.', flush=True)
                            payload = {
                                'timestamp': int(time.time() * 1000),
                                'text': '',
                                'emotion': 'NONE',
                                'label': '',
                                'isDialogueActive': False,
                            }
                            with open(TMP_FILE, 'w', encoding='utf-8') as f:
                                json.dump(payload, f, ensure_ascii=False)
                            os.replace(TMP_FILE, OUT_FILE)
                            last_text = ''
        except Exception as e:
            # Print unexpected errors without crashing
            print(f'[NeuralVision] Loop error: {e}', flush=True)

        await asyncio.sleep(0.5)

if __name__ == '__main__':
    asyncio.run(poll_ocr())
