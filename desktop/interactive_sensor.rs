#![windows_subsystem = "windows"]

use std::env;
use std::fs;
use std::path::PathBuf;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[repr(C)]
#[derive(Copy, Clone, Default)]
struct POINT {
    x: i32,
    y: i32,
}

#[repr(C)]
#[derive(Copy, Clone, Default)]
struct RECT {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[repr(C)]
#[derive(Copy, Clone, Default)]
struct XINPUT_GAMEPAD {
    w_buttons: u16,
    b_left_trigger: u8,
    b_right_trigger: u8,
    s_thumb_lx: i16,
    s_thumb_ly: i16,
    s_thumb_rx: i16,
    s_thumb_ry: i16,
}

#[repr(C)]
#[derive(Copy, Clone, Default)]
struct XINPUT_STATE {
    dw_packet_number: u32,
    gamepad: XINPUT_GAMEPAD,
}

#[link(name = "user32")]
extern "system" {
    fn GetForegroundWindow() -> isize;
    fn GetWindowTextW(hWnd: isize, lpString: *mut u16, nMaxCount: i32) -> i32;
    fn GetWindowThreadProcessId(hWnd: isize, lpdwProcessId: *mut u32) -> u32;
    fn GetWindowRect(hWnd: isize, lpRect: *mut RECT) -> i32;
    fn GetDC(hWnd: isize) -> isize;
    fn ReleaseDC(hWnd: isize, hDC: isize) -> i32;
    fn GetSystemMetrics(nIndex: i32) -> i32;
    fn GetAsyncKeyState(vKey: i32) -> i16;
    fn GetCursorPos(lpPoint: *mut POINT) -> i32;
    fn EnumWindows(lpEnumFunc: unsafe extern "system" fn(isize, isize) -> i32, lParam: isize) -> i32;
    fn IsWindowVisible(hWnd: isize) -> i32;
    fn OpenInputDesktop(dwFlags: u32, fInherit: i32, dwDesiredAccess: u32) -> isize;
    fn SetThreadDesktop(hDesktop: isize) -> i32;
}

#[link(name = "kernel32")]
extern "system" {
    fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> isize;
    fn CloseHandle(hObject: isize) -> i32;
    fn QueryFullProcessImageNameW(
        hProcess: isize,
        dwFlags: u32,
        lpExeName: *mut u16,
        lpdwSize: *mut u32,
    ) -> i32;
    fn LoadLibraryA(lpLibFileName: *const u8) -> isize;
    fn GetProcAddress(hModule: isize, lpProcName: *const u8) -> isize;
    fn CreateMutexA(lpMutexAttributes: isize, bInitialOwner: i32, lpName: *const u8) -> isize;
    fn GetLastError() -> u32;
    fn SetLastError(dwErrCode: u32);
    fn AttachConsole(dwProcessId: u32) -> i32;
}

#[link(name = "gdi32")]
extern "system" {
    fn CreateCompatibleDC(hdc: isize) -> isize;
    fn CreateCompatibleBitmap(hdc: isize, cx: i32, cy: i32) -> isize;
    fn SelectObject(hdc: isize, h: isize) -> isize;
    fn BitBlt(
        hdc: isize,
        x: i32,
        y: i32,
        cx: i32,
        cy: i32,
        hdcSrc: isize,
        x1: i32,
        y1: i32,
        rop: u32,
    ) -> i32;
    fn GetPixel(hdc: isize, x: i32, y: i32) -> u32;
    fn DeleteObject(ho: isize) -> i32;
    fn DeleteDC(hdc: isize) -> i32;
}

type XInputGetStateFn = unsafe extern "system" fn(u32, *mut XINPUT_STATE) -> u32;

const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
const SRCCOPY: u32 = 0x00CC0020;
const CAPTUREBLT: u32 = 0x40000000;

const DENYLIST: [&str; 33] = [
    "explorer",
    "msedge",
    "chrome",
    "firefox",
    "brave",
    "opera",
    "yandex",
    "vivaldi",
    "gamemusick",
    "gamevibe",
    "electron",
    "antigravity",
    "searchhost",
    "shellexperiencehost",
    "applicationframehost",
    "taskmgr",
    "cmd",
    "powershell",
    "pwsh",
    "windowsterminal",
    "code",
    "devenv",
    "cursor",
    "idea64",
    "pycharm64",
    "rider64",
    "clion64",
    "sublime_text",
    "discord",
    "telegram",
    "spotify",
    "steamwebhelper",
    "epicgameslauncher",
];

fn is_denylisted(proc_name: &str) -> bool {
    let lower = proc_name.to_lowercase();
    let stem = lower.strip_suffix(".exe").unwrap_or(&lower);
    DENYLIST.iter().any(|&d| stem == d || lower.contains(d))
}

fn get_process_name(hwnd: isize) -> String {
    unsafe {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return String::new();
        }
        let h_proc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h_proc == 0 {
            return String::new();
        }
        let mut buf = [0u16; 260];
        let mut size: u32 = 260;
        let ok = QueryFullProcessImageNameW(h_proc, 0, buf.as_mut_ptr(), &mut size);
        CloseHandle(h_proc);
        if ok != 0 && size > 0 {
            let full = String::from_utf16_lossy(&buf[..size as usize]);
            if let Some(name) = full.rsplit('\\').next() {
                let clean = name
                    .replace('"', "")
                    .replace('\\', "")
                    .trim()
                    .to_string();
                return clean.strip_suffix(".exe").unwrap_or(&clean).to_string();
            }
        }
        String::new()
    }
}

