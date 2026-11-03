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
    static extern bool GetCursorPos(out POINT lpPoint);

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
    public struct POINT
    {
        public int X;
        public int Y;
    }

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
    }

    const int SRCCOPY = 0x00CC0020;
    const int CAPTUREBLT = 0x40000000;

    static readonly HashSet<string> IgnoredProcesses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "explorer", "msedge", "chrome", "firefox", "brave", "opera", "vivaldi",
        "powershell", "pwsh", "cmd", "conhost", "WindowsTerminal", "GameVibe",
        "interactive_sensor", "node", "ApplicationFrameHost", "SearchHost",
        "StartMenuExperienceHost", "ShellExperienceHost", "Taskmgr", "svchost",
        "audiodg", "System", "Idle", "TextInputHost", "LockApp", "dwm", "csrss",
        "Antigravity", "Code", "Cursor", "Windsurf", "Discord", "Telegram",
        "Spotify", "Steam", "steamwebhelper", "EpicGamesLauncher", "nvcontainer",
        "NVIDIA Share", "NVIDIA Overlay", "GameBar", "XboxPcAppFt"
    };

    // Dedicated attack and action keys in PC games:
    // Mouse: LMB(0x01), RMB(0x02)
    // Keys: Z, X, C, V (classic platformer attack/jump/special)
    // Q, E, R, F, G, Space (skill / action / dodge)
    // J, K, L, U, I, O (arcade combat)
    // 1, 2, 3, 4 (ability hotkeys)
    static readonly HashSet<int> AttackKeys = new HashSet<int>
    {
        0x01, 0x02,             // LMB, RMB
        0x5A, 0x58, 0x43, 0x56, // Z, X, C, V
        0x51, 0x45, 0x52, 0x46, 0x47, // Q, E, R, F, G
        0x4A, 0x4B, 0x4C, 0x55, 0x49, 0x4F, // J, K, L, U, I, O
        0x20,                   // Space (action / attack)
        0x31, 0x32, 0x33, 0x34  // 1, 2, 3, 4
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
                                    Meter = meter
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

    static void SampleScreenAverage(out int avgLuma, out bool isFullscreenDamageFlash)
    {
        avgLuma = 30;
        isFullscreenDamageFlash = false;
        try
        {
            int w = Math.Max(800, GetSystemMetrics(0));
            int h = Math.Max(600, GetSystemMetrics(1));
            IntPtr hdcScreen = GetDC(IntPtr.Zero);
            IntPtr hdcMem = CreateCompatibleDC(hdcScreen);
            IntPtr hbm = CreateCompatibleBitmap(hdcScreen, 1, 1);
            IntPtr oldObj = SelectObject(hdcMem, hbm);

            // Sample 9 spread points to gauge overall scene brightness
            int[] xs = new int[] { w / 4, w / 2, (w * 3) / 4 };
            int[] ys = new int[] { h / 4, h / 2, (h * 3) / 4 };

            int lumaSum = 0;
            int redDominatedCount = 0;

            foreach (int y in ys)
            {
                foreach (int x in xs)
                {
                    BitBlt(hdcMem, 0, 0, 1, 1, hdcScreen, x, y, SRCCOPY);
                    uint color = GetPixel(hdcMem, 0, 0);
                    if (color != 0xFFFFFFFF)
                    {
                        int r = (int)(color & 0xFF);
                        int g = (int)((color >> 8) & 0xFF);
                        int b = (int)((color >> 16) & 0xFF);
                        lumaSum += (299 * r + 587 * g + 114 * b) / 2550;
                        if (r > 150 && r > (g + b) * 1.2) redDominatedCount++;
                    }
                }
            }

            avgLuma = Math.Max(5, Math.Min(100, lumaSum / 9));
            // Only true fullscreen red flash if at least 7 of 9 points across the entire screen turn red at once
            isFullscreenDamageFlash = (redDominatedCount >= 7);

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
        string dataDir = @"D:\Desktop\gamevibe\data";
        try { Directory.CreateDirectory(dataDir); } catch { }
        string outFile = Path.Combine(dataDir, "live-sensor.json");
        string tmpFile = Path.Combine(dataDir, "live-sensor.tmp.json");

        bool[] prevKeyStates = new bool[256];
        ushort[] prevPadButtons = new ushort[4];
        bool[] prevPadLT = new bool[4];
        bool[] prevPadRT = new bool[4];
        uint[] prevJoyButtons = new uint[4];

        // 8 slots x 250ms = 2.0s sliding window for combat action frequency
        int[] combatActionsHistory = new int[8];
        int historyIdx = 0;

        float rollingAudioBaseline = -1.0f;
        long lastCombatDetectedMs = 0;
        string activeState = "EXPLORE";
        int cycleCounter = 0;
        List<TrackedAudioSession> cachedSessions = DiscoverGameAudioSessions();

        string lastKnownGame = "Castlevania Belmont's Curse";
        string lastKnownTitle = "Castlevania Belmont's Curse";

        while (true)
        {
            if (cycleCounter % 12 == 0)
            {
                cachedSessions = DiscoverGameAudioSessions();
            }
            cycleCounter++;

            // 1. Check Foreground Window
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

            // 10 ticks x 25ms = 250ms measurement window
            int ticks = 10;
            for (int t = 0; t < ticks; t++)
            {
                // Only count inputs if the user is in the game or if controller is used
                if (isGameInForeground)
                {
                    foreach (int vk in AttackKeys)
                    {
                        bool isDown = (GetAsyncKeyState(vk) & 0x8000) != 0;
                        if (isDown && !prevKeyStates[vk])
                        {
                            // Fresh attack button press (Z, X, C, LMB, etc.)
                            tickAttackPresses++;
                        }
                        prevKeyStates[vk] = isDown;
                    }
                }

                // Gamepad checks (XInput + DirectInput)
                for (uint padIdx = 0; padIdx < 4; padIdx++)
                {
                    XINPUT_STATE xs;
                    if (SafeXInputGetState(padIdx, out xs) == 0)
                    {
                        ushort btns = xs.Gamepad.wButtons;
                        ushort newly = (ushort)(btns & ~prevPadButtons[padIdx]);
                        prevPadButtons[padIdx] = btns;

                        // A, B, X, Y (0xF000) + Bumpers (0x0300)
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

                // Sample game audio peak
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

            if (!string.IsNullOrEmpty(fgName))
            {
                lastKnownGame = fgName;
                lastKnownTitle = !string.IsNullOrEmpty(fgTitle) ? fgTitle : fgName;
            }
            else if (!string.IsNullOrEmpty(audioGameName))
            {
                lastKnownGame = audioGameName;
                lastKnownTitle = !string.IsNullOrEmpty(audioGameTitle) ? audioGameTitle : audioGameName;
            }

            // Update 2-second sliding window of combat action frequency
            combatActionsHistory[historyIdx] = tickAttackPresses;
            historyIdx = (historyIdx + 1) % combatActionsHistory.Length;

            int totalAttackPressesIn2s = 0;
            for (int i = 0; i < combatActionsHistory.Length; i++)
            {
                totalAttackPressesIn2s += combatActionsHistory[i];
            }

            // Audio surge calculation
            float avgPeak = sumAudioPeak / ticks;
            if (avgPeak > 0.001f)
            {
                if (rollingAudioBaseline < 0f) rollingAudioBaseline = avgPeak;
                else rollingAudioBaseline = rollingAudioBaseline * 0.95f + avgPeak * 0.05f;
            }
            bool isAudioSurging = (rollingAudioBaseline > 0.002f && maxAudioPeak > rollingAudioBaseline * 1.6f && maxAudioPeak > 0.04f);

            int avgLuma = 30;
            bool isDamageFlash = false;
            SampleScreenAverage(out avgLuma, out isDamageFlash);

            long nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            // Intelligent State Machine with Strong Hysteresis:
            // What defines COMBAT:
            // 1) The player pressed at least 2 attack keys in the last 2 seconds, OR
            // 2) A sudden damage flash occurred while game audio is surging.
            // Casual walking (holding D/Right) or jumping has ZERO attack presses -> stays in EXPLORE!
            bool isActivelyFighting = (totalAttackPressesIn2s >= 2) || (totalAttackPressesIn2s >= 1 && isAudioSurging) || isDamageFlash;

            if (isActivelyFighting)
            {
                lastCombatDetectedMs = nowMs;
                activeState = "COMBAT";
            }
            else
            {
                // Once combat is triggered, hold combat mode for 12.0 seconds after the last attack blow
                // This prevents music from cutting off during short pauses or between enemy waves!
                if (nowMs - lastCombatDetectedMs < 12000)
                {
                    activeState = "COMBAT";
                }
                else
                {
                    activeState = "EXPLORE";
                }
            }

            int displayMotion = (activeState == "COMBAT")
                ? Math.Min(95, 52 + totalAttackPressesIn2s * 8)
                : Math.Max(10, 14 + totalAttackPressesIn2s * 5);

            string json = string.Format(
                CultureInfo.InvariantCulture,
                "{{\"timestamp\":{0},\"detectedProcess\":\"{1}\",\"windowTitle\":\"{2}\",\"motionDelta\":{3},\"redAlertRatio\":0,\"brightness\":{4},\"inferredVibe\":\"{5}\",\"sensorMode\":\"combat-cadence-50hz\"}}",
                nowMs,
                CleanJson(lastKnownGame),
                CleanJson(lastKnownTitle),
                displayMotion,
                avgLuma,
                activeState
            );

            try
            {
                File.WriteAllText(tmpFile, json, Encoding.UTF8);
                if (File.Exists(outFile)) File.Delete(outFile);
                File.Move(tmpFile, outFile);
            }
            catch { }

            if (singleShot)
            {
                Console.WriteLine(json);
                break;
            }
        }
    }
}
