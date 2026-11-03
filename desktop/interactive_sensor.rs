#![windows_subsystem = "windows"]

use std::fs;
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
    fn GetDC(hWnd: isize) -> isize;
    fn ReleaseDC(hWnd: isize, hDC: isize) -> i32;
    fn GetSystemMetrics(nIndex: i32) -> i32;
    fn GetAsyncKeyState(vKey: i32) -> i16;
    fn GetCursorPos(lpPoint: *mut POINT) -> i32;
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

#[link(name = "xinput1_4")]
extern "system" {
    fn XInputGetState(dwUserIndex: u32, pState: *mut XINPUT_STATE) -> u32;
}

const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
const SRCCOPY: u32 = 0x00CC0020;
const CAPTUREBLT: u32 = 0x40000000;

fn get_process_name(hwnd: isize) -> String {
    unsafe {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return String::from("explorer.exe");
        }
        let h_proc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h_proc == 0 {
            return format!("pid_{}.exe", pid);
        }
        let mut buf = [0u16; 260];
        let mut size: u32 = 260;
        let ok = QueryFullProcessImageNameW(h_proc, 0, buf.as_mut_ptr(), &mut size);
        CloseHandle(h_proc);
        if ok != 0 && size > 0 {
            let full = String::from_utf16_lossy(&buf[..size as usize]);
            if let Some(name) = full.rsplit('\\').next() {
                return name
                    .replace('"', "")
                    .replace('\\', "")
                    .trim()
                    .to_string();
            }
            return full;
        }
        format!("pid_{}.exe", pid)
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
            String::from("Windows")
        }
    }
}