fn get_window_title(hwnd: isize) -> String {
    unsafe {
        let mut buf = [0u16; 256];
        let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), 256);
        if len > 0 {
            String::from_utf16_lossy(&buf[..len as usize])
                .replace('"', "")
                .replace('\\', "/")
                .replace('\r', "")
                .replace('\n', " ")
                .trim()
                .to_string()
        } else {
            String::new()
        }
    }
}

struct FoundGame {
    hwnd: isize,
    proc: String,
    title: String,
    rect: RECT,
}

unsafe extern "system" fn enum_game_window_cb(hwnd: isize, lparam: isize) -> i32 {
    let out = &mut *(lparam as *mut Option<FoundGame>);
    if IsWindowVisible(hwnd) == 0 {
        return 1;
    }
    let mut rect = RECT::default();
    if GetWindowRect(hwnd, &mut rect) == 0 {
        return 1;
    }
    let w = rect.right - rect.left;
    let h = rect.bottom - rect.top;
    if w < 300 || h < 200 {
        return 1;
    }

    let proc = get_process_name(hwnd);
    if proc.is_empty() || is_denylisted(&proc) {
        return 1;
    }

    let title = get_window_title(hwnd);
    let title_lower = title.to_lowercase();
    if title_lower.contains("overlay")
        || title_lower.contains("nvidia")
        || title_lower.contains("geforce")
        || title_lower.contains("settings")
    {
        return 1;
    }

    *out = Some(FoundGame {
        hwnd,
        proc,
        title,
        rect,
    });
    0 // stop enumeration
}

fn find_running_game() -> Option<FoundGame> {
    unsafe {
        let h_desk = OpenInputDesktop(0, 0, 0x01FF);
        if h_desk != 0 {
            let _ = SetThreadDesktop(h_desk);
        }
    }
    let mut found: Option<FoundGame> = None;
    unsafe {
        EnumWindows(enum_game_window_cb, &mut found as *mut _ as isize);
    }
    found
}

struct VisualSample {
    lumas: [i32; 16],
    red_score: i32,
    is_letterbox: bool,
    has_boss_hp_bar: bool,
}

