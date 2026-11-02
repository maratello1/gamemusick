#![windows_subsystem = "windows"]

use std::env;
use std::net::TcpStream;
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::thread;
use std::time::Duration;

const CREATE_NO_WINDOW: u32 = 0x08000000;

fn is_server_running() -> bool {
    TcpStream::connect("127.0.0.1:3000").is_ok()
}

fn main() {
    let exe_path = env::current_exe().unwrap_or_default();
    let project_dir = exe_path
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."));

    // 1. Ensure local Next.js Core Engine is running on port 3000
    if !is_server_running() {
        let _ = Command::new("cmd")
            .args(["/C", "npm run dev"])
            .current_dir(project_dir)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();

        for _ in 0..35 {
            if is_server_running() {
                break;
            }
            thread::sleep(Duration::from_millis(500));
        }
    }

    // 2. Try launching standalone Electron Desktop Client if installed, otherwise native WebView2 App Mode
    let electron_bin = project_dir.join("node_modules\\.bin\\electron.cmd");
    if electron_bin.exists() {
        let _ = Command::new("cmd")
            .args(["/C", "npx electron desktop/main.js"])
            .current_dir(project_dir)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    } else {
        let _ = Command::new("cmd")
            .args([
                "/C",
                "start",
                "",
                "msedge",
                "--app=http://localhost:3000",
                "--window-size=1460,920",
            ])
            .current_dir(project_dir)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
}
