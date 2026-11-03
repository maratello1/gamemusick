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

    // XInput Gamepad support
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

    // WinMM DirectInput / Universal Joystick support (DualSense, DualShock, Switch Pro, Generic Gamepads)
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

    // Windows Core Audio COM interfaces for per-process Game Audio metering
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

    static readonly HashSet<int> MovementKeys = new HashSet<int>
    {
        0x57, 0x41, 0x53, 0x44, // WASD
        0x25, 0x26, 0x27, 0x28  // Left, Up, Right, Down Arrows
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

    // Sample 16 patches (each averaged over a 3x3 patch so 1-pixel torches/rain don't cause false spikes)
    static void SampleScreen16Patches(int[] lumasOut, int[] redsOut)
    {
        try
        {
            int w = Math.Max(800, GetSystemMetrics(0));
            int h = Math.Max(600, GetSystemMetrics(1));
            IntPtr hdcScreen = GetDC(IntPtr.Zero);
            IntPtr hdcMem = CreateCompatibleDC(hdcScreen);
            IntPtr hbm = CreateCompatibleBitmap(hdcScreen, 3, 3);
            IntPtr oldObj = SelectObject(hdcMem, hbm);

            int[] xs = new int[] { w / 5, (w * 2) / 5, (w * 3) / 5, (w * 4) / 5 };
            int[] ys = new int[] { h / 5, (h * 2) / 5, (h * 3) / 5, (h * 4) / 5 };

            int idx = 0;
            foreach (int y in ys)
            {
                foreach (int x in xs)
                {
                    BitBlt(hdcMem, 0, 0, 3, 3, hdcScreen, x, y, SRCCOPY | CAPTUREBLT);
                    int patchLuma = 0;
                    int patchRed = 0;
                    for (int py = 0; py < 3; py++)
                    {
                        for (int px = 0; px < 3; px++)
                        {
                            uint color = GetPixel(hdcMem, px, py);
                            if (color != 0xFFFFFFFF)
                            {
                                int r = (int)(color & 0xFF);
                                int g = (int)((color >> 8) & 0xFF);
                                int b = (int)((color >> 16) & 0xFF);
                                patchLuma += (299 * r + 587 * g + 114 * b) / 2550;
                                if (r > g + 45 && r > b + 45) patchRed += r;
                            }
                        }
                    }
                    lumasOut[idx] = Math.Max(0, Math.Min(100, patchLuma / 9));
                    redsOut[idx] = patchRed / 9;
                    idx++;
                }
            }

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

        int[] prevLumas = new int[16];
        int[] prevReds = new int[16];
        int[] curLumas = new int[16];
        int[] curReds = new int[16];
        SampleScreen16Patches(prevLumas, prevReds);

        bool[] prevKeyStates = new bool[256];
        ushort[] prevPadButtons = new ushort[4];
        bool[] prevPadLT = new bool[4];
        bool[] prevPadRT = new bool[4];
        uint[] prevJoyButtons = new uint[4];

        float rollingEnergy = 14.0f;
        float rollingAudioBaseline = -1.0f; // -1 means initialize on first real sample
        long lastCombatSpikeMs = 0;
        string lastKnownGame = "Ожидание игры";
        string lastKnownTitle = "Windows";
        int cycleCounter = 0;
        int[] attackHistory = new int[8]; // 8 x 240ms = ~2.0 second sliding window of combat actions
        int historyIdx = 0;
        List<TrackedAudioSession> cachedSessions = DiscoverGameAudioSessions();

        while (true)
        {
            if (cycleCounter % 8 == 0)
            {
                cachedSessions = DiscoverGameAudioSessions();
            }
            cycleCounter++;

            POINT ptPrev;
            GetCursorPos(out ptPrev);

            int attackEdges = 0;
            int attackHeld = 0;
            int moveEdges = 0;
            int moveHeld = 0;
            int cursorTravel = 0;
            int padCombat = 0;
            int padMove = 0;

            float maxAudioPeak = 0f;
            float sumAudioPeak = 0f;
            string audioGameName = "";
            string audioGameTitle = "";

            // 12 ticks x 20ms = 240ms at 50Hz
            int ticks = 12;
            for (int t = 0; t < ticks; t++)
            {
                // 1. Mouse Buttons (LMB=0x01, RMB=0x02, MMB=0x04, X1=0x05, X2=0x06)
                for (int vk = 0x01; vk <= 0x06; vk++)
                {
                    if (vk == 0x03) continue;
                    bool isDown = (GetAsyncKeyState(vk) & 0x8000) != 0;
                    if (isDown)
                    {
                        if (!prevKeyStates[vk]) attackEdges += 22;
                        attackHeld += 4;
                    }
                    prevKeyStates[vk] = isDown;
                }

                // 2. Full Keyboard Scan (0x08..0x90 & 0xA0..0xA5)
                for (int vk = 0x08; vk <= 0xA5; vk++)
                {
                    // Skip generic shift/ctrl/alt duplicates (0x10..0x12) if we scan L/R (0xA0..0xA5), or scan 0x08..0x90
                    if (vk > 0x90 && vk < 0xA0) continue;
                    if (vk == 0x10 || vk == 0x11 || vk == 0x12) continue;

                    bool isDown = (GetAsyncKeyState(vk) & 0x8000) != 0;
                    if (MovementKeys.Contains(vk))
                    {
                        if (isDown)
                        {
                            if (!prevKeyStates[vk]) moveEdges += 5;
                            moveHeld += 1;
                        }
                    }
                    else
                    {
                        if (isDown)
                        {
                            if (!prevKeyStates[vk]) attackEdges += 18;
                            attackHeld += 3;
                        }
                    }
                    prevKeyStates[vk] = isDown;
                }

                // 3. XInput Controller (0..3) + WinMM DirectInput Joystick (0..3)
                for (uint padIdx = 0; padIdx < 4; padIdx++)
                {
                    XINPUT_STATE xs;
                    if (SafeXInputGetState(padIdx, out xs) == 0)
                    {
                        ushort btns = xs.Gamepad.wButtons;
                        ushort newly = (ushort)(btns & ~prevPadButtons[padIdx]);
                        prevPadButtons[padIdx] = btns;

                        // Face buttons (A/B/X/Y = 0xF000) + Shoulder bumpers (LB/RB = 0x0300)
                        if ((newly & 0xF300) != 0) padCombat += 22;
                        if ((btns & 0xF300) != 0) padCombat += 3;

                        bool ltDown = xs.Gamepad.bLeftTrigger > 45;
                        bool rtDown = xs.Gamepad.bRightTrigger > 45;
                        if (ltDown && !prevPadLT[padIdx]) padCombat += 20;
                        if (rtDown && !prevPadRT[padIdx]) padCombat += 20;
                        if (ltDown || rtDown) padCombat += 4;
                        prevPadLT[padIdx] = ltDown;
                        prevPadRT[padIdx] = rtDown;

                        if ((btns & 0x000F) != 0 || Math.Abs((int)xs.Gamepad.sThumbLX) > 9000 || Math.Abs((int)xs.Gamepad.sThumbLY) > 9000)
                        {
                            padMove += 1;
                        }
                    }
                    else
                    {
                        // Fallback to WinMM joyGetPosEx for DualShock/DualSense/DirectInput gamepads
                        try
                        {
                            JOYINFOEX ji = new JOYINFOEX();
                            ji.dwSize = (uint)Marshal.SizeOf(typeof(JOYINFOEX));
                            ji.dwFlags = 0xFF; // JOY_RETURNALL
                            if (joyGetPosEx(padIdx, ref ji) == 0)
                            {
                                uint btns = ji.dwButtons;
                                uint newly = btns & ~prevJoyButtons[padIdx];
                                prevJoyButtons[padIdx] = btns;
                                if (newly != 0) padCombat += 22;
                                if (btns != 0) padCombat += 3;
                                if (ji.dwPOV != 65535 || Math.Abs((int)ji.dwXpos - 32767) > 10000 || Math.Abs((int)ji.dwYpos - 32767) > 10000)
                                {
                                    padMove += 1;
                                }
                            }
                        }
                        catch { }
                    }
                }

                // 4. Cursor / Camera Flick Velocity
                POINT ptNow;
                if (GetCursorPos(out ptNow))
                {
                    cursorTravel += Math.Abs(ptNow.X - ptPrev.X) + Math.Abs(ptNow.Y - ptPrev.Y);
                    ptPrev = ptNow;
                }

                // 5. Game Process Audio Peak
                float tickPeak = 0f;
                foreach (var gs in cachedSessions)
                {
                    float p = 0f;
                    try { gs.Meter.GetPeakValue(out p); } catch { }
                    if (string.IsNullOrEmpty(audioGameName))
                    {
                        audioGameName = gs.ProcessName;
                        audioGameTitle = gs.WindowTitle;
                    }
                    if (p > tickPeak)
                    {
                        tickPeak = p;
                        audioGameName = gs.ProcessName;
                        audioGameTitle = gs.WindowTitle;
                    }
                }

                if (tickPeak > maxAudioPeak) maxAudioPeak = tickPeak;
                sumAudioPeak += tickPeak;

                Thread.Sleep(20);
            }

            float avgAudioPeak = sumAudioPeak / ticks;
            if (avgAudioPeak > 0.0005f)
            {
                if (rollingAudioBaseline < 0f)
                {
                    rollingAudioBaseline = avgAudioPeak;
                }
                else
                {
                    rollingAudioBaseline = rollingAudioBaseline * 0.94f + avgAudioPeak * 0.06f;
                }
            }

            // Audio combat surge: only scores when game audio spikes significantly above its rolling baseline
            int audioCombatScore = 0;
            if (rollingAudioBaseline > 0.001f && maxAudioPeak > 0.004f)
            {
                float surgeRatio = maxAudioPeak / Math.Max(0.005f, rollingAudioBaseline);
                if (surgeRatio > 1.32f)
                {
                    audioCombatScore = (int)Math.Round((surgeRatio - 1.28f) * 68.0f);
                    audioCombatScore = Math.Max(0, Math.Min(92, audioCombatScore));
                }
            }

            // Check Foreground Window
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
                        }
                    }
                }
            }
            catch { }

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

            // Sample 16 3x3 patches for Optical Motion & Dynamic Red Flashes
            SampleScreen16Patches(curLumas, curReds);
            int opticalDiffSum = 0;
            int activeChangedPatches = 0;
            int redFlashScore = 0;
            int lumaSum = 0;
            for (int i = 0; i < 16; i++)
            {
                int diff = Math.Abs(curLumas[i] - prevLumas[i]);
                if (diff > 6)
                {
                    opticalDiffSum += diff;
                    activeChangedPatches++;
                }
                if (curReds[i] > 115 && (curReds[i] - prevReds[i]) > 30)
                {
                    redFlashScore += 18;
                }
                lumaSum += curLumas[i];
                prevLumas[i] = curLumas[i];
                prevReds[i] = curReds[i];
            }
            redFlashScore = Math.Min(100, redFlashScore);
            int avgLuma = Math.Max(5, Math.Min(100, lumaSum / 16));

            // Optical score requires broad screen motion (at least 5 of 16 patches changing)
            int rawOptical = (opticalDiffSum * 4) / 10;
            int opticalScore = activeChangedPatches >= 5
                ? Math.Max(0, Math.Min(85, rawOptical))
                : Math.Max(0, Math.Min(24, rawOptical / 2));

            // Combine Input + Gamepad + Optical + Audio Surge into Unified Combat Score
            bool isChatOrIdeForeground = false;
            try
            {
                IntPtr hwndCheck = GetForegroundWindow();
                if (hwndCheck != IntPtr.Zero)
                {
                    uint checkPid = 0;
                    GetWindowThreadProcessId(hwndCheck, out checkPid);
                    if (checkPid > 0)
                    {
                        string checkName = Process.GetProcessById((int)checkPid).ProcessName;
                        if (string.Equals(checkName, "Antigravity", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(checkName, "Code", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(checkName, "Discord", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(checkName, "Telegram", StringComparison.OrdinalIgnoreCase))
                        {
                            isChatOrIdeForeground = true;
                        }
                    }
                }
            }
            catch { }

            int effectiveAttackEdges = isChatOrIdeForeground ? 0 : attackEdges;
            int effectiveAttackHeld = isChatOrIdeForeground ? 0 : Math.Min(32, attackHeld);
            int effectiveMoveEdges = isChatOrIdeForeground ? 0 : Math.Min(14, moveEdges);
            int effectiveCursor = isChatOrIdeForeground ? 0 : Math.Min(24, cursorTravel / 32);

            int tickCombatActions = effectiveAttackEdges + padCombat + (effectiveAttackHeld >= 8 ? 18 : 0);
            attackHistory[historyIdx] = tickCombatActions;
            historyIdx = (historyIdx + 1) % attackHistory.Length;

            int slidingWindowCombat = 0;
            for (int hi = 0; hi < attackHistory.Length; hi++)
            {
                slidingWindowCombat += attackHistory[hi];
            }

            bool isMoving = (!isChatOrIdeForeground && moveHeld > 0) || padMove > 0;
            int walkBase = isMoving ? 20 : 12;
            int inputScore = Math.Min(
                100,
                walkBase + (slidingWindowCombat * 7) / 10 + effectiveAttackHeld + effectiveMoveEdges + effectiveCursor
            );

            bool hasCombatInput = (slidingWindowCombat >= 18 || effectiveAttackHeld >= 6 || padCombat > 0);

            int effectiveOptical = hasCombatInput
                ? opticalScore
                : Math.Min(22, opticalScore / 3);
            int effectiveAudio = hasCombatInput
                ? audioCombatScore
                : Math.Min(20, audioCombatScore / 3);

            int combatSynergy = hasCombatInput
                ? Math.Min(100, inputScore + (effectiveOptical / 3) + (effectiveAudio / 3) + (redFlashScore / 3))
                : Math.Max(inputScore, Math.Max(effectiveOptical, effectiveAudio));

            int rawCombatEnergy = combatSynergy;
            float instantClamped = Math.Max(12.0f, Math.Min(100.0f, rawCombatEnergy));

            long nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            if (instantClamped >= 42.0f)
            {
                lastCombatSpikeMs = nowMs;
            }

            if (instantClamped > rollingEnergy)
            {
                // Fast attack response: jump into COMBAT/BOSSFIGHT within ~0.35s
                rollingEnergy = rollingEnergy * 0.18f + instantClamped * 0.82f;
            }
            else if (nowMs - lastCombatSpikeMs < 7500 && rollingEnergy >= 42.0f)
            {
                // Keep combat music playing during 7.5s lulls between attacks inside a fight
                rollingEnergy = Math.Max(45.0f, rollingEnergy * 0.95f);
            }
            else
            {
                // Smoothly decay back to calm EXPLORE after fight ends
                rollingEnergy = Math.Max(12.0f, rollingEnergy * 0.65f + instantClamped * 0.35f);
            }

            int finalMotion = Math.Max(12, Math.Min(100, (int)Math.Round(rollingEnergy)));
            string vibe = "EXPLORE";
            if (finalMotion >= 74 || (hasCombatInput && redFlashScore >= 48)) vibe = "BOSSFIGHT";
            else if (finalMotion >= 42) vibe = "COMBAT";
            else if (finalMotion >= 28) vibe = "STEALTH";

            string json = string.Format(
                CultureInfo.InvariantCulture,
                "{{\"timestamp\":{0},\"detectedProcess\":\"{1}\",\"windowTitle\":\"{2}\",\"motionDelta\":{3},\"redAlertRatio\":{4},\"brightness\":{5},\"inferredVibe\":\"{6}\",\"inputScore\":{7},\"opticalScore\":{8},\"audioScore\":{9},\"sensorMode\":\"win32-interactive-50hz\"}}",
                nowMs,
                CleanJson(lastKnownGame),
                CleanJson(lastKnownTitle),
                finalMotion,
                redFlashScore,
                avgLuma,
                vibe,
                inputScore,
                effectiveOptical,
                effectiveAudio
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