fn sample_game_visuals(rect: RECT) -> VisualSample {
    unsafe {
        let rw = (rect.right - rect.left).max(640);
        let rh = (rect.bottom - rect.top).max(480);
        let rx = rect.left;
        let ry = rect.top;

        let hdc_screen = GetDC(0);
        let hdc_mem = CreateCompatibleDC(hdc_screen);
        let hbm = CreateCompatibleBitmap(hdc_screen, 1, 1);
        let old_obj = SelectObject(hdc_mem, hbm);

        let sample_rgb = |x: i32, y: i32| -> (i32, i32, i32, i32) {
            BitBlt(hdc_mem, 0, 0, 1, 1, hdc_screen, x, y, SRCCOPY | CAPTUREBLT);
            let color = GetPixel(hdc_mem, 0, 0);
            if color == 0xFFFFFFFF {
                return (20, 20, 20, 20);
            }
            let r = (color & 0xFF) as i32;
            let g = ((color >> 8) & 0xFF) as i32;
            let b = ((color >> 16) & 0xFF) as i32;
            let l = ((299 * r + 587 * g + 114 * b) / 2550).clamp(0, 100);
            (r, g, b, l)
        };

        // 1. 16-point grid for optical motion & red alert
        let xs = [
            rx + rw / 5,
            rx + (rw * 2) / 5,
            rx + (rw * 3) / 5,
            rx + (rw * 4) / 5,
        ];
        let ys = [
            ry + rh / 5,
            ry + (rh * 2) / 5,
            ry + (rh * 3) / 5,
            ry + (rh * 4) / 5,
        ];

        let mut lumas = [0i32; 16];
        let mut red_score = 0i32;
        let mut idx = 0;

        for &y in ys.iter() {
            for &x in xs.iter() {
                let (r, g, b, l) = sample_rgb(x, y);
                lumas[idx] = l;
                if r > ((g + b) * 2) / 3 && r > 110 {
                    red_score += 12;
                }
                idx += 1;
            }
        }

        // 2. Letterbox 21:9 Cutscene detection (top 2.5% and bottom 97.5% black bars while center is lit)
        let mut top_bar_luma = 0;
        let mut bot_bar_luma = 0;
        for step in 1..=4 {
            let x = rx + (rw * step) / 5;
            top_bar_luma += sample_rgb(x, ry + (rh * 25) / 1000).3;
            bot_bar_luma += sample_rgb(x, ry + (rh * 975) / 1000).3;
        }
        top_bar_luma /= 4;
        bot_bar_luma /= 4;
        let center_avg: i32 = lumas.iter().sum::<i32>() / 16;
        let is_letterbox = top_bar_luma <= 3 && bot_bar_luma <= 3 && center_avg >= 10;

        // 3. Boss Health Bar Detection (wide crimson or gold horizontal strip at y=9% or y=86%)
        let mut has_boss_hp_bar = false;
        for &y_permil in &[90, 860] {
            let y = ry + (rh * y_permil) / 1000;
            let mut hp_hits = 0;
            for step in 0..12 {
                let x = rx + (rw * (250 + step * 42)) / 1000;
                let (r, g, b, _) = sample_rgb(x, y);
                let is_crimson = r > 135 && g < 55 && b < 55 && (r - g.max(b)) > 85;
                let is_gold = r > 185 && g > 130 && b < 60 && (r - b) > 120;
                if is_crimson || is_gold {
                    hp_hits += 1;
                }
            }
            if hp_hits >= 8 {
                has_boss_hp_bar = true;
                break;
            }
        }

        SelectObject(hdc_mem, old_obj);
        DeleteObject(hbm);
        DeleteDC(hdc_mem);
        ReleaseDC(0, hdc_screen);

        VisualSample {
            lumas,
            red_score: red_score.clamp(0, 100),
            is_letterbox,
            has_boss_hp_bar,
        }
    }
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn resolve_data_dir() -> PathBuf {
    if let Ok(exe) = env::current_exe() {
        if let Some(parent) = exe.parent() {
            // If running from desktop/interactive_sensor.exe, parent is desktop/, root is parent.parent()
            if parent.ends_with("desktop") {
                if let Some(root) = parent.parent() {
                    return root.join("data");
                }
            }
            return parent.join("data");
        }
    }
    PathBuf::from("data")
}

fn load_learned_thresholds(file_path: &std::path::Path) -> (i32, i32, i32) {
    let mut combat = 42;
    let mut stealth = 42;
    let mut boss = 85;

    if let Ok(content) = fs::read_to_string(file_path) {
        if let Some(pos) = content.find("\"combatMotionThreshold\":") {
            let rest = &content[pos + 24..];
            if let Some(num_str) = rest.split(|c: char| !c.is_ascii_digit()).next() {
                if let Ok(val) = num_str.trim().parse::<i32>() {
                    combat = val.clamp(20, 80);
                }
            }
        }
        if let Some(pos) = content.find("\"stealthLumaThreshold\":") {
            let rest = &content[pos + 23..];
            if let Some(num_str) = rest.split(|c: char| !c.is_ascii_digit()).next() {
                if let Ok(val) = num_str.trim().parse::<i32>() {
                    stealth = val.clamp(10, 70);
                }
            }
        }
        if let Some(pos) = content.find("\"bossSensitivity\":") {
            let rest = &content[pos + 18..];
            if let Some(num_str) = rest.split(|c: char| !c.is_ascii_digit()).next() {
                if let Ok(val) = num_str.trim().parse::<i32>() {
                    boss = val.clamp(50, 100);
                }
            }
        }
    }
    (combat, stealth, boss)
}

fn is_online_competitive_game(proc: &str) -> bool {
    let p = proc.to_lowercase();
    p.contains("cs2")
        || p.contains("csgo")
        || p.contains("counter-strike")
        || p.contains("counterstrike")
        || p.contains("valorant")
        || p.contains("dota2")
        || p.contains("dota")
        || p.contains("league of legends")
        || p.contains("leagueclient")
        || p.contains("deadlock")
        || p.contains("r5apex")
        || p.contains("apex")
        || p.contains("overwatch")
        || p.contains("pubg")
        || p.contains("tslgame")
        || p.contains("fortnite")
        || p.contains("rainbowsix")
        || p.contains("r6")
        || p.contains("marvelrivals")
        || p.contains("crossfire")
        || p.contains("pointblank")
        || p.contains("warzone")
        || p.contains("cod")
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let is_once = args.iter().any(|a| a == "--once");

    if is_once {
        unsafe {
            AttachConsole(0xFFFFFFFF);
        }
    }

    // Single-instance enforcement: if not running --once, ensure only ONE sensor process runs globally
    const ERROR_ALREADY_EXISTS: u32 = 183;
    let (_mutex_handle, is_duplicate) = unsafe {
        SetLastError(0);
        let h = CreateMutexA(0, 0, b"GameMusick_Sensor_Instance_Mutex_v2\0".as_ptr());
        let err = GetLastError();
        (h, h != 0 && err == ERROR_ALREADY_EXISTS)
    };
    if !is_once && is_duplicate {
        // Another sensor daemon is already actively monitoring at 50Hz!
        return;
    }

    let out_dir = resolve_data_dir();
    let _ = fs::create_dir_all(&out_dir);
    let out_file = out_dir.join("live-sensor.json");
    let tmp_file = out_dir.join("live-sensor.tmp.json");
    let brain_file = out_dir.join("neural-evolution.json");

    let mut learned_combat = 42;
    let mut learned_stealth = 42;
    let mut learned_boss = 85;
    let mut last_brain_sync_ms: u128 = 0;

    let mut prev_lumas = [40i32; 16];
    let mut rolling_energy: f32 = 14.0;
    let mut last_combat_spike_ms: u128 = 0;
    let mut combat_streak_start_ms: u128 = 0;
    let mut last_boss_ms: u128 = 0;
    let mut last_stealth_ms: u128 = 0;
    let mut last_cutscene_ms: u128 = 0;
    let mut last_room_wipe_ms: u128 = 0;
    let mut letterbox_streak = 0;
    let mut black_screen_streak = 0;
    let mut boss_bar_streak = 0;
    let mut online_respawn_streak = 0i32;

    let mut prev_key_states = [false; 256];
    let mut prev_pad_buttons = [0u16; 4];

    let combat_attack_vkeys: [usize; 28] = [
        0x01, 0x02, 0x04, 0x05, 0x06, // Mouse buttons
        0x5A, 0x58, 0x43, 0x56, // Z X C V
        0x4A, 0x4B, 0x4C, 0x55, 0x49, 0x4F, // J K L U I O
        0x51, 0x45, 0x52, 0x46, 0x47, // Q E R F G
        0x20, 0x10, 0x11, // Space, Shift, Ctrl
        0x31, 0x32, 0x33, 0x34, 0x35, // 1 2 3 4 5
    ];

    let movement_vkeys: [usize; 8] = [
        0x57, 0x41, 0x53, 0x44, // W A S D
        0x25, 0x26, 0x27, 0x28, // Arrows
    ];

    let mut last_game_proc = String::from("IDLE_STANDBY");
    let mut last_game_title = String::from("IDLE_STANDBY");
    let mut last_game_seen_ms: u128 = 0;

    let xinput_get_state: Option<XInputGetStateFn> = unsafe {
        let h_mod = LoadLibraryA(b"xinput1_4.dll\0".as_ptr());
        if h_mod != 0 {
            let p = GetProcAddress(h_mod, b"XInputGetState\0".as_ptr());
            if p != 0 {
                Some(std::mem::transmute(p))
            } else {
                None
            }
        } else {
            None
        }
    };

    loop {
        unsafe {
            let cur_ms = now_ms();

            // Window & active game detection (checks foreground, falls back to running game window)
            let hwnd_fg = GetForegroundWindow();
            let proc_fg = get_process_name(hwnd_fg);
            let title_fg = get_window_title(hwnd_fg);

            let (_hwnd, proc_now, title_now, game_rect) = if !proc_fg.is_empty() && !is_denylisted(&proc_fg) {
                let mut rect = RECT::default();
                let _ = GetWindowRect(hwnd_fg, &mut rect);
                (hwnd_fg, proc_fg, title_fg, rect)
            } else if let Some(bg_game) = find_running_game() {
                (bg_game.hwnd, bg_game.proc, bg_game.title, bg_game.rect)
            } else {
                (0, String::new(), String::new(), RECT {
                    left: 0,
                    top: 0,
                    right: GetSystemMetrics(0).max(800),
                    bottom: GetSystemMetrics(1).max(600),
                })
            };

            let is_real_game = !proc_now.is_empty();

            if is_real_game {
                last_game_proc = proc_now;
                if !title_now.is_empty() {
                    last_game_title = title_now;
                }
                last_game_seen_ms = cur_ms;
            } else if cur_ms.saturating_sub(last_game_seen_ms) > 4000 {
                last_game_proc = String::from("IDLE_STANDBY");
                last_game_title = String::from("IDLE_STANDBY");
            }

            let is_online = is_online_competitive_game(&last_game_proc);

            let mut pt_prev = POINT::default();
            GetCursorPos(&mut pt_prev);

            let mut attack_edge_presses = 0i32;
            let mut attack_held_ticks = 0i32;
            let mut move_edge_presses = 0i32;
            let mut move_held_ticks = 0i32;
            let mut cursor_travel = 0i32;
            let mut pad_attack_score = 0i32;
            let mut crouch_held = false;

            // Sample 12 times x 20ms = 240ms per cycle at 50Hz
            for _ in 0..12 {
                for &vk in combat_attack_vkeys.iter() {
                    let st = GetAsyncKeyState(vk as i32);
                    let is_down = (st as u16 & 0x8000) != 0;
                    if is_down {
                        if !prev_key_states[vk] {
                            if is_online {
                                if vk == 0x02 {
                                    // Right click: navigation / steering in MOBAs & tactical aim
                                    attack_edge_presses += 2;
                                } else if vk == 0x01 {
                                    // Left click: attack / shooting
                                    attack_edge_presses += 14;
                                } else {
                                    // Abilities (Q, E, R, F, numbers)
                                    attack_edge_presses += 12;
                                }
                            } else {
                                attack_edge_presses += if vk == 0x01 || vk == 0x02 { 16 } else { 12 };
                            }
                        }
                        if is_online {
                            attack_held_ticks += if vk == 0x02 { 1 } else { 2 };
                        } else {
                            attack_held_ticks += if vk == 0x01 || vk == 0x02 { 4 } else { 2 };
                        }
                    }
                    prev_key_states[vk] = is_down;
                }

                // Check crouch/stealth keys (Ctrl 0x11 or 'C' 0x43)
                if ((GetAsyncKeyState(0x11) as u16 & 0x8000) != 0)
                    || ((GetAsyncKeyState(0x43) as u16 & 0x8000) != 0)
                {
                    crouch_held = true;
                }

                for &vk in movement_vkeys.iter() {
                    let st = GetAsyncKeyState(vk as i32);
                    let is_down = (st as u16 & 0x8000) != 0;
                    if is_down {
                        if !prev_key_states[vk] {
                            move_edge_presses += if is_online { 4 } else { 7 };
                        }
                        move_held_ticks += 1;
                    }
                    prev_key_states[vk] = is_down;
                }

                if let Some(xinput_fn) = xinput_get_state {
                    for pad_idx in 0..4 {
                        let mut xstate = XINPUT_STATE::default();
                        if xinput_fn(pad_idx, &mut xstate) == 0 {
                            let btns = xstate.gamepad.w_buttons;
                            let newly_pressed = btns & !prev_pad_buttons[pad_idx as usize];
                            prev_pad_buttons[pad_idx as usize] = btns;

                            if (newly_pressed & 0xF300) != 0 {
                                pad_attack_score += 18;
                            }
                            if (btns & 0xF300) != 0 {
                                pad_attack_score += 3;
                            }
                            if xstate.gamepad.b_right_trigger > 40 || xstate.gamepad.b_left_trigger > 40 {
                                pad_attack_score += 6;
                            }
                        }
                    }
                }

                let mut pt_now = POINT::default();
                if GetCursorPos(&mut pt_now) != 0 {
                    cursor_travel += (pt_now.x - pt_prev.x).abs() + (pt_now.y - pt_prev.y).abs();
                    pt_prev = pt_now;
                }

                thread::sleep(Duration::from_millis(20));
            }

            let vis = sample_game_visuals(game_rect);
            let mut optical_diff_sum = 0i32;
            let mut luma_sum = 0i32;
            for i in 0..16 {
                optical_diff_sum += (vis.lumas[i] - prev_lumas[i]).abs();
                luma_sum += vis.lumas[i];
                prev_lumas[i] = vis.lumas[i];
            }
            let avg_luma = (luma_sum / 16).clamp(2, 100);
            let optical_delta_score = (optical_diff_sum / 2).clamp(0, 100);

            // Dynamic Neural Evolution Brain Sync (Every ~3.5 seconds)
            if cur_ms.saturating_sub(last_brain_sync_ms) > 3500 {
                last_brain_sync_ms = cur_ms;
                let (c, s, b) = load_learned_thresholds(&brain_file);
                learned_combat = c;
                learned_stealth = s;
                learned_boss = b;
            }

            // Letterbox cutscene & room transition streaks
            if vis.is_letterbox {
                letterbox_streak += 1;
            } else {
                letterbox_streak = 0;
            }
            if letterbox_streak >= 3 {
                last_cutscene_ms = cur_ms;
            }

            if avg_luma <= 4 {
                black_screen_streak += 1;
            } else {
                if black_screen_streak >= 1 && black_screen_streak <= 6 {
                    last_room_wipe_ms = cur_ms;
                }
                black_screen_streak = 0;
            }

            if vis.has_boss_hp_bar {
                boss_bar_streak += 1;
            } else if boss_bar_streak > 0 {
                boss_bar_streak -= 1;
            }

            // Combat & Energy State Machine
            let walk_base = if move_held_ticks > 0 { if is_online { 10 } else { 16 } } else { 8 };
            let input_combat = if is_online {
                (walk_base
                    + (attack_edge_presses * 70 / 100)
                    + (attack_held_ticks * 60 / 100)
                    + move_edge_presses
                    + pad_attack_score
                    + (cursor_travel / 55).min(20))
                .clamp(8, 100)
            } else {
                (walk_base
                    + attack_edge_presses
                    + attack_held_ticks
                    + move_edge_presses
                    + pad_attack_score
                    + (cursor_travel / 28).min(30))
                .clamp(8, 100)
            };

            let instant_energy = if is_online {
                // In online games: balance APM with verified optical screen action:
                ((input_combat * 55) / 100) + ((optical_delta_score * 50) / 100) + (vis.red_score / 3).min(15)
            } else {
                input_combat.max((optical_delta_score * 85) / 100) + (vis.red_score / 3).min(20)
            };
            let instant_clamped = instant_energy.clamp(8, 100) as f32;

            if instant_clamped >= (learned_combat as f32 + 2.0) {
                if combat_streak_start_ms == 0 {
                    combat_streak_start_ms = cur_ms;
                }
                last_combat_spike_ms = cur_ms;
            } else if cur_ms.saturating_sub(last_combat_spike_ms) > 8000 {
                combat_streak_start_ms = 0;
            }

            if instant_clamped > rolling_energy {
                rolling_energy = rolling_energy * 0.35 + instant_clamped * 0.65;
            } else if cur_ms.saturating_sub(last_combat_spike_ms) < 14000 && rolling_energy >= 44.0 {
                rolling_energy = (rolling_energy * 0.96).max(46.0);
            } else {
                rolling_energy = (rolling_energy * 0.82 + instant_clamped * 0.18).max(8.0);
            }

            let final_motion = (rolling_energy.round() as i32).clamp(8, 100);
            let is_fighting = final_motion >= learned_combat;
            let combat_duration_ms = if combat_streak_start_ms > 0 {
                cur_ms.saturating_sub(combat_streak_start_ms)
            } else {
                0
            };

            // Online Respawn / Spectating State Machine
            let mut is_respawn_spectating = false;
            if is_online {
                let recent_combat = cur_ms.saturating_sub(last_combat_spike_ms) < 28000;
                let zero_inputs = attack_edge_presses <= 1 && move_edge_presses == 0 && move_held_ticks == 0 && cursor_travel < 250;
                if recent_combat && zero_inputs {
                    online_respawn_streak += 1;
                } else if !zero_inputs {
                    online_respawn_streak = 0;
                }

                if online_respawn_streak >= 6 {
                    is_respawn_spectating = true;
                    rolling_energy = (rolling_energy * 0.72).max(10.0);
                }
            } else {
                online_respawn_streak = 0;
            }

            if (is_fighting && boss_bar_streak >= 2)
                || (combat_duration_ms > 32000 && final_motion >= (learned_boss - 17))
                || final_motion >= learned_boss
            {
                last_boss_ms = cur_ms;
            }

            if crouch_held && !is_fighting && avg_luma < learned_stealth {
                last_stealth_ms = cur_ms;
            }

            let in_boss_hold = cur_ms.saturating_sub(last_boss_ms) < 22000;
            let in_combat_hold = cur_ms.saturating_sub(last_combat_spike_ms) < 16000;
            let in_cutscene_hold = cur_ms.saturating_sub(last_cutscene_ms) < 12000;
            let is_recent_room_change = cur_ms.saturating_sub(last_room_wipe_ms) < 10000;
            let in_stealth_hold = cur_ms.saturating_sub(last_stealth_ms) < 14000;

            let is_standby = last_game_proc == "IDLE_STANDBY" || last_game_proc.is_empty();

            let (vibe, scene_label) = if is_standby {
                ("EXPLORE", "STANDBY")
            } else if is_respawn_spectating {
                ("DRAMA", "RESPAWN")
            } else if in_boss_hold {
                ("BOSSFIGHT", "BOSSFIGHT")
            } else if is_fighting || in_combat_hold {
                ("COMBAT", "COMBAT")
            } else if is_recent_room_change {
                ("MAJESTIC", "MAJESTIC")
            } else if in_cutscene_hold {
                ("DRAMA", "DRAMA")
            } else if in_stealth_hold {
                ("STEALTH", "STEALTH")
            } else {
                ("EXPLORE", "EXPLORE")
            };

            let out_motion = if is_standby { 10 } else { final_motion };
            let out_red = if is_standby { 0 } else { vis.red_score };
            let out_cutscene = if is_standby { "false" } else if in_cutscene_hold { "true" } else { "false" };
            let out_room_wipe = if is_standby { "false" } else if is_recent_room_change { "true" } else { "false" };

            let json = format!(
                "{{\"timestamp\":{},\"detectedProcess\":\"{}\",\"windowTitle\":\"{}\",\"motionDelta\":{},\"redAlertRatio\":{},\"brightness\":{},\"inferredVibe\":\"{}\",\"sceneEmotion\":\"{}\",\"sceneLabel\":\"{}\",\"isCutscene\":{},\"isNewLocation\":{},\"gameAudioDucked\":false,\"sensorMode\":\"rust-win32-50hz-neural-synced\",\"learnedCombatThreshold\":{},\"learnedStealthThreshold\":{},\"isOnlineGame\":{},\"isRespawnSpectating\":{}}}",
                cur_ms,
                last_game_proc,
                last_game_title,
                out_motion,
                out_red,
                avg_luma,
                vibe,
                vibe,
                scene_label,
                out_cutscene,
                out_room_wipe,
                learned_combat,
                learned_stealth,
                if is_online { "true" } else { "false" },
                if is_respawn_spectating { "true" } else { "false" }
            );

            if fs::write(&tmp_file, &json).is_ok() {
                let _ = fs::rename(&tmp_file, &out_file);
            }

            if is_once {
                println!("{}", json);
                return;
            }
        }
    }
}
