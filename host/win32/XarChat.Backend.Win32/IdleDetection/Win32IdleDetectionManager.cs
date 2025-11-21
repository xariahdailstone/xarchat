using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.IdleDetection;

namespace XarChat.Backend.Win32.IdleDetection
{
    public class Win32IdleDetectionManagerImpl : IIdleDetectionManager
    {
        public Win32IdleDetectionManagerImpl(
            ILogger<Win32IdleDetectionManagerImpl> logger)
        {
            this.Logger = logger;
        }

        private ILogger Logger { get; }

        [DllImport("kernel32.dll")]
        static extern uint GetTickCount();

        [DllImport("user32.dll")]
        static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

        [StructLayout(LayoutKind.Sequential)]
        struct LASTINPUTINFO
        {
            public static readonly int SizeOf = Marshal.SizeOf(typeof(LASTINPUTINFO));

            [MarshalAs(UnmanagedType.U4)]
            public uint cbSize;
            [MarshalAs(UnmanagedType.U4)]
            public uint dwTime;
        }

        [DllImport("Wtsapi32.dll", CharSet = CharSet.Unicode)]
        private static extern bool WTSQuerySessionInformation(
            nint hServer, uint sessionId, WTS_INFO_CLASS wtsInfoClass, out nint ppBuffer, out uint pBytesReturned);

        private enum WTS_INFO_CLASS
        {
            WTSInitialProgram = 0,
            WTSApplicationName = 1,
            WTSWorkingDirectory = 2,
            WTSOEMId = 3,
            WTSSessionId = 4,
            WTSUserName = 5,
            WTSWinStationName = 6,
            WTSDomainName = 7,
            WTSConnectState = 8,
            WTSClientBuildNumber = 9,
            WTSClientName = 10,
            WTSClientDirectory = 11,
            WTSClientProductId = 12,
            WTSClientHardwareId = 13,
            WTSClientAddress = 14,
            WTSClientDisplay = 15,
            WTSClientProtocolType = 16,
            WTSIdleTime = 17,
            WTSLogonTime = 18,
            WTSIncomingBytes = 19,
            WTSOutgoingBytes = 20,
            WTSIncomingFrames = 21,
            WTSOutgoingFrames = 22,
            WTSClientInfo = 23,
            WTSSessionInfo = 24,
            WTSSessionInfoEx = 25,
            WTSConfigInfo = 26,
            WTSValidationInfo = 27,
            WTSSessionAddressV4 = 28,
            WTSIsRemoteSession = 29
        }

        [DllImport("Wtsapi32.dll")]
        private static extern void WTSFreeMemory(nint pointer);

        private Dictionary<string, CancellationTokenSource> _registeredLoops = new Dictionary<string, CancellationTokenSource>();

        public IDisposable RegisterDisposableCallback(TimeSpan idleAfter, Action<string, string> callback)
        {
            var name = Guid.NewGuid().ToString();
            RegisterCallback(name, idleAfter, callback);
            return new ActionDisposable(() =>
            {
                UnregisterCallback(name);
            });
        }

        public void RegisterCallback(string name, TimeSpan idleAfter, Action<string, string> callback)
        {
            var myLoopCts = new CancellationTokenSource();
            lock (_registeredLoops)
            {
                _registeredLoops[name] = myLoopCts;
            }
            _ = MonitorLoop(name, idleAfter, callback, myLoopCts.Token);
        }

        public void UnregisterCallback(string name)
        {
            lock (_registeredLoops)
            {
                if (_registeredLoops.TryGetValue(name, out var loopCts))
                {
                    _registeredLoops.Remove(name);
                    loopCts.Cancel();
                }
            }
        }

        private async Task MonitorLoop(string name, TimeSpan idleAfter, Action<string, string> callback, CancellationToken cancellationToken)
        {
            Logger.LogInformation("Starting idle monitor loop {name}", name);
            try
            {
                var lastKnownUserState = "";
                var lastKnownScreenState = "";
                var assignStates = (string userState, string screenState) =>
                {
                    if (userState != lastKnownUserState || screenState != lastKnownScreenState)
                    {
                        lastKnownUserState = userState;
                        lastKnownScreenState = screenState;
                        Logger.LogInformation("Idle loop state change {name}: {userState} {screenState}", name, userState, screenState);
                        callback(lastKnownUserState, lastKnownScreenState);
                    }
                };

                try
                {
                    while (!cancellationToken.IsCancellationRequested)
                    {
                        var currentUserState = GetIdleState(idleAfter);
                        var currentScreenState = GetScreenState();

                        assignStates(currentUserState, currentScreenState);

                        await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken);
                    }
                }
                catch (OperationCanceledException) { }
                catch (Exception ex)
                {
                    Logger.LogError(ex, "Idle monitor loop exception {name} {message}", name, ex.Message);
                }
            }
            finally
            {
                Logger.LogInformation("Ended idle monitor loop {name}", name);
            }
        }

