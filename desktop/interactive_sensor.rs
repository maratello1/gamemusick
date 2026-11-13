// Console subsystem so stdout pipes work with Node.js and Next.js /api/telemetry
// Windows hides the console window automatically via windowsHide: true / -WindowStyle Hidden

use std::env;
use std::ffi::c_void;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU32, Ordering};
use std::sync::Once;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[repr(C)]
#[derive(Copy, Clone)]
struct GUID {
    data1: u32,
    data2: u16,
    data3: u16,
    data4: [u8; 8],
}

#[repr(C)]
#[derive(Copy, Clone, Default)]
struct BITMAPINFOHEADER {
    bi_size: u32,
    bi_width: i32,
    bi_height: i32,
    bi_planes: u16,
    bi_bit_count: u16,
    bi_compression: u32,
    bi_size_image: u32,
    bi_xpels_per_meter: i32,
    bi_ypels_per_meter: i32,
    bi_clr_used: u32,
    bi_clr_important: u32,
}

#[repr(C)]
#[derive(Copy, Clone, Default)]
struct BITMAPINFO {
    bmi_header: BITMAPINFOHEADER,
    bmi_colors: [u32; 1],
}

static SUBSYSTEMS_INIT: Once = Once::new();
static WASAPI_AUDIO_PEAK: AtomicI32 = AtomicI32::new(0);
static LAST_CAPTURE_BLOCKED: AtomicBool = AtomicBool::new(false);
static LAST_WARMTH: AtomicI32 = AtomicI32::new(0);
static LAST_COOLNESS: AtomicI32 = AtomicI32::new(0);
static LAST_SATURATION: AtomicI32 = AtomicI32::new(0);
static LAST_TARGET_PID: AtomicU32 = AtomicU32::new(0);
static LAST_AUDIO_POLL_TICK: AtomicU32 = AtomicU32::new(0);
static DPI_AWARE_ENABLED: AtomicBool = AtomicBool::new(false);

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
    fn StretchBlt(
        hdc_dest: isize,
        x_dest: i32,
        y_dest: i32,
        w_dest: i32,
        h_dest: i32,
        hdc_src: isize,
        x_src: i32,
        y_src: i32,
        w_src: i32,
        h_src: i32,
        rop: u32,
    ) -> i32;
    fn SetStretchBltMode(hdc: isize, mode: i32) -> i32;
    fn GetDIBits(
        hdc: isize,
        hbm: isize,
        start: u32,
        c_lines: u32,
        lpv_bits: *mut u8,
        lpbmi: *mut BITMAPINFO,
        usage: u32,
    ) -> i32;
    fn DeleteObject(ho: isize) -> i32;
    fn DeleteDC(hdc: isize) -> i32;
}

#[link(name = "ole32")]
extern "system" {
    fn CoInitializeEx(pv_reserved: *mut c_void, dw_co_init: u32) -> i32;
    fn CoCreateInstance(
        rclsid: *const GUID,
        p_unk_outer: *mut c_void,
        dw_cls_context: u32,
        riid: *const GUID,
        ppv: *mut *mut c_void,
    ) -> i32;
}

type SetProcessDpiAwarenessContextFn = unsafe extern "system" fn(isize) -> i32;
type SetProcessDPIAwareFn = unsafe extern "system" fn() -> i32;
type XInputGetStateFn = unsafe extern "system" fn(u32, *mut XINPUT_STATE) -> u32;
type GetAsyncKeyStateFn = unsafe extern "system" fn(i32) -> i16;
type GetCursorPosFn = unsafe extern "system" fn(*mut POINT) -> i32;

const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
const SRCCOPY: u32 = 0x00CC0020;
const CAPTUREBLT: u32 = 0x40000000;

const DENYLIST: [&str; 65] = [
    "explorer",
    "msedge",
    "chrome",
    "firefox",
    "brave",
    "opera",
    "yandex",
    "vivaldi",
    "chrome-headless-shell",
    "gamemusick",
    "gamevibe",
    "electron",
    "antigravity",
    "searchhost",
    "startmenuexperiencehost",
    "shellexperiencehost",
    "applicationframehost",
    "textinputhost",
    "systemsettings",
    "lockapp",
    "dwm",
    "csrss",
    "audiodg",
    "idle",
    "system",
    "taskmgr",
    "cmd",
    "powershell",
    "pwsh",
    "windowsterminal",
    "conhost",
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
    "whatsapp",
    "slack",
    "teams",
    "spotify",
    "steam",
    "steamwebhelper",
    "epicgameslauncher",
    "nvcontainer",
    "nvidia",
    "xboxpcappft",
    "gamebar",
    "hydra",
    "happ",
    "v2ray",
    "clash",
    "nekoray",
    "sing-box",
    "xray",
    "anydesk",
    "teamviewer",
    "1password",
    "keepass",
    "bitwarden",
    "notepad",
];