fn sample_screen_16pts() -> ([i32; 16], i32) {
    unsafe {
        let w = GetSystemMetrics(0).max(800);
        let h = GetSystemMetrics(1).max(600);
        let hdc_screen = GetDC(0);
        let hdc_mem = CreateCompatibleDC(hdc_screen);
        let hbm = CreateCompatibleBitmap(hdc_screen, 1, 1);
        let old_obj = SelectObject(hdc_mem, hbm);

        let xs = [w / 5, (w * 2) / 5, (w * 3) / 5, (w * 4) / 5];
        let ys = [h / 5, (h * 2) / 5, (h * 3) / 5, (h * 4) / 5];

        let mut lumas = [0i32; 16];
        let mut red_score = 0i32;
        let mut idx = 0;

        for &y in ys.iter() {
            for &x in xs.iter() {
                BitBlt(hdc_mem, 0, 0, 1, 1, hdc_screen, x, y, SRCCOPY | CAPTUREBLT);
                let color = GetPixel(hdc_mem, 0, 0);
                if color != 0xFFFFFFFF {
                    let r = (color & 0xFF) as i32;
                    let g = ((color >> 8) & 0xFF) as i32;
                    let b = ((color >> 16) & 0xFF) as i32;
                    let l = ((299 * r + 587 * g + 114 * b) / 2550).clamp(0, 100);
                    lumas[idx] = l;
                    if r > ((g + b) * 2) / 3 && r > 110 {
                        red_score += 12;
                    }
                }
                idx += 1;
            }
        }

        SelectObject(hdc_mem, old_obj);
        DeleteObject(hbm);
        DeleteDC(hdc_mem);
        ReleaseDC(0, hdc_screen);
        (lumas, red_score.clamp(0, 100))
    }
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn main() {
    let out_dir = std::path::Path::new("D:\\Desktop\\gamevibe\\data");
    let _ = fs::create_dir_all(out_dir);
    let out_file = out_dir.join("live-sensor.json");
    let tmp_file = out_dir.join("live-sensor.tmp.json");

    let mut prev_lumas = [40i32; 16];
    let mut rolling_energy: f32 = 14.0;
    let mut last_combat_spike_ms: u128 = 0;
    let mut prev_key_states = [false; 256];
    let mut prev_pad_buttons = [0u16; 4];

    // Combat / attack keys (LMB, RMB, MMB, X1, X2, Z, X, C, V, J, K, L, U, I, O, Q, E, R, F, G, Space, Shift, Ctrl, 1-5)
    let combat_attack_vkeys: [usize; 28] = [
        0x01, 0x02, 0x04, 0x05, 0x06, // Mouse buttons
        0x5A, 0x58, 0x43, 0x56, // Z X C V (classic 2D/Metroidvania attack/jump/dash)
        0x4A, 0x4B, 0x4C, 0x55, 0x49, 0x4F, // J K L U I O
        0x51, 0x45, 0x52, 0x46, 0x47, // Q E R F G
        0x20, 0x10, 0x11, // Space, Shift, Ctrl
        0x31, 0x32, 0x33, 0x34, 0x35, // 1 2 3 4 5
    ];

    let movement_vkeys: [usize; 8] = [
        0x57, 0x41, 0x53, 0x44, // W A S D
        0x25, 0x26, 0x27, 0x28, // Left, Up, Right, Down Arrows
    ];

    let mut last_game_proc = String::from("explorer.exe");
    let mut last_game_title = String::from("Windows");

    loop {
        unsafe {
            let mut pt_prev = POINT::default();
            GetCursorPos(&mut pt_prev);

            let mut attack_edge_presses = 0i32;
            let mut attack_held_ticks = 0i32;
            let mut move_edge_presses = 0i32;
            let mut move_held_ticks = 0i32;
            let mut cursor_travel = 0i32;
            let mut pad_attack_score = 0i32;

            // Sample 12 times x 20ms = 240ms per cycle at 50Hz
            for _ in 0..12 {
                // 1. Check combat / attack keys (both new presses AND held attacks)
                for &vk in combat_attack_vkeys.iter() {
                    let st = GetAsyncKeyState(vk as i32);
                    let is_down = (st as u16 & 0x8000) != 0;
                    if is_down {
                        if !prev_key_states[vk] {
                            // Fresh key/button press edge!
                            attack_edge_presses += if vk == 0x01 || vk == 0x02 { 16 } else { 12 };
                        }
                        attack_held_ticks += if vk == 0x01 || vk == 0x02 { 4 } else { 2 };
                    }
                    prev_key_states[vk] = is_down;
                }

                // 2. Check movement keys (holding 1 key to walk = low score; rapid strafing/dodging = high score)
                for &vk in movement_vkeys.iter() {
                    let st = GetAsyncKeyState(vk as i32);
                    let is_down = (st as u16 & 0x8000) != 0;
                    if is_down {
                        if !prev_key_states[vk] {
                            move_edge_presses += 7;
                        }
                        move_held_ticks += 1;
                    }
                    prev_key_states[vk] = is_down;
                }

                // 3. Check XInput Gamepad (controllers 0..3)
                // XInput buttons: A=0x1000, B=0x2000, X=0x4000, Y=0x8000, LB=0x0100, RB=0x0200
                for pad_idx in 0..4 {
                    let mut xstate = XINPUT_STATE::default();
                    if XInputGetState(pad_idx, &mut xstate) == 0 {
                        let btns = xstate.gamepad.w_buttons;
                        let newly_pressed = btns & !prev_pad_buttons[pad_idx as usize];
                        prev_pad_buttons[pad_idx as usize] = btns;

                        // Attack/Action buttons on controller (X, Y, B, A, RB, LB)
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

                // 4. Check mouse movement velocity
                let mut pt_now = POINT::default();
                if GetCursorPos(&mut pt_now) != 0 {
                    cursor_travel += (pt_now.x - pt_prev.x).abs() + (pt_now.y - pt_prev.y).abs();
                    pt_prev = pt_now;
                }

                thread::sleep(Duration::from_millis(20));
            }

            // 5. Foreground window & process detection
            let hwnd = GetForegroundWindow();
            let proc_now = get_process_name(hwnd);
            let title_now = get_window_title(hwnd);
            let proc_lower = proc_now.to_lowercase();
            if !proc_lower.contains("msedge")
                && !proc_lower.contains("explorer")
                && !proc_lower.contains("gamevibe")
                && !proc_lower.contains("searchhost")
            {
                last_game_proc = proc_now.clone();
                last_game_title = title_now.clone();
            }

            let display_proc = if proc_lower.contains("msedge") || proc_lower.contains("explorer") {
                last_game_proc.clone()
            } else {
                proc_now
            };
            let display_title = if proc_lower.contains("msedge") || proc_lower.contains("explorer") {
                last_game_title.clone()
            } else {
                title_now
            };

            // 6. Screen 16-point optical delta & red flash detection
            let (lumas_now, red_score) = sample_screen_16pts();
            let mut optical_diff_sum = 0i32;
            let mut luma_sum = 0i32;
            for i in 0..16 {
                optical_diff_sum += (lumas_now[i] - prev_lumas[i]).abs();
                luma_sum += lumas_now[i];
                prev_lumas[i] = lumas_now[i];
            }
            let avg_luma = (luma_sum / 16).clamp(5, 100);
            let optical_delta_score = (optical_diff_sum / 2).clamp(0, 100);

            // 7. Combine combat signals:
            // Walking calmly (only 1 movement key held, no attacks): ~18-26% (EXPLORE)
            // Attacking / fighting (mouse clicks, Z/X/C/J/K/Q/E/R/F presses, gamepad attacks, or high optical bursts): 55-100% (COMBAT / BOSSFIGHT)
            let walk_base = if move_held_ticks > 0 { 16 } else { 8 };
            let input_combat = (walk_base
                + attack_edge_presses
                + attack_held_ticks
                + move_edge_presses
                + pad_attack_score
                + (cursor_travel / 28).min(30))
            .clamp(8, 100);

            let instant_energy = input_combat.max((optical_delta_score * 85) / 100)
                + (red_score / 3).min(20);
            let instant_clamped = instant_energy.clamp(8, 100) as f32;

            let cur_ms = now_ms();
            if instant_clamped >= 44.0 {
                last_combat_spike_ms = cur_ms;
            }

            // Fast attack rise (jumps into combat within ~0.5s), smooth hold during fights (14s hold)
            if instant_clamped > rolling_energy {
                rolling_energy = rolling_energy * 0.35 + instant_clamped * 0.65;
            } else if cur_ms.saturating_sub(last_combat_spike_ms) < 14000 && rolling_energy >= 44.0 {
                // Keep combat energy alive during brief 2-10s pauses inside an ongoing fight
                rolling_energy = (rolling_energy * 0.96).max(46.0);
            } else {
                // Smooth cooldown back to calm exploration once fight is over
                rolling_energy = (rolling_energy * 0.82 + instant_clamped * 0.18).max(8.0);
            }

            let final_motion = (rolling_energy.round() as i32).clamp(8, 100);
            let vibe = if final_motion >= 76 || red_score >= 48 {
                "BOSSFIGHT"
            } else if final_motion >= 42 {
                "COMBAT"
            } else if avg_luma <= 20 && final_motion >= 18 {
                "STEALTH"
            } else {
                "EXPLORE"
            };

            let json = format!(
                "{{\"timestamp\":{},\"detectedProcess\":\"{}\",\"windowTitle\":\"{}\",\"motionDelta\":{},\"redAlertRatio\":{},\"brightness\":{},\"inferredVibe\":\"{}\",\"sensorMode\":\"win32-interactive-50hz\"}}",
                cur_ms, display_proc, display_title, final_motion, red_score, avg_luma, vibe
            );

            if fs::write(&tmp_file, &json).is_ok() {
                let _ = fs::rename(&tmp_file, &out_file);
            }
        }
    }
}
