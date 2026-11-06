using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Globalization;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class GameSensor
{
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll")]
    static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll")]
    static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, int dwRop);

    [DllImport("gdi32.dll")]
    static extern uint GetPixel(IntPtr hdc, int nXPos, int nYPos);

    [DllImport("gdi32.dll")]
    static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll")]
    static extern bool DeleteDC(IntPtr hdc);

    [StructLayout(LayoutKind.Sequential)]
    public struct XINPUT_GAMEPAD
    {
        public ushort wButtons;
        public byte bLeftTrigger;
        public byte bRightTrigger;
        public short sThumbLX;
        public short sThumbLY;
        public short sThumbRX;
        public short sThumbRY;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct XINPUT_STATE
    {
        public uint dwPacketNumber;
        public XINPUT_GAMEPAD Gamepad;
    }

    [DllImport("xinput1_4.dll", EntryPoint = "XInputGetState")]
    static extern uint XInputGetState14(uint dwUserIndex, out XINPUT_STATE pState);

    [DllImport("xinput9_1_0.dll", EntryPoint = "XInputGetState")]
    static extern uint XInputGetState910(uint dwUserIndex, out XINPUT_STATE pState);

    static uint SafeXInputGetState(uint dwUserIndex, out XINPUT_STATE pState)
    {
        pState = new XINPUT_STATE();
        try { return XInputGetState14(dwUserIndex, out pState); }
        catch
        {
            try { return XInputGetState910(dwUserIndex, out pState); }
            catch { return 1167; }
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct JOYINFOEX
    {
        public uint dwSize;
        public uint dwFlags;
        public uint dwXpos;
        public uint dwYpos;
        public uint dwZpos;
        public uint dwRpos;
        public uint dwUpos;
        public uint dwVpos;
        public uint dwButtons;
        public uint dwButtonNumber;
        public uint dwPOV;
        public uint dwReserved1;
        public uint dwReserved2;
    }

    [DllImport("winmm.dll")]
    static extern uint joyGetPosEx(uint uJoyID, ref JOYINFOEX pji);

    [ComImport]
    [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    internal class MMDeviceEnumeratorComObject { }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDeviceEnumerator
    {
        int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IntPtr ppDevices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDevice
    {
        int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    }

    [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionManager2
    {
        int GetAudioSessionControl(IntPtr AudioSessionGuid, uint StreamFlags, out IntPtr SessionControl);
        int GetSimpleAudioVolume(IntPtr AudioSessionGuid, uint StreamFlags, out IntPtr AudioVolume);
        int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);
    }

    [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionEnumerator
    {
        int GetCount(out int SessionCount);
        int GetSession(int SessionCount, out IAudioSessionControl Session);
    }

    [Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionControl
    {
        int GetState(out int pRetVal);
    }

    [Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionControl2
    {
        int GetState(out int pRetVal);
        int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, Guid EventContext);
        int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, Guid EventContext);
        int GetGroupingParam(out Guid pRetVal);
        int SetGroupingParam(Guid Override, Guid EventContext);
        int RegisterAudioSessionNotification(IntPtr NewNotifications);
        int UnregisterAudioSessionNotification(IntPtr NewNotifications);
        int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        int GetProcessId(out uint pRetVal);
        int IsSystemSoundsSession();
        int SetDuckingPreference(bool optOut);
    }

    [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface ISimpleAudioVolume
    {
        int SetMasterVolume(float fLevel, ref Guid EventContext);
        int GetMasterVolume(out float pfLevel);
        int SetMute(bool bMute, ref Guid EventContext);
        int GetMute(out bool pbMute);
    }

    [Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioMeterInformation
    {
        int GetPeakValue(out float pfPeak);
    }

    class TrackedAudioSession
    {
        public uint Pid;
        public string ProcessName;
        public string WindowTitle;
        public IAudioMeterInformation Meter;
        public ISimpleAudioVolume Volume;
    }

    const int SRCCOPY = 0x00CC0020;

    static readonly HashSet<string> IgnoredProcesses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "explorer", "msedge", "chrome", "firefox", "brave", "opera", "vivaldi",
        "powershell", "pwsh", "cmd", "conhost", "WindowsTerminal", "GameVibe",
        "interactive_sensor", "node", "ApplicationFrameHost", "SearchHost",
        "StartMenuExperienceHost", "ShellExperienceHost", "Taskmgr", "svchost",
        "audiodg", "System", "Idle", "TextInputHost", "LockApp", "dwm", "csrss",
        "Antigravity", "Code", "Cursor", "Windsurf", "Discord", "Telegram",
        "Spotify", "Steam", "steamwebhelper", "EpicGamesLauncher", "nvcontainer",
        "NVIDIA Share", "NVIDIA Overlay", "GameBar", "XboxPcAppFt",
        "happ", "hydra", "v2ray", "clash", "nekoray", "sing-box", "xray", "anydesk", "teamviewer"
    };

    static readonly HashSet<int> AttackKeys = new HashSet<int>
    {
        0x01, 0x02,             // LMB, RMB
        0x5A, 0x58, 0x43, 0x56, // Z, X, C, V (classic platformer attack/jump/special)
        0x51, 0x45, 0x52, 0x46, 0x47, // Q, E, R, F, G
        0x4A, 0x4B, 0x4C, 0x55, 0x49, 0x4F, // J, K, L, U, I, O
        0x20,                   // Space (action / attack)
        0x31, 0x32, 0x33, 0x34  // 1, 2, 3, 4
    };

    static readonly HashSet<int> DirectionKeys = new HashSet<int>
    {
        0x57, 0x41, 0x53, 0x44, // WASD
        0x25, 0x26, 0x27, 0x28  // Arrows
    };

    static string CleanJson(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", " ").Replace("\n", " ").Trim();
    }

    static List<TrackedAudioSession> DiscoverGameAudioSessions()
    {
        var list = new List<TrackedAudioSession>();
        try
        {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            IMMDevice device;
            enumerator.GetDefaultAudioEndpoint(0, 1, out device);
            if (device == null) return list;

            Guid iidMgr = new Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");
            object objMgr;
            device.Activate(ref iidMgr, 23, IntPtr.Zero, out objMgr);
            var mgr = objMgr as IAudioSessionManager2;
            if (mgr == null) return list;

            IAudioSessionEnumerator sessionEnum;
            mgr.GetSessionEnumerator(out sessionEnum);
            if (sessionEnum == null) return list;

            int count = 0;
            sessionEnum.GetCount(out count);
            for (int i = 0; i < count; i++)
            {
                IAudioSessionControl ctrl;
                sessionEnum.GetSession(i, out ctrl);
                var ctrl2 = ctrl as IAudioSessionControl2;
                var meter = ctrl as IAudioMeterInformation;
                var vol = ctrl as ISimpleAudioVolume;
                if (ctrl2 != null && meter != null)
                {
                    uint pid = 0;
                    ctrl2.GetProcessId(out pid);
                    if (pid > 0)
                    {
                        try
                        {
                            Process p = Process.GetProcessById((int)pid);
                            string pName = p.ProcessName;
                            if (!IgnoredProcesses.Contains(pName))
                            {
                                string wTitle = "";
                                try { wTitle = p.MainWindowTitle; } catch { }
                                list.Add(new TrackedAudioSession
                                {
                                    Pid = pid,
                                    ProcessName = pName,
                                    WindowTitle = !string.IsNullOrEmpty(wTitle) ? wTitle : pName,
                                    Meter = meter,
                                    Volume = vol
                                });
                            }
                        }
                        catch { }
                    }
                }
            }
        }
        catch { }
        return list;
    }

    // High-performance cinematic vision & palette analyzer:
    static void SampleCinematicVision(
        out int avgLuma,
        out bool isLetterboxCutscene,
        out int warmAweScore,
        out int coldDramaScore
    )
    {
        avgLuma = 30;
        isLetterboxCutscene = false;
        warmAweScore = 0;
        coldDramaScore = 0;

        try
        {
            int w = Math.Max(800, GetSystemMetrics(0));
            int h = Math.Max(600, GetSystemMetrics(1));
            IntPtr hdcScreen = GetDC(IntPtr.Zero);
            IntPtr hdcMem = CreateCompatibleDC(hdcScreen);
            IntPtr hbm = CreateCompatibleBitmap(hdcScreen, 1, 1);
            IntPtr oldObj = SelectObject(hdcMem, hbm);

            // 1. Cinematic letterbox bars check
            int[] borderYs = new int[] { (int)(h * 0.025), (int)(h * 0.975) };
            int[] borderXs = new int[] { (int)(w * 0.25), (int)(w * 0.50), (int)(w * 0.75) };
            int blackBorderCount = 0;

            foreach (int by in borderYs)
            {
                foreach (int bx in borderXs)
                {
                    BitBlt(hdcMem, 0, 0, 1, 1, hdcScreen, bx, by, SRCCOPY);
                    uint color = GetPixel(hdcMem, 0, 0);
                    if (color != 0xFFFFFFFF)
                    {
                        int r = (int)(color & 0xFF);
                        int g = (int)((color >> 8) & 0xFF);
                        int b = (int)((color >> 16) & 0xFF);
                        if (r <= 8 && g <= 8 && b <= 8) blackBorderCount++;
                    }
                }
            }

            // 2. Grid sampling across active game area (5x5 grid = 25 points for reliable coverage)
            int lumaSum = 0;
            int warmSum = 0;
            int dramaSum = 0;
            int sampledPoints = 0;

            for (int gy = 1; gy <= 5; gy++)
            {
                int cy = (int)(h * (0.15 + gy * 0.14));
                for (int gx = 1; gx <= 5; gx++)
                {
                    int cx = (int)(w * (0.15 + gx * 0.14));
                    BitBlt(hdcMem, 0, 0, 1, 1, hdcScreen, cx, cy, SRCCOPY);
                    uint color = GetPixel(hdcMem, 0, 0);
                    if (color != 0xFFFFFFFF)
                    {
                        int r = (int)(color & 0xFF);
                        int g = (int)((color >> 8) & 0xFF);
                        int b = (int)((color >> 16) & 0xFF);
                        int l = (299 * r + 587 * g + 114 * b) / 2550;
                        lumaSum += l;
                        sampledPoints++;

                        int maxC = Math.Max(r, Math.Max(g, b));
                        int minC = Math.Min(r, Math.Min(g, b));
                        int sat = maxC - minC;

                        // Warm Majestic: bright golden sunlight, rich vistas, sky hues
                        if (l > 42 && (r > b + 15 || (g > 100 && b > 100)) && sat > 25)
                        {
                            warmSum += 8;
                        }
                        // Tragic Drama: heavy cold blue tint or blood crimson
                        if ((b > r + 25 && l > 10 && l < 60) || (r > g + 40 && r > b + 40 && l > 15))
                        {
                            dramaSum += 8;
                        }
                    }
                }
            }

            avgLuma = sampledPoints > 0 ? (lumaSum / sampledPoints) : 30;
            // Letterbox bars require all 6 border points to be pitch black AND illuminated center
            isLetterboxCutscene = (blackBorderCount == 6 && avgLuma >= 15);
            warmAweScore = Math.Min(100, warmSum);
            coldDramaScore = Math.Min(100, dramaSum);

            SelectObject(hdcMem, oldObj);
            DeleteObject(hbm);
            DeleteDC(hdcMem);
            ReleaseDC(IntPtr.Zero, hdcScreen);
        }
        catch { }
    }

    public static void Main(string[] args)
    {
        bool singleShot = args != null && args.Length > 0 && args[0] == "--once";
        string exeDir = AppDomain.CurrentDomain.BaseDirectory;
        string dataDir = Path.GetFullPath(Path.Combine(exeDir, "..", "data"));
        if (!Directory.Exists(dataDir))
        {
            dataDir = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "data"));
        }
        try { Directory.CreateDirectory(dataDir); } catch { }
        string outFile = Path.Combine(dataDir, "live-sensor.json");
        string tmpFile = Path.Combine(dataDir, "live-sensor.tmp.json");
        string appStateFile = Path.Combine(dataDir, "app-state.json");

        bool[] prevKeyStates = new bool[256];
        ushort[] prevPadButtons = new ushort[4];
        bool[] prevPadLT = new bool[4];
        bool[] prevPadRT = new bool[4];
        uint[] prevJoyButtons = new uint[4];

        int[] combatActionsHistory = new int[8]; // 8 x 250ms = 2.0s sliding window
        int historyIdx = 0;

        float rollingAudioBaseline = -1.0f;
        long lastCombatDetectedMs = 0;
        long lastPlayerInputMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        long lastDirectionInputMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // Room Transition / Fade to Black state
        int blackFrameStreak = 0;
        long lastRoomTransitionMs = 0;
        int letterboxStreak = 0;
        long lastCutsceneActiveMs = 0;

        string activeState = "EXPLORE";
        string emotionTag = "EXPLORE";
        string sceneKey = "EXPLORE_PEACE";

        int cycleCounter = 0;
        List<TrackedAudioSession> cachedSessions = DiscoverGameAudioSessions();

        string lastKnownGame = "";
        string lastKnownTitle = "Ожидание игры";

        Guid emptyGuid = Guid.Empty;

        while (true)
        {
            if (cycleCounter % 12 == 0)
            {
                cachedSessions = DiscoverGameAudioSessions();
            }
            cycleCounter++;

            // 1. In-Game Audio Ducking Controller
            bool shouldDuck = false;
            try
            {
                if (File.Exists(appStateFile))
                {
                    string appJson = File.ReadAllText(appStateFile);
                    if (appJson.Contains("\"isPlaying\": true") || appJson.Contains("\"isPlaying\":true"))
                    {
                        shouldDuck = true;
                    }
                }
            }
            catch { }

            float targetGameVol = shouldDuck ? 0.18f : 1.0f;
            foreach (var gs in cachedSessions)
            {
                if (gs.Volume != null)
                {
                    try
                    {
                        float cur = 1f;
                        gs.Volume.GetMasterVolume(out cur);
                        if (Math.Abs(cur - targetGameVol) > 0.05f)
                        {
                            gs.Volume.SetMasterVolume(targetGameVol, ref emptyGuid);
                        }
                    }
                    catch { }
                }
            }

            // 2. Foreground Window Check
            bool isGameInForeground = false;
            string fgName = "";
            string fgTitle = "";
            try
            {
                IntPtr hwnd = GetForegroundWindow();
                if (hwnd != IntPtr.Zero)
                {
                    StringBuilder sb = new StringBuilder(256);
                    GetWindowText(hwnd, sb, 256);
                    fgTitle = sb.ToString();
                    uint fgPid = 0;
                    GetWindowThreadProcessId(hwnd, out fgPid);
                    if (fgPid > 0)
                    {
                        Process fp = Process.GetProcessById((int)fgPid);
                        if (!IgnoredProcesses.Contains(fp.ProcessName))
                        {
                            fgName = fp.ProcessName;
                            isGameInForeground = true;
                        }
                    }
                }
            }
            catch { }

            string audioGameName = "";
            string audioGameTitle = "";
            float maxAudioPeak = 0f;
            float sumAudioPeak = 0f;

            int tickAttackPresses = 0;
            bool directionPressed = false;
            bool anyKeyPressed = false;

            // 10 ticks x 25ms = 250ms window
            int ticks = 10;
            for (int t = 0; t < ticks; t++)
            {
                if (isGameInForeground || (!string.IsNullOrEmpty(lastKnownGame)))
                {
                    foreach (int vk in DirectionKeys)
                    {
                        if ((GetAsyncKeyState(vk) & 0x8000) != 0)
                        {
                            directionPressed = true;
                            anyKeyPressed = true;
                        }
                    }

                    foreach (int vk in AttackKeys)
                    {
                        bool isDown = (GetAsyncKeyState(vk) & 0x8000) != 0;
                        if (isDown) anyKeyPressed = true;
                        if (isDown && !prevKeyStates[vk])
                        {
                            tickAttackPresses++;
                        }
                        prevKeyStates[vk] = isDown;
                    }
                }

                // Gamepads
                for (uint padIdx = 0; padIdx < 4; padIdx++)
                {
                    XINPUT_STATE xs;
                    if (SafeXInputGetState(padIdx, out xs) == 0)
                    {
                        ushort btns = xs.Gamepad.wButtons;
                        ushort newly = (ushort)(btns & ~prevPadButtons[padIdx]);
                        prevPadButtons[padIdx] = btns;

                        if (Math.Abs(xs.Gamepad.sThumbLX) > 8000 || Math.Abs(xs.Gamepad.sThumbLY) > 8000)
                        {
                            directionPressed = true;
                            anyKeyPressed = true;
                        }

                        if ((newly & 0xF300) != 0) tickAttackPresses++;

                        bool ltDown = xs.Gamepad.bLeftTrigger > 45;
                        bool rtDown = xs.Gamepad.bRightTrigger > 45;
                        if (ltDown && !prevPadLT[padIdx]) tickAttackPresses++;
                        if (rtDown && !prevPadRT[padIdx]) tickAttackPresses++;
                        prevPadLT[padIdx] = ltDown;
                        prevPadRT[padIdx] = rtDown;
                    }
                    else
                    {
                        try
                        {
                            JOYINFOEX ji = new JOYINFOEX();
                            ji.dwSize = (uint)Marshal.SizeOf(typeof(JOYINFOEX));
                            ji.dwFlags = 0xFF;
                            if (joyGetPosEx(padIdx, ref ji) == 0)
                            {
                                uint btns = ji.dwButtons;
                                uint newly = btns & ~prevJoyButtons[padIdx];
                                prevJoyButtons[padIdx] = btns;
                                if (newly != 0) tickAttackPresses++;
                            }
                        }
                        catch { }
                    }
                }

                // Game audio peak
                float p = 0f;
                foreach (var gs in cachedSessions)
                {
                    try { gs.Meter.GetPeakValue(out p); } catch { }
                    if (string.IsNullOrEmpty(audioGameName))
                    {
                        audioGameName = gs.ProcessName;
                        audioGameTitle = gs.WindowTitle;
                    }
                    if (p > maxAudioPeak)
                    {
                        maxAudioPeak = p;
                        audioGameName = gs.ProcessName;
                        audioGameTitle = gs.WindowTitle;
                    }
                }
                sumAudioPeak += maxAudioPeak;

                Thread.Sleep(25);
            }

            long nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            if (anyKeyPressed) lastPlayerInputMs = nowMs;
            if (directionPressed) lastDirectionInputMs = nowMs;

            if (!string.IsNullOrEmpty(fgName))
            {
                lastKnownGame = fgName;
                lastKnownTitle = !string.IsNullOrEmpty(fgTitle) ? fgTitle : fgName;
            }
            else if (!string.IsNullOrEmpty(audioGameName) && maxAudioPeak > 0.02f)
            {
                lastKnownGame = audioGameName;
                lastKnownTitle = !string.IsNullOrEmpty(audioGameTitle) ? audioGameTitle : audioGameName;
            }
            else if (string.IsNullOrEmpty(lastKnownGame))
            {
                lastKnownGame = "Ожидание игры";
                lastKnownTitle = "Ожидание игры";
            }

            combatActionsHistory[historyIdx] = tickAttackPresses;
            historyIdx = (historyIdx + 1) % combatActionsHistory.Length;

            int totalAttackPressesIn2s = 0;
            for (int i = 0; i < combatActionsHistory.Length; i++)
            {
                totalAttackPressesIn2s += combatActionsHistory[i];
            }

            float avgPeak = sumAudioPeak / ticks;
            if (avgPeak > 0.001f)
            {
                if (rollingAudioBaseline < 0f) rollingAudioBaseline = avgPeak;
                else rollingAudioBaseline = rollingAudioBaseline * 0.95f + avgPeak * 0.05f;
            }
            bool isAudioSurging = (rollingAudioBaseline > 0.002f && maxAudioPeak > rollingAudioBaseline * 1.8f && maxAudioPeak > 0.05f);

            // 3. Vision & Palette Sampling
            int avgLuma = 30;
            bool isLetterboxCutscene = false;
            int warmAweScore = 0;
            int coldDramaScore = 0;
            SampleCinematicVision(out avgLuma, out isLetterboxCutscene, out warmAweScore, out coldDramaScore);

            // Letterbox bars require sustained detection (at least 4 ticks = ~800ms)
            if (isLetterboxCutscene) letterboxStreak++;
            else letterboxStreak = 0;
            bool sustainedLetterbox = (letterboxStreak >= 4);

            // Room Transition / Screen Wipe detection (transient screen wipe of 1 to 8 cycles = 0.2s - 1.6s)
            if (avgLuma <= 3)
            {
                blackFrameStreak++;
            }
            else
            {
                if (blackFrameStreak >= 1 && blackFrameStreak <= 8)
                {
                    lastRoomTransitionMs = nowMs;
                }
                blackFrameStreak = 0;
            }

            // Neural OCR Dialogue Context Reading (WinRT hardware OCR)
            string dialogueFile = Path.Combine(dataDir, "live-dialogue.json");
            bool isOcrDialogueActive = false;
            string dialogueEmotion = "";
            try
            {
                if (File.Exists(dialogueFile))
                {
                    string dJson = File.ReadAllText(dialogueFile);
                    if (dJson.Contains("\"isDialogueActive\": true") || dJson.Contains("\"isDialogueActive\":true"))
                    {
                        isOcrDialogueActive = true;
                        if (dJson.Contains("\"emotion\": \"DRAMA\"") || dJson.Contains("\"emotion\":\"DRAMA\"")) dialogueEmotion = "DRAMA";
                        else if (dJson.Contains("\"emotion\": \"MAJESTIC\"") || dJson.Contains("\"emotion\":\"MAJESTIC\"")) dialogueEmotion = "MAJESTIC";
                        else if (dJson.Contains("\"emotion\": \"COMBAT\"") || dJson.Contains("\"emotion\":\"COMBAT\"")) dialogueEmotion = "COMBAT";
                        else if (dJson.Contains("\"emotion\": \"EXPLORE\"") || dJson.Contains("\"emotion\":\"EXPLORE\"")) dialogueEmotion = "EXPLORE";
                    }
                }
            }
            catch { }

            if (isOcrDialogueActive || sustainedLetterbox)
            {
                lastCutsceneActiveMs = nowMs;
            }

            bool inCutsceneSession = (nowMs - lastCutsceneActiveMs < 12000);
            bool isRecentRoomTransition = (nowMs - lastRoomTransitionMs < 12000);

            // Combat requires real attack inputs
            bool isActivelyFighting = (totalAttackPressesIn2s >= 2) || (totalAttackPressesIn2s >= 1 && isAudioSurging);

            // High-stability State Machine:
            if (isActivelyFighting)
            {
                lastCombatDetectedMs = nowMs;
                activeState = "COMBAT";
                emotionTag = "COMBAT";
                sceneKey = "COMBAT_ACTION";
            }
            else if (nowMs - lastCombatDetectedMs < 20000)
            {
                // Hold battle state during fight encounter for 20s
                activeState = "COMBAT";
                emotionTag = "COMBAT";
                sceneKey = "COMBAT_ACTION";
            }
            else if (isRecentRoomTransition)
            {
                // New Location entered!
                if (warmAweScore > coldDramaScore && warmAweScore >= 25)
                {
                    activeState = "MAJESTIC";
                    emotionTag = "MAJESTIC";
                    sceneKey = "NEW_LOCATION_MAJESTIC";
                }
                else
                {
                    activeState = "DRAMA";
                    emotionTag = "DRAMA";
                    sceneKey = "NEW_LOCATION_DRAMA";
                }
            }
            else if (inCutsceneSession)
            {
                if (!string.IsNullOrEmpty(dialogueEmotion))
                {
                    activeState = dialogueEmotion;
                    emotionTag = dialogueEmotion;
                    sceneKey = dialogueEmotion + "_CUTSCENE";
                }
                else if (warmAweScore > coldDramaScore && warmAweScore >= 30)
                {
                    activeState = "MAJESTIC";
                    emotionTag = "MAJESTIC";
                    sceneKey = "MAJESTIC_CUTSCENE";
                }
                else
                {
                    activeState = "DRAMA";
                    emotionTag = "DRAMA";
                    sceneKey = "DRAMA_CUTSCENE";
                }
            }
            else
            {
                // SOLID ROAMING BASELINE (EXPLORATION)
                activeState = "EXPLORE";
                emotionTag = "EXPLORE";
                sceneKey = "EXPLORE_PEACE";
            }

            int displayMotion = (activeState == "COMBAT")
                ? Math.Min(95, 55 + totalAttackPressesIn2s * 8)
                : 16;

            string json = string.Format(
                CultureInfo.InvariantCulture,
                "{{\"timestamp\":{0},\"detectedProcess\":\"{1}\",\"windowTitle\":\"{2}\",\"motionDelta\":{3},\"redAlertRatio\":0,\"brightness\":{4},\"inferredVibe\":\"{5}\",\"sceneEmotion\":\"{6}\",\"sceneKey\":\"{7}\",\"isCutscene\":{8},\"isNewLocation\":{9},\"gameAudioDucked\":{10},\"sensorMode\":\"cinematic-vision-50hz\"}}",
                nowMs,
                CleanJson(lastKnownGame),
                CleanJson(lastKnownTitle),
                displayMotion,
                avgLuma,
                activeState,
                emotionTag,
                sceneKey,
                (activeState != "COMBAT" && inCutsceneSession) ? "true" : "false",
                isRecentRoomTransition ? "true" : "false",
                shouldDuck ? "true" : "false"
            );

            try
            {
                File.WriteAllText(tmpFile, json, new UTF8Encoding(false));
                if (File.Exists(outFile)) File.Delete(outFile);
                File.Move(tmpFile, outFile);
            }
            catch { }

            if (singleShot)
            {
                break;
            }
        }
    }
}
