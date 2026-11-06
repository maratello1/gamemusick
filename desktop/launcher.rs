#![windows_subsystem = "windows"]

use std::env;
use std::net::TcpStream;
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::thread;
use std::time::Duration;

const CREATE_NO_WINDOW: u32 = 0x08000000;

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
            "--window-size=1200,820",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}

fn main() {
    let exe_path = env::current_exe().unwrap_or_default();
    let project_dir = exe_path
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."));

    // 1. Ensure 50Hz high-precision interactive sensor is active in the user session
    let sensor_exe = project_dir.join("desktop").join("interactive_sensor.exe");
    if sensor_exe.exists() {
        let _ = Command::new(&sensor_exe)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }

    // 2. If Next.js dev server on port 3000 is already running, open it directly
    if is_port_open(3000) {
        open_app_window("http://localhost:3000");
        return;
    }

    // 3. Otherwise start Next.js dev server and wait for port 3000
    let pkg_json = project_dir.join("package.json");
    let fallback_dir = std::path::Path::new(r"D:\Desktop\gamevibe");
    let working_dir = if pkg_json.exists() { project_dir } else { fallback_dir };

    let _ = Command::new("cmd")
        .args(["/C", "npm run dev"])
        .current_dir(working_dir)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();

    for _ in 0..40 {
        if is_port_open(3000) {
            open_app_window("http://localhost:3000");
            return;
        }
        thread::sleep(Duration::from_millis(500));
    }

    // Fallback if port 3000 did not open
    open_app_window("http://localhost:3000");
}
