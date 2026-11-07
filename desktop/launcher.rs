#![windows_subsystem = "windows"]

use std::env;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::thread;
use std::time::Duration;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const GAMEVIBE_PORT: u16 = 3001;

fn is_gamevibe_running(port: u16) -> bool {
    let addr: SocketAddr = match format!("127.0.0.1:{}", port).parse() {
        Ok(a) => a,
        Err(_) => return false,
    };

    if let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(600)) {
        let _ = stream.set_read_timeout(Some(Duration::from_millis(900)));
        let _ = stream.set_write_timeout(Some(Duration::from_millis(600)));
        let req = format!(
            "GET /api/app-state HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
            port
        );
        if stream.write_all(req.as_bytes()).is_ok() {
            let mut buf = String::new();
            let _ = stream.read_to_string(&mut buf);
            return buf.contains("\"activeVibe\"") || buf.contains("\"duckingEnabled\"");
        }
    }
    false
}

fn open_fallback_window(url: &str) {
    let _ = Command::new("cmd")
        .args([
            "/C",
            "start",
            "",
            "msedge",
            &format!("--app={}", url),
            "--window-size=1440,900",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}

fn main() {
    let exe_path = env::current_exe().unwrap_or_default();
    let project_dir = exe_path
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."));

    let pkg_json = project_dir.join("package.json");
    let fallback_dir = std::path::Path::new(r"D:\Desktop\gamevibe");
    let working_dir = if pkg_json.exists() { project_dir } else { fallback_dir };

    // 1. Start Local AI Scene, Boss & Subtitle Director (local_director.py)
    let director_py = working_dir.join("desktop").join("local_director.py");
    if director_py.exists() {
        let _ = Command::new("python")
            .arg(&director_py)
            .current_dir(working_dir)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }

    // 2. Ensure 50Hz high-precision interactive sensor is active in the user session
    let sensor_exe = working_dir.join("desktop").join("interactive_sensor.exe");
    if sensor_exe.exists() {
        let _ = Command::new(&sensor_exe)
            .current_dir(working_dir)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }

    // 3. Ensure GameVibe Next.js backend on port 3001 is running
    if !is_gamevibe_running(GAMEVIBE_PORT) {
        let next_bin = working_dir
            .join("node_modules")
            .join("next")
            .join("dist")
            .join("bin")
            .join("next");

        if next_bin.exists() {
            let _ = Command::new("node")
                .arg(&next_bin)
                .args(["dev", "-p", &GAMEVIBE_PORT.to_string()])
                .current_dir(working_dir)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }

        for _ in 0..45 {
            if is_gamevibe_running(GAMEVIBE_PORT) {
                break;
            }
            thread::sleep(Duration::from_millis(500));
        }
    }

    // 4. Launch Native Frameless Electron Desktop Client (with System Tray, Global Hotkeys & Mini-HUD)
    let electron_exe = working_dir
        .join("node_modules")
        .join("electron")
        .join("dist")
        .join("electron.exe");
    let main_js = working_dir.join("desktop").join("main.js");

    if electron_exe.exists() && main_js.exists() {
        let _ = Command::new(&electron_exe)
            .arg(&main_js)
            .current_dir(working_dir)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
        return;
    }

    // Fallback if Electron binary is missing
    open_fallback_window(&format!("http://localhost:{}", GAMEVIBE_PORT));
}