fn is_denylisted(proc_name: &str) -> bool {
    let lower = proc_name.to_lowercase();
    let stem = lower.strip_suffix(".exe").unwrap_or(&lower);
    if stem == "node" || stem == "python" || stem == "pythonw" {
        return true;
    }
    DENYLIST.iter().any(|&d| stem == d || lower.contains(d))
}

fn get_process_name_by_pid(pid: u32) -> String {
    if pid == 0 {
        return String::new();
    }
    unsafe {
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

fn get_process_name(hwnd: isize) -> String {
    unsafe {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid != 0 {
            LAST_TARGET_PID.store(pid, Ordering::Relaxed);
        }
        get_process_name_by_pid(pid)
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

fn inspect_window_as_game(hwnd: isize) -> Option<FoundGame> {
    if hwnd == 0 {
        return None;
    }
    unsafe {
        if IsWindowVisible(hwnd) == 0 {
            return None;
        }
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return None;
        }
        let w = rect.right - rect.left;
        let h = rect.bottom - rect.top;
        if w < 300 || h < 200 {
            return None;
        }

        let proc = get_process_name(hwnd);
        if proc.is_empty() || is_denylisted(&proc) {
            return None;
        }

        let title = get_window_title(hwnd);
        let title_lower = title.to_lowercase();
        if title_lower.contains("overlay")
            || title_lower.contains("nvidia")
            || title_lower.contains("geforce")
            || title_lower.contains("settings")
        {
            return None;
        }

        Some(FoundGame {
            hwnd,
            proc,
            title,
            rect,
        })
    }
}

unsafe extern "system" fn enum_game_window_cb(hwnd: isize, lparam: isize) -> i32 {
    let out = &mut *(lparam as *mut Option<FoundGame>);
    if let Some(game) = inspect_window_as_game(hwnd) {
        *out = Some(game);
        return 0; // stop enumeration
    }
    1
}

fn find_running_game() -> Option<FoundGame> {
    unsafe {
        let h_desk = OpenInputDesktop(0, 0, 0x01FF);
        if h_desk != 0 {
            let _ = SetThreadDesktop(h_desk);
        }
        // Foreground window takes strict priority over background Z-order windows
        let fg = GetForegroundWindow();
        if let Some(fg_game) = inspect_window_as_game(fg) {
            return Some(fg_game);
        }
    }
    let mut found: Option<FoundGame> = None;
    unsafe {
        EnumWindows(enum_game_window_cb, &mut found as *mut _ as isize);
    }
    found
}

fn enable_per_monitor_dpi_awareness() {
    unsafe {
        let h_user32 = LoadLibraryA(b"user32.dll\0".as_ptr());
        if h_user32 != 0 {
            let p_ctx = GetProcAddress(h_user32, b"SetProcessDpiAwarenessContext\0".as_ptr());
            if p_ctx != 0 {
                let func: SetProcessDpiAwarenessContextFn = std::mem::transmute(p_ctx);
                // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4
                if func(-4) != 0 || func(-3) != 0 {
                    DPI_AWARE_ENABLED.store(true, Ordering::Relaxed);
                    return;
                }
            }
            let p_aware = GetProcAddress(h_user32, b"SetProcessDPIAware\0".as_ptr());
            if p_aware != 0 {
                let func: SetProcessDPIAwareFn = std::mem::transmute(p_aware);
                if func() != 0 {
                    DPI_AWARE_ENABLED.store(true, Ordering::Relaxed);
                }
            }
        }
    }
}

fn init_sensor_subsystems() {
    SUBSYSTEMS_INIT.call_once(|| {
        enable_per_monitor_dpi_awareness();
        unsafe {
            // COINIT_MULTITHREADED = 0
            let _ = CoInitializeEx(std::ptr::null_mut(), 0);
        }
    });
}

const CLSID_MM_DEVICE_ENUMERATOR: GUID = GUID {
    data1: 0xBCDE0395,
    data2: 0xE52F,
    data3: 0x467C,
    data4: [0x8E, 0x3D, 0xC4, 0x57, 0x92, 0x91, 0x69, 0x2E],
};

const IID_IMM_DEVICE_ENUMERATOR: GUID = GUID {
    data1: 0xA95664D2,
    data2: 0x9614,
    data3: 0x4F35,
    data4: [0xA7, 0x46, 0xDE, 0x8D, 0xB6, 0x36, 0x17, 0xE6],
};

const IID_IAUDIO_SESSION_MANAGER2: GUID = GUID {
    data1: 0x77AA99A0,
    data2: 0x1BD6,
    data3: 0x484F,
    data4: [0x8B, 0xC7, 0x2C, 0x65, 0x4C, 0x9A, 0x9B, 0x6F],
};

const IID_IAUDIO_SESSION_CONTROL2: GUID = GUID {
    data1: 0xBFB7FF88,
    data2: 0x7239,
    data3: 0x4FC9,
    data4: [0x8F, 0xA2, 0x07, 0xC9, 0x50, 0xBE, 0x9C, 0x6D],
};

const IID_IAUDIO_METER_INFORMATION: GUID = GUID {
    data1: 0xC02216F6,
    data2: 0x8C67,
    data3: 0x4B5B,
    data4: [0x9D, 0x00, 0xD0, 0x08, 0xE7, 0x3E, 0x00, 0x64],
};

#[inline]
unsafe fn com_vtbl(obj: *mut c_void) -> *const *const c_void {
    *(obj as *const *const *const c_void)
}

unsafe fn com_release(obj: *mut c_void) {
    if obj.is_null() {
        return;
    }
    let fn_ptr = *com_vtbl(obj).add(2);
    let release_fn: unsafe extern "system" fn(*mut c_void) -> u32 = std::mem::transmute(fn_ptr);
    release_fn(obj);
}

unsafe fn com_query_interface(obj: *mut c_void, iid: &GUID) -> *mut c_void {
    if obj.is_null() {
        return std::ptr::null_mut();
    }
    let fn_ptr = *com_vtbl(obj).add(0);
    let qi_fn: unsafe extern "system" fn(*mut c_void, *const GUID, *mut *mut c_void) -> i32 =
        std::mem::transmute(fn_ptr);
    let mut out: *mut c_void = std::ptr::null_mut();
    if qi_fn(obj, iid as *const GUID, &mut out) >= 0 {
        out
    } else {
        std::ptr::null_mut()
    }
}

fn measure_wasapi_game_audio_peak(target_pid: u32) -> Option<i32> {
    unsafe {
        let mut enum_dev: *mut c_void = std::ptr::null_mut();
        // CLSCTX_ALL = 0x17
        let hr = CoCreateInstance(
            &CLSID_MM_DEVICE_ENUMERATOR,
            std::ptr::null_mut(),
            0x17,
            &IID_IMM_DEVICE_ENUMERATOR,
            &mut enum_dev,
        );
        if hr < 0 || enum_dev.is_null() {
            return None;
        }

        // IMMDeviceEnumerator::GetDefaultAudioEndpoint (slot 4): eRender=0, eMultimedia=1
        let get_default_fn: unsafe extern "system" fn(
            *mut c_void,
            i32,
            i32,
            *mut *mut c_void,
        ) -> i32 = std::mem::transmute(*com_vtbl(enum_dev).add(4));
        let mut device: *mut c_void = std::ptr::null_mut();
        let hr_dev = get_default_fn(enum_dev, 0, 1, &mut device);
        com_release(enum_dev);
        if hr_dev < 0 || device.is_null() {
            return None;
        }

        // IMMDevice::Activate (slot 3)
        let activate_fn: unsafe extern "system" fn(
            *mut c_void,
            *const GUID,
            u32,
            *mut c_void,
            *mut *mut c_void,
        ) -> i32 = std::mem::transmute(*com_vtbl(device).add(3));
        let mut mgr2: *mut c_void = std::ptr::null_mut();
        let hr_act = activate_fn(
            device,
            &IID_IAUDIO_SESSION_MANAGER2,
            0x17,
            std::ptr::null_mut(),
            &mut mgr2,
        );
        com_release(device);
        if hr_act < 0 || mgr2.is_null() {
            return None;
        }

        // IAudioSessionManager2::GetSessionEnumerator (slot 5)
        let get_enum_fn: unsafe extern "system" fn(*mut c_void, *mut *mut c_void) -> i32 =
            std::mem::transmute(*com_vtbl(mgr2).add(5));
        let mut sess_enum: *mut c_void = std::ptr::null_mut();
        let hr_en = get_enum_fn(mgr2, &mut sess_enum);
        com_release(mgr2);
        if hr_en < 0 || sess_enum.is_null() {
            return None;
        }

        // IAudioSessionEnumerator::GetCount (slot 3) & GetSession (slot 4)
        let get_count_fn: unsafe extern "system" fn(*mut c_void, *mut i32) -> i32 =
            std::mem::transmute(*com_vtbl(sess_enum).add(3));
        let get_session_fn: unsafe extern "system" fn(*mut c_void, i32, *mut *mut c_void) -> i32 =
            std::mem::transmute(*com_vtbl(sess_enum).add(4));

        let mut count: i32 = 0;
        if get_count_fn(sess_enum, &mut count) < 0 || count <= 0 {
            com_release(sess_enum);
            return Some(0);
        }

        let self_pid = std::process::id();
        let mut best_target_peak: Option<f32> = None;
        let mut best_game_peak: f32 = 0.0;

        for idx in 0..count.min(64) {
            let mut ctrl: *mut c_void = std::ptr::null_mut();
            if get_session_fn(sess_enum, idx, &mut ctrl) < 0 || ctrl.is_null() {
                continue;
            }

            // IAudioSessionControl::GetState (slot 3): 1 == Active
            let get_state_fn: unsafe extern "system" fn(*mut c_void, *mut i32) -> i32 =
                std::mem::transmute(*com_vtbl(ctrl).add(3));
            let mut state: i32 = 0;
            if get_state_fn(ctrl, &mut state) < 0 || state != 1 {
                com_release(ctrl);
                continue;
            }

            let ctrl2 = com_query_interface(ctrl, &IID_IAUDIO_SESSION_CONTROL2);
            if ctrl2.is_null() {
                com_release(ctrl);
                continue;
            }

            // IAudioSessionControl2::IsSystemSoundsSession (slot 15): 0 == S_OK (system sounds)
            let is_sys_fn: unsafe extern "system" fn(*mut c_void) -> i32 =
                std::mem::transmute(*com_vtbl(ctrl2).add(15));
            if is_sys_fn(ctrl2) == 0 {
                com_release(ctrl2);
                com_release(ctrl);
                continue;
            }

            // IAudioSessionControl2::GetProcessId (slot 14)
            let get_pid_fn: unsafe extern "system" fn(*mut c_void, *mut u32) -> i32 =
                std::mem::transmute(*com_vtbl(ctrl2).add(14));
            let mut pid: u32 = 0;
            let pid_ok = get_pid_fn(ctrl2, &mut pid) >= 0 && pid != 0 && pid != self_pid;
            com_release(ctrl2);
            if !pid_ok {
                com_release(ctrl);
                continue;
            }

            let is_target = target_pid != 0 && pid == target_pid;
            let include = if is_target {
                true
            } else {
                let pname = get_process_name_by_pid(pid);
                !pname.is_empty() && !is_denylisted(&pname)
            };

            if include {
                let meter = com_query_interface(ctrl, &IID_IAUDIO_METER_INFORMATION);
                if !meter.is_null() {
                    // IAudioMeterInformation::GetPeakValue (slot 3)
                    let get_peak_fn: unsafe extern "system" fn(*mut c_void, *mut f32) -> i32 =
                        std::mem::transmute(*com_vtbl(meter).add(3));
                    let mut peak: f32 = 0.0;
                    if get_peak_fn(meter, &mut peak) >= 0 && peak.is_finite() {
                        let clamped = peak.clamp(0.0, 1.0);
                        if is_target {
                            best_target_peak = Some(best_target_peak.unwrap_or(0.0).max(clamped));
                        } else if clamped > best_game_peak {
                            best_game_peak = clamped;
                        }
                    }
                    com_release(meter);
                }
            }

            com_release(ctrl);
        }

        com_release(sess_enum);
        let chosen = best_target_peak.unwrap_or(best_game_peak);
        Some(((chosen * 100.0).round() as i32).clamp(0, 100))
    }
}

fn update_wasapi_peak_throttled() -> i32 {
    let tick = LAST_AUDIO_POLL_TICK.fetch_add(1, Ordering::Relaxed);
    if tick % 4 == 0 {
        let target_pid = LAST_TARGET_PID.load(Ordering::Relaxed);
        if let Some(raw_peak) = measure_wasapi_game_audio_peak(target_pid) {
            let prev = WASAPI_AUDIO_PEAK.load(Ordering::Relaxed);
            // Fast attack, smooth decay so combat booms stay readable
            let smoothed = if raw_peak >= prev {
                (raw_peak * 3 + prev) / 4
            } else {
                (raw_peak + prev * 2) / 3
            };
            WASAPI_AUDIO_PEAK.store(smoothed.clamp(0, 100), Ordering::Relaxed);
        }
    }
    WASAPI_AUDIO_PEAK.load(Ordering::Relaxed)
}

struct VisualSample {
    lumas: [i32; 16],
    red_score: i32,
    is_letterbox: bool,
    has_boss_hp_bar: bool,
}

fn sample_game_visuals(rect: RECT) -> VisualSample {
    const W: usize = 32;
    const H: usize = 18;
    const TOTAL_PX: usize = W * H;

    let _ = update_wasapi_peak_throttled();

    unsafe {
        let rw = (rect.right - rect.left).max(320);
        let rh = (rect.bottom - rect.top).max(200);
        let rx = rect.left;
        let ry = rect.top;

        let hdc_screen = GetDC(0);
        if hdc_screen == 0 {
            LAST_CAPTURE_BLOCKED.store(true, Ordering::Relaxed);
            return VisualSample {
                lumas: [25; 16],
                red_score: 0,
                is_letterbox: false,
                has_boss_hp_bar: false,
            };
        }

        let hdc_mem = CreateCompatibleDC(hdc_screen);
        let hbm = CreateCompatibleBitmap(hdc_screen, W as i32, H as i32);
        let old_obj = SelectObject(hdc_mem, hbm);

        // COLORONCOLOR = 3
        SetStretchBltMode(hdc_mem, 3);
        let blt_ok = StretchBlt(
            hdc_mem,
            0,
            0,
            W as i32,
            H as i32,
            hdc_screen,
            rx,
            ry,
            rw,
            rh,
            SRCCOPY | CAPTUREBLT,
        );

        let mut bmi = BITMAPINFO::default();
        bmi.bmi_header.bi_size = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmi_header.bi_width = W as i32;
        bmi.bmi_header.bi_height = -(H as i32); // top-down DIB
        bmi.bmi_header.bi_planes = 1;
        bmi.bmi_header.bi_bit_count = 32;
        bmi.bmi_header.bi_compression = 0; // BI_RGB

        let mut buf = [0u8; TOTAL_PX * 4];
        let lines = if blt_ok != 0 {
            GetDIBits(hdc_mem, hbm, 0, H as u32, buf.as_mut_ptr(), &mut bmi, 0)
        } else {
            0
        };

        SelectObject(hdc_mem, old_obj);
        DeleteObject(hbm);
        DeleteDC(hdc_mem);
        ReleaseDC(0, hdc_screen);

        if blt_ok == 0 || lines <= 0 {
            LAST_CAPTURE_BLOCKED.store(true, Ordering::Relaxed);
            return VisualSample {
                lumas: [25; 16],
                red_score: 0,
                is_letterbox: false,
                has_boss_hp_bar: false,
            };
        }

        let px_rgb = |x: usize, y: usize| -> (i32, i32, i32, i32) {
            let off = (y * W + x) * 4;
            let b = buf[off] as i32;
            let g = buf[off + 1] as i32;
            let r = buf[off + 2] as i32;
            let l = ((299 * r + 587 * g + 114 * b) / 2550).clamp(0, 100);
            (r, g, b, l)
        };

        // Detect DX12 exclusive-fullscreen zeroed capture buffer
        let mut non_zero_pixels = 0i32;
        let mut red_hits = 0i32;
        let mut warm_hits = 0i32;
        let mut cool_hits = 0i32;
        let mut sat_sum = 0i32;

        // 16-zone grid over center screen (4x4 buckets across 32x18)
        let mut lumas = [0i32; 16];
        for row in 0..4 {
            let y0 = 2 + row * 3;
            let y1 = (y0 + 3).min(H - 1);
            for col in 0..4 {
                let x0 = 2 + col * 7;
                let x1 = (x0 + 7).min(W - 1);
                let mut zone_sum = 0i32;
                let mut zone_cnt = 0i32;
                for y in y0..=y1 {
                    for x in x0..=x1 {
                        let (r, g, b, l) = px_rgb(x, y);
                        if r > 2 || g > 2 || b > 2 {
                            non_zero_pixels += 1;
                        }
                        let max_c = r.max(g).max(b);
                        let min_c = r.min(g).min(b);
                        if max_c > 0 {
                            sat_sum += ((max_c - min_c) * 100) / max_c;
                        }
                        if r > ((g + b) * 2) / 3 && r > 110 {
                            red_hits += 1;
                        }
                        if r > 130 && g >= 65 && b < 95 && r > b + 45 {
                            warm_hits += 1;
                        }
                        if b > 105 && g >= 70 && b > r + 25 {
                            cool_hits += 1;
                        }
                        zone_sum += l;
                        zone_cnt += 1;
                    }
                }
                lumas[row * 4 + col] = if zone_cnt > 0 { zone_sum / zone_cnt } else { 20 };
            }
        }

        let is_blocked = non_zero_pixels == 0;
        LAST_CAPTURE_BLOCKED.store(is_blocked, Ordering::Relaxed);
        let grid_total = (4 * 3) * (4 * 7);
        LAST_WARMTH.store(((warm_hits * 100) / grid_total.max(1)).clamp(0, 100), Ordering::Relaxed);
        LAST_COOLNESS.store(((cool_hits * 100) / grid_total.max(1)).clamp(0, 100), Ordering::Relaxed);
        LAST_SATURATION.store((sat_sum / grid_total.max(1)).clamp(0, 100), Ordering::Relaxed);

        let red_score = ((red_hits * 100) / 48).clamp(0, 100);

        // 2. Letterbox 21:9 Cutscene detection (top row y=0 and bottom row y=17 dark while center is lit)
        let mut top_bar_luma = 0i32;
        let mut bot_bar_luma = 0i32;
        for x in 4..28 {
            top_bar_luma += px_rgb(x, 0).3;
            bot_bar_luma += px_rgb(x, H - 1).3;
        }
        top_bar_luma /= 24;
        bot_bar_luma /= 24;
        let center_avg: i32 = lumas.iter().sum::<i32>() / 16;
        let is_letterbox = !is_blocked && top_bar_luma <= 3 && bot_bar_luma <= 3 && center_avg >= 10;

        // 3. Boss Health Bar Detection (wide crimson/gold horizontal strip at top y=1..2 or bottom y=15..16)
        let mut has_boss_hp_bar = false;
        'boss_scan: for &y in &[1usize, 2, 15, 16] {
            let mut hp_hits = 0;
            for x in 7..25 {
                let (r, g, b, _) = px_rgb(x, y);
                let is_crimson = r > 135 && g < 55 && b < 55 && (r - g.max(b)) > 85;
                let is_gold = r > 185 && g > 130 && b < 60 && (r - b) > 120;
                if is_crimson || is_gold {
                    hp_hits += 1;
                }
            }
            if hp_hits >= 10 {
                has_boss_hp_bar = true;
                break 'boss_scan;
            }
        }

        VisualSample {
            lumas,
            red_score,
            is_letterbox,
            has_boss_hp_bar,
        }
    }
}

fn enrich_sensor_json(raw: &str) -> String {
    let audio_peak = WASAPI_AUDIO_PEAK.load(Ordering::Relaxed);
    let cap_blocked = LAST_CAPTURE_BLOCKED.load(Ordering::Relaxed);
    let warmth = LAST_WARMTH.load(Ordering::Relaxed);
    let coolness = LAST_COOLNESS.load(Ordering::Relaxed);
    let saturation = LAST_SATURATION.load(Ordering::Relaxed);
    let dpi_aware = DPI_AWARE_ENABLED.load(Ordering::Relaxed);
    let extra = format!(
        "\"gameAudioPeak\":{},\"captureBlocked\":{},\"warmth\":{},\"coolness\":{},\"saturation\":{},\"dpiAware\":{},\"version\":\"3.1.0\",\"sensorMode\":\"rust-win32-50hz-wasapi-v31\"",
        audio_peak,
        if cap_blocked { "true" } else { "false" },
        warmth,
        coolness,
        saturation,
        if dpi_aware { "true" } else { "false" }
    );
    raw.replacen("\"sensorMode\":\"rust-win32-50hz-neural-synced\"", &extra, 1)
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
    init_sensor_subsystems();

    if is_once {
        unsafe {
            AttachConsole(0xFFFFFFFF);
        }
    }

    // Single-instance enforcement: if not running --once, ensure only ONE sensor process runs globally
    const ERROR_ALREADY_EXISTS: u32 = 183;
    let (_mutex_handle, is_duplicate) = unsafe {
        SetLastError(0);
        let h = CreateMutexA(0, 0, b"Local\\GameMusick_Sensor_Instance_Mutex_v3\0".as_ptr());
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
    let brain_file = out_dir.join("neural-evolution.json");

    let mut learned_combat = 42;
    let mut learned_stealth = 42;
    let mut learned_boss = 85;
    let mut last_brain_sync_ms: u128 = 0;

    let mut prev_lumas = [40i32; 16];
    let mut has_prev_luma = false;
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

    unsafe extern "system" fn dummy_key(_: i32) -> i16 { 0 }
    unsafe extern "system" fn dummy_pos(_: *mut POINT) -> i32 { 0 }

    let (get_key_fn, get_pos_fn): (GetAsyncKeyStateFn, GetCursorPosFn) = unsafe {
        let h_user = LoadLibraryA(b"user32.dll\0".as_ptr());
        let p_key = if h_user != 0 { GetProcAddress(h_user, b"GetAsyncKeyState\0".as_ptr()) } else { 0 };
        let p_pos = if h_user != 0 { GetProcAddress(h_user, b"GetCursorPos\0".as_ptr()) } else { 0 };
        (
            if p_key != 0 { std::mem::transmute(p_key) } else { dummy_key },
            if p_pos != 0 { std::mem::transmute(p_pos) } else { dummy_pos },
        )
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
            let p_lower = last_game_proc.to_lowercase();
            let is_moba = is_online && (p_lower.contains("dota") || p_lower.contains("league") || p_lower.contains("deadlock"));

            let mut pt_prev = POINT::default();
            get_pos_fn(&mut pt_prev);

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
                    let st = get_key_fn(vk as i32);
                    let is_down = (st as u16 & 0x8000) != 0;
                    if is_down {
                        if !prev_key_states[vk] {
                            if is_online {
                                if is_moba {
                                    if vk == 0x01 {
                                        // Left click in MOBA: selection / menu click
                                        attack_edge_presses += 2;
                                    } else if vk == 0x02 {
                                        // Right click in MOBA: movement / attack move
                                        attack_edge_presses += 4;
                                    } else {
                                        // Abilities (Q, W, E, R, D, F, numbers)
                                        attack_edge_presses += 15;
                                    }
                                } else {
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
                if ((get_key_fn(0x11) as u16 & 0x8000) != 0)
                    || ((get_key_fn(0x43) as u16 & 0x8000) != 0)
                {
                    crouch_held = true;
                }

                for &vk in movement_vkeys.iter() {
                    let st = get_key_fn(vk as i32);
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
                if get_pos_fn(&mut pt_now) != 0 {
                    cursor_travel += (pt_now.x - pt_prev.x).abs() + (pt_now.y - pt_prev.y).abs();
                    pt_prev = pt_now;
                }

                thread::sleep(Duration::from_millis(20));
            }

            let vis = sample_game_visuals(game_rect);
            let mut optical_diff_sum = 0i32;
            let mut luma_sum = 0i32;
            for i in 0..16 {
                if has_prev_luma {
                    optical_diff_sum += (vis.lumas[i] - prev_lumas[i]).abs();
                }
                luma_sum += vis.lumas[i];
                prev_lumas[i] = vis.lumas[i];
            }
            has_prev_luma = true;
            let avg_luma = (luma_sum / 16).clamp(2, 100);
            let luma_variance = (vis.lumas.iter().map(|&l| (l - avg_luma).abs()).sum::<i32>() / 16).clamp(0, 100);
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
                let key_score = (attack_edge_presses * 70 / 100)
                    + (attack_held_ticks * 60 / 100)
                    + move_edge_presses
                    + pad_attack_score;
                if key_score == 0 {
                    8 // zero combat actions in online game
                } else {
                    (walk_base + key_score + (cursor_travel / 250).min(5)).clamp(8, 100)
                }
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
                let raw_energy = ((input_combat * 55) / 100) + ((optical_delta_score * 50) / 100) + (vis.red_score / 3).min(15);
                // In online games (Dota 2, CS2, etc.), 3D hero showcases and animated lobbies
                // must never trigger combat if the player has zero combat attacks or low APM (< 22 input_combat)!
                if input_combat < 22 || attack_edge_presses == 0 {
                    raw_energy.min(20)
                } else {
                    raw_energy
                }
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
            } else if cur_ms.saturating_sub(last_combat_spike_ms) < (if is_online { 6000 } else { 14000 }) && rolling_energy >= 44.0 {
                rolling_energy = (rolling_energy * 0.96).max(46.0);
            } else {
                rolling_energy = (rolling_energy * 0.82 + instant_clamped * 0.18).max(8.0);
            }

            let final_motion = (rolling_energy.round() as i32).clamp(8, 100);
            let is_fighting = if is_online {
                final_motion >= learned_combat && input_combat >= 22 && attack_edge_presses > 0
            } else {
                final_motion >= learned_combat
            };
            let combat_duration_ms = if combat_streak_start_ms > 0 {
                cur_ms.saturating_sub(combat_streak_start_ms)
            } else {
                0
            };

            // Online Respawn / Spectating State Machine
            let mut is_respawn_spectating = false;
            if is_online {
                let recent_combat = cur_ms.saturating_sub(last_combat_spike_ms) < 28000;
                let sustained_fight = combat_duration_ms > 4000;
                let zero_inputs = attack_edge_presses <= 1 && move_edge_presses == 0 && move_held_ticks == 0 && cursor_travel < 200;
                if recent_combat && sustained_fight && zero_inputs {
                    online_respawn_streak += 1;
                } else if !zero_inputs {
                    online_respawn_streak = 0;
                }

                if online_respawn_streak >= 8 {
                    is_respawn_spectating = true;
                    rolling_energy = (rolling_energy * 0.72).max(10.0);
                }
            } else {
                online_respawn_streak = 0;
            }

            if !is_online && ((is_fighting && boss_bar_streak >= 2)
                || (combat_duration_ms > 32000 && final_motion >= (learned_boss - 17))
                || final_motion >= learned_boss)
            {
                last_boss_ms = cur_ms;
            }

            if crouch_held && !is_fighting && avg_luma < learned_stealth {
                last_stealth_ms = cur_ms;
            }

            let in_boss_hold = !is_online && (cur_ms.saturating_sub(last_boss_ms) < 22000);
            let in_combat_hold = cur_ms.saturating_sub(last_combat_spike_ms) < if is_online { 5000 } else { 16000 };
            let in_cutscene_hold = !is_online && (cur_ms.saturating_sub(last_cutscene_ms) < 12000);
            let is_recent_room_change = !is_online && (cur_ms.saturating_sub(last_room_wipe_ms) < 10000);
            let in_stealth_hold = cur_ms.saturating_sub(last_stealth_ms) < 14000;

            let is_standby = last_game_proc == "IDLE_STANDBY" || last_game_proc.is_empty();
            let is_chase_escape = !is_online
                && !is_fighting
                && (move_edge_presses + move_held_ticks >= 4)
                && attack_edge_presses == 0
                && final_motion >= 36
                && vis.red_score >= 20;
            let is_teamfight = is_online
                && (is_fighting || in_combat_hold)
                && (final_motion >= (learned_combat + 18) || attack_edge_presses >= 5);
            let is_horror_dread = !is_online
                && avg_luma < learned_stealth
                && !is_fighting
                && (vis.red_score >= 30 || (luma_variance <= 12 && avg_luma < 26));
            let is_menu_lobby = (cursor_travel >= 160 && attack_edge_presses == 0 && move_edge_presses == 0 && move_held_ticks == 0)
                || (is_online && final_motion < 24 && attack_edge_presses == 0);
            let is_vista_wonder = is_recent_room_change
                || (!is_online && avg_luma >= 58 && luma_variance >= 18 && !is_fighting && final_motion < 30);
            let is_cozy_hub = !is_online
                && avg_luma >= 40
                && final_motion <= 18
                && vis.red_score == 0
                && attack_edge_presses == 0;

            let (vibe, scene_label, scene_hint) = if is_standby {
                ("EXPLORE", "STANDBY", "STANDBY")
            } else if is_respawn_spectating {
                ("DRAMA", "RESPAWN", "RESPAWN")
            } else if in_boss_hold {
                ("BOSSFIGHT", "BOSSFIGHT", "BOSSFIGHT")
            } else if is_chase_escape {
                ("COMBAT", "CHASE_ESCAPE", "CHASE_ESCAPE")
            } else if is_teamfight {
                ("COMBAT", "TEAMFIGHT", "TEAMFIGHT")
            } else if is_fighting || in_combat_hold {
                ("COMBAT", "COMBAT", "COMBAT")
            } else if is_vista_wonder {
                ("MAJESTIC", "MAJESTIC", "VISTA_WONDER")
            } else if in_cutscene_hold {
                ("DRAMA", "DRAMA", "DRAMA")
            } else if is_horror_dread {
                ("STEALTH", "HORROR_DREAD", "HORROR_DREAD")
            } else if in_stealth_hold {
                ("STEALTH", "STEALTH", "STEALTH")
            } else if is_menu_lobby {
                ("EXPLORE", "MENU_LOBBY", "MENU_LOBBY")
            } else if is_cozy_hub {
                ("EXPLORE", "COZY_HUB", "COZY_HUB")
            } else {
                ("EXPLORE", "EXPLORE", "EXPLORE")
            };

            let out_motion = if is_standby { 10 } else { final_motion };
            let out_red = if is_standby { 0 } else { vis.red_score };
            let out_cutscene = if is_standby { "false" } else if in_cutscene_hold { "true" } else { "false" };
            let out_room_wipe = if is_standby { "false" } else if is_recent_room_change { "true" } else { "false" };
            let out_cursor = if is_standby { 0 } else { cursor_travel };
            let out_attack = if is_standby { 0 } else { attack_edge_presses };
            let out_move = if is_standby { 0 } else { move_edge_presses };
            let out_luma_var = if is_standby { 0 } else { luma_variance };

            let json = format!(
                "{{\"timestamp\":{},\"detectedProcess\":\"{}\",\"windowTitle\":\"{}\",\"motionDelta\":{},\"redAlertRatio\":{},\"brightness\":{},\"lumaVariance\":{},\"cursorTravel\":{},\"attackApm\":{},\"moveApm\":{},\"inferredVibe\":\"{}\",\"sceneEmotion\":\"{}\",\"sceneLabel\":\"{}\",\"sceneHint\":\"{}\",\"isCutscene\":{},\"isNewLocation\":{},\"gameAudioDucked\":false,\"sensorMode\":\"rust-win32-50hz-neural-synced\",\"learnedCombatThreshold\":{},\"learnedStealthThreshold\":{},\"isOnlineGame\":{},\"isRespawnSpectating\":{}}}",
                cur_ms,
                last_game_proc,
                last_game_title,
                out_motion,
                out_red,
                avg_luma,
                out_luma_var,
                out_cursor,
                out_attack,
                out_move,
                vibe,
                vibe,
                scene_label,
                scene_hint,
                out_cutscene,
                out_room_wipe,
                learned_combat,
                learned_stealth,
                if is_online { "true" } else { "false" },
                if is_respawn_spectating { "true" } else { "false" }
            );

            let json = enrich_sensor_json(&json);
            let _ = fs::write(&out_file, &json);

            if is_once {
                println!("{}", json);
                return;
            }
        }
    }
}