        private string GetIdleState(TimeSpan idleAfter)
        {
            var lii = new LASTINPUTINFO();
            lii.cbSize = (uint)Marshal.SizeOf<LASTINPUTINFO>();
            GetLastInputInfo(ref lii);
            var now = GetTickCount();
            var idleTime = TimeSpan.FromMilliseconds(now - lii.dwTime);
            return idleTime >= idleAfter ? "idle" : "active";
        }

        const uint WTS_CURRENT_SESSION = 0xFFFFFFFF;

        [StructLayout(LayoutKind.Sequential)]
        private struct WTSINFOEXW
        {
            public uint Level;
            public WTSINFOEX_LEVEL_W Data;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct WTSINFOEX_LEVEL_W
        {
            public WTSINFOEX_LEVEL1_W WTSInfoExLevel1;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct WTSINFOEX_LEVEL1_W
        {
            public uint SessionId;
            public WTS_CONNECTSTATE_CLASS SessionState;
            public WTS_SESSIONSTATE SessionFlags;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 33)]
            public string WinStationName;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 21)]
            public string UserName;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 18)]
            public string DomainName;
            public LARGE_INTEGER LogonTime;
            public LARGE_INTEGER ConnectTime;
            public LARGE_INTEGER DisconnectTime;
            public LARGE_INTEGER LastInputTime;
            public LARGE_INTEGER CurrentTime;
            public uint IncomingBytes;
            public uint OutgoingBytes;
            public uint IncomingFrames;
            public uint OutgoingFrames;
            public uint IncomingCompressedBytes;
            public uint OutgoingCompressedBytes;
        }

        [StructLayout(LayoutKind.Explicit)]
        public struct LARGE_INTEGER //此結構體在C++中使用的爲union結構，在C#中需要使用FieldOffset設置相關的內存起始地址
        {
            [FieldOffset(0)]
            uint LowPart;
            [FieldOffset(4)]
            int HighPart;
            [FieldOffset(0)]
            long QuadPart;
        }

        private enum WTS_CONNECTSTATE_CLASS
        {
            WTSActive,
            WTSConnected,
            WTSConnectQuery,
            WTSShadow,
            WTSDisconnected,
            WTSIdle,
            WTSListen,
            WTSReset,
            WTSDown,
            WTSInit
        }

        /// <remarks>
        /// Windows Server 2008 R2 and Windows 7:  Due to a code defect, the usage of the WTS_SESSIONSTATE_LOCK 
        /// and WTS_SESSIONSTATE_UNLOCK flags is reversed. That is, WTS_SESSIONSTATE_LOCK indicates that the 
        /// session is unlocked, and WTS_SESSIONSTATE_UNLOCK indicates the session is locked.
        /// </remarks>
        private enum WTS_SESSIONSTATE : uint
        {
            WTS_SESSIONSTATE_UNKNOWN = 0xFFFFFFFF,
            WTS_SESSIONSTATE_LOCK = 0,
            WTS_SESSIONSTATE_UNLOCK = 1
        }

        private string GetScreenState()
        {
            nint buffer;
            uint bufferLen;

            if (WTSQuerySessionInformation(IntPtr.Zero, WTS_CURRENT_SESSION, WTS_INFO_CLASS.WTSSessionInfoEx, out buffer, out bufferLen))
            {
                try
                {
                    //WTSINFOEXW* infoEx = (WTSINFOEXW*)buffer;
                    var info = Marshal.PtrToStructure<WTSINFOEXW>(buffer);
                    var sessionFlags = info.Data.WTSInfoExLevel1.SessionFlags;
                    var result = sessionFlags == WTS_SESSIONSTATE.WTS_SESSIONSTATE_LOCK ? "locked" : "unlocked";
                    //System.Diagnostics.Debug.WriteLine($"{result}\t{sessionFlags}");
                    return result;
                }
                finally
                {
                    WTSFreeMemory(buffer);
                }
            }

            return "unlocked";
        }
    }

    internal class ActionDisposable : IDisposable
    {
        private readonly Action _onDispose;
        private bool _disposed = false;

        public ActionDisposable(Action onDispose)
        {
            _onDispose = onDispose;
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _disposed = true;
                try { _onDispose?.Invoke(); }
                catch { }
            }
        }
    }
}
