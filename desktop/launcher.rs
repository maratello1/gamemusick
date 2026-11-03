#![windows_subsystem = "windows"]

use std::env;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const STANDALONE_HTML: &str = include_str!("standalone_ui.html");

#[link(name = "user32")]
extern "system" {
    fn GetForegroundWindow() -> isize;
    fn GetWindowTextW(hWnd: isize, lpString: *mut u16, nMaxCount: i32) -> i32;
    fn GetDC(hWnd: isize) -> isize;
    fn ReleaseDC(hWnd: isize, hDC: isize) -> i32;
    fn GetSystemMetrics(nIndex: i32) -> i32;
}

#[link(name = "gdi32")]
extern "system" {
    fn GetPixel(hdc: isize, x: i32, y: i32) -> u32;
}

static PREV_LUMA: Mutex<[i32; 5]> = Mutex::new([45, 45, 45, 45, 45]);

fn sample_win32_telemetry() -> String {
    unsafe {
        let hwnd = GetForegroundWindow();
        let mut buf = [0u16; 256];
        let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), 256);
        let title = if len > 0 {
            String::from_utf16_lossy(&buf[..len as usize])
                .replace('"', "")
                .replace('\\', "")
        } else {
            String::from("Windows Desktop")
        };

        let w = GetSystemMetrics(0).max(800);
        let h = GetSystemMetrics(1).max(600);
        let hdc = GetDC(0);

        let pts = [
            (w / 2, h / 2),
            (w / 3, h / 3),
            ((w * 2) / 3, h / 3),
            (w / 3, (h * 2) / 3),
            ((w * 2) / 3, (h * 2) / 3),
        ];

        let mut lumas = [0i32; 5];
        let mut red_score = 0i32;

        for (i, (x, y)) in pts.iter().enumerate() {
            let color = GetPixel(hdc, *x, *y);
            let r = (color & 0xFF) as i32;
            let g = ((color >> 8) & 0xFF) as i32;
            let b = ((color >> 16) & 0xFF) as i32;
            let l = ((299 * r + 587 * g + 114 * b) / 2550).clamp(0, 100);
            lumas[i] = l;
            if r > ((g + b) * 3) / 4 && r > 95 {
                red_score += 25;
            }
        }
        ReleaseDC(0, hdc);

        let mut prev = PREV_LUMA.lock().unwrap();
        let mut diff_sum = 0i32;
        let mut luma_sum = 0i32;
        for i in 0..5 {
            diff_sum += (lumas[i] - prev[i]).abs();
            luma_sum += lumas[i];
            prev[i] = lumas[i];
        }

        let avg_luma = luma_sum / 5;
        let motion = (diff_sum * 2).clamp(8, 100);
        let crimson = red_score.clamp(5, 100);
        let intensity = ((motion * 65 + crimson * 35) / 100).clamp(10, 100);

        let vibe = if crimson >= 45 || intensity >= 80 {
            "BOSSFIGHT"
        } else if motion >= 45 || intensity >= 52 {
            "COMBAT"
        } else if avg_luma <= 24 {
            "STEALTH"
        } else {
            "EXPLORE"
        };

        format!(
            "{{\"activeWindowTitle\":\"{}\",\"detectedProcess\":\"{}\",\"motionDelta\":{},\"crimsonIndex\":{},\"luminance\":{},\"compositeIntensity\":{},\"inferredVibe\":\"{}\"}}",
            title, title, motion, crimson, avg_luma, intensity, vibe
        )
    }
}

fn is_port_open(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

fn open_app_window(url: &str) {
    let _ = Command::new("cmd")
        .args([
            "/C",
            "start",
            "",
            "msedge",
            &format!("--app={}", url),
            "--window-size=980,760",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}

fn run_embedded_server(port: u16) {
    if let Ok(listener) = TcpListener::bind(("127.0.0.1", port)) {
        for stream in listener.incoming().flatten() {
            thread::spawn(move || {
                let mut s = stream;
                let mut buf = [0u8; 2048];
                let n = s.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]);

                if req.starts_with("GET /api/telemetry") {
                    let body = sample_win32_telemetry();
                    let resp = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = s.write_all(resp.as_bytes());
                } else {
                    let resp = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}",
                        STANDALONE_HTML.len(),
                        STANDALONE_HTML
                    );
                    let _ = s.write_all(resp.as_bytes());
                }
            });
        }
    }
}

fn main() {
    let exe_path = env::current_exe().unwrap_or_default();
    let project_dir = exe_path
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."));

    // If running inside full dev repository and port 3000 is active, open it
    if is_port_open(3000) {
        open_app_window("http://localhost:3000");
        return;
    }

    // If standalone .exe is already running on 3847, just open window
    if is_port_open(3847) {
        open_app_window("http://127.0.0.1:3847");
        return;
    }

    // If package.json exists alongside .exe, also start Next.js in background
    if project_dir.join("package.json").exists() {
        let _ = Command::new("cmd")
            .args(["/C", "npm run dev"])
            .current_dir(project_dir)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();

        for _ in 0..20 {
            if is_port_open(3000) {
                open_app_window("http://localhost:3000");
                return;
            }
            thread::sleep(Duration::from_millis(400));
        }
    }

    // Otherwise run 100% self-contained standalone embedded server on 127.0.0.1:3847
    open_app_window("http://127.0.0.1:3847");
    run_embedded_server(3847);
}
