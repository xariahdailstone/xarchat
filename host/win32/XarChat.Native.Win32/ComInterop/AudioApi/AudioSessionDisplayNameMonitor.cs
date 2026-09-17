using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.Marshalling;
using System.Threading;
using Windows.Foundation.Collections;
using System.Collections.Immutable;

namespace XarChat.Native.Win32.ComInterop.AudioApi
{
    public sealed partial class AudioSessionDisplayNameMonitor : IDisposable
    {
        private const uint COINIT_MULTITHREADED = 0x0;
        private const uint CLSCTX_ALL = 0x17;
        private const uint DEVICE_STATE_ACTIVE = 0x00000001;

        private static readonly Guid CLSID_MMDeviceEnumerator =
            new("BCDE0395-E52F-467C-8E3D-C4579291692E");

        private static readonly Guid IID_IMMDeviceEnumerator =
            new("A95664D2-9614-4F35-A746-DE8DB63617E6");

        private static readonly Guid IID_IAudioSessionManager2 =
            new("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");

        private readonly string _displayName;
        private readonly string? _iconPath;

        private IImmutableSet<uint> _targetProcessIds =
            ImmutableHashSet<uint>.Empty;

        private readonly ManualResetEvent _stopEvent = new(false);

        /*
         * Used both for:
         *
         *   - WebView2 PID changes
         *   - audio endpoint changes
         *
         * In either case, doing a complete reconciliation is cheap and
         * makes the race handling much simpler.
         */
        private readonly AutoResetEvent _refreshEvent = new(false);

        private readonly ManualResetEventSlim _startedEvent = new(false);

        private readonly Thread _thread;

        private Exception? _startupException;
        private bool _disposed;

        /*
         * All fields below are owned by the MTA worker thread.
         */
        private IMMDeviceEnumerator? _deviceEnumerator;

        private SessionNotification? _sessionNotification;
        private DeviceNotification? _deviceNotification;

        /*
         * Keyed by MMDevice endpoint ID.
         */
        private readonly Dictionary<string, IAudioSessionManager2>
            _sessionManagers = new(StringComparer.Ordinal);

        public AudioSessionDisplayNameMonitor(string displayName)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(displayName);

            _displayName = displayName;

            string? processPath = Environment.ProcessPath;
            _iconPath = processPath is not null ? $"{processPath},0" : null;

            _thread = new Thread(ThreadMain)
            {
                IsBackground = true,
                Name = "Audio session notification thread"
            };

            _thread.Start();

            _startedEvent.Wait();

            if (_startupException is not null)
            {
                Dispose();

                throw new InvalidOperationException(
                    "Failed to initialize the audio-session monitor.",
                    _startupException);
            }
        }

        public void SetTargetProcessList(
            IEnumerable<uint> processList)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
            ArgumentNullException.ThrowIfNull(processList);

            IImmutableSet<uint> newSet =
                processList.ToImmutableHashSet();

            Interlocked.Exchange(
                ref _targetProcessIds,
                newSet);

            /*
             * The PID list may now contain a process whose audio session
             * already existed before we learned about the PID.
             *
             * Have the MTA worker rescan existing sessions.
             */
            _refreshEvent.Set();
        }

        /// <summary>
        /// Forces the monitor to:
        ///
        /// 1. Reconcile the current active render endpoints.
        /// 2. Recheck every existing audio session against the target PID set.
        ///
        /// Call this after the WebView2 process list changes.
        /// </summary>
        public void Refresh()
        {
            if (_disposed)
                throw new ObjectDisposedException(
                    nameof(AudioSessionDisplayNameMonitor));

            _refreshEvent.Set();
        }

        private void ThreadMain()
        {
            int hr = NativeMethods.CoInitializeEx(
                0,
                COINIT_MULTITHREADED);

            if (hr < 0)
            {
                _startupException = new COMException(
                    "CoInitializeEx(COINIT_MULTITHREADED) failed.",
                    hr);

                _startedEvent.Set();
                return;
            }

            try
            {
                Initialize();

                _startedEvent.Set();

                WaitHandle[] waitHandles =
                [
                    _stopEvent,
                _refreshEvent
                ];

                while (true)
                {
                    int result = WaitHandle.WaitAny(waitHandles);

                    if (result == 0)
                        break;

                    /*
                     * Audio-device events and WebView2 PID updates both come
                     * through here.
                     *
                     * Endpoint enumeration can occasionally race with device
                     * insertion/removal, so treat refresh failures as transient.
                     */
                    try
                    {
                        RefreshCore();
                    }
                    catch
                    {
                        // A later device notification / WebView PID change
                        // will cause another refresh.
                    }
                }
            }
            catch (Exception ex)
            {
                _startupException = ex;
                _startedEvent.Set();
            }
            finally
            {
                Shutdown();

                NativeMethods.CoUninitialize();
            }
        }

        private void Initialize()
        {
            _deviceEnumerator = CreateDeviceEnumerator();

            _sessionNotification =
                new SessionNotification(this);

            _deviceNotification =
                new DeviceNotification(this);

            /*
             * Register for endpoint changes BEFORE doing the initial enumeration.
             *
             * That closes the race where a device could appear between our
             * initial enumeration and notification registration.
             */
            _deviceEnumerator.RegisterEndpointNotificationCallback(
                _deviceNotification);

            RefreshCore();
        }

        private void RefreshCore()
        {
            ReconcileRenderEndpoints();

            /*
             * Also rescan existing sessions.
             *
             * This is important when Refresh() was triggered because WebView2's
             * PID set changed. The audio session may have existed before the
             * WebView2 process became known to us.
             */
            RenameExistingSessionsOnAllEndpoints();
        }

        // ---------------------------------------------------------------------
        // Endpoint management
        // ---------------------------------------------------------------------

        private void ReconcileRenderEndpoints()
        {
            IMMDeviceEnumerator deviceEnumerator =
                _deviceEnumerator
                ?? throw new InvalidOperationException();

            deviceEnumerator.EnumAudioEndpoints(
                EDataFlow.Render,
                DEVICE_STATE_ACTIVE,
                out IMMDeviceCollection devices);

            devices.GetCount(out uint count);

            HashSet<string> activeDeviceIds =
                new(StringComparer.Ordinal);

            for (uint i = 0; i < count; i++)
            {
                IMMDevice device;

                try
                {
                    devices.Item(i, out device);
                }
                catch
                {
                    // Device disappeared while enumerating.
                    continue;
                }

                string deviceId;

                try
                {
                    deviceId = GetDeviceId(device);
                }
                catch
                {
                    continue;
                }

                activeDeviceIds.Add(deviceId);

                if (!_sessionManagers.ContainsKey(deviceId))
                {
                    TryAttachEndpoint(
                        deviceId,
                        device);
                }
            }

            /*
             * Anything we previously tracked that isn't in the current ACTIVE
             * render set has either:
             *
             *   - been unplugged
             *   - been disabled
             *   - been removed
             *   - otherwise stopped being an active render endpoint
             */
            List<string> staleIds = [];

            foreach (string deviceId in _sessionManagers.Keys)
            {
                if (!activeDeviceIds.Contains(deviceId))
                    staleIds.Add(deviceId);
            }

            foreach (string deviceId in staleIds)
                DetachEndpoint(deviceId);
        }

        private void TryAttachEndpoint(
            string deviceId,
            IMMDevice device)
        {
            if (_sessionNotification is null)
                return;

            IAudioSessionManager2 manager;

            try
            {
                manager = ActivateSessionManager(device);

                manager.RegisterSessionNotification(
                    _sessionNotification);
            }
            catch
            {
                /*
                 * Most commonly:
                 *
                 * the endpoint disappeared between EnumAudioEndpoints()
                 * and Activate()/RegisterSessionNotification().
                 */
                return;
            }

            _sessionManagers.Add(
                deviceId,
                manager);

            /*
             * This isn't merely for finding already-existing sessions.
             *
             * Microsoft specifically requires calling
             * IAudioSessionEnumerator::GetCount() after registration before
             * session-created notifications are delivered.
             */
            try
            {
                RenameExistingSessions(manager);
            }
            catch
            {
                // Registration itself is still valid.
            }
        }

        private void DetachEndpoint(string deviceId)
        {
            if (!_sessionManagers.Remove(
                    deviceId,
                    out IAudioSessionManager2? manager))
            {
                return;
            }

            if (_sessionNotification is null)
                return;

            try
            {
                manager.UnregisterSessionNotification(
                    _sessionNotification);
            }
            catch
            {
                /*
                 * Expected to be possible if the physical endpoint disappeared
                 * before we had a chance to unregister.
                 */
            }
        }

        private void DetachAllEndpoints()
        {
            if (_sessionNotification is not null)
            {
                foreach (IAudioSessionManager2 manager
                         in _sessionManagers.Values)
                {
                    try
                    {
                        manager.UnregisterSessionNotification(
                            _sessionNotification);
                    }
                    catch
                    {
                    }
                }
            }

            _sessionManagers.Clear();
        }

        // ---------------------------------------------------------------------
        // Session management
        // ---------------------------------------------------------------------

        private void RenameExistingSessionsOnAllEndpoints()
        {
            foreach (IAudioSessionManager2 manager
                     in _sessionManagers.Values)
            {
                try
                {
                    RenameExistingSessions(manager);
                }
                catch
                {
                    // Endpoint/session might have disappeared.
                }
            }
        }

        private void RenameExistingSessions(
            IAudioSessionManager2 manager)
        {
            manager.GetSessionEnumerator(
                out IAudioSessionEnumerator enumerator);

            /*
             * GetCount is required after RegisterSessionNotification().
             */
            enumerator.GetCount(out int count);

            for (int i = 0; i < count; i++)
            {
                try
                {
                    enumerator.GetSession(
                        i,
                        out IAudioSessionControl session);

                    RenameIfTarget(session);
                }
                catch
                {
                    /*
                     * Audio sessions are inherently racy:
                     * one can vanish between GetCount and GetSession.
                     */
                }
            }
        }

        private void RenameIfTarget(
            IAudioSessionControl session)
        {
            try
            {
                IAudioSessionControl2 session2 =
                    (IAudioSessionControl2)session;

                session2.GetProcessId(
                    out uint processId);

                IImmutableSet<uint> targetProcesses =
                    Volatile.Read(ref _targetProcessIds);

                if (!targetProcesses.Contains(processId))
                    return;

                session.SetDisplayName(
                    _displayName,
                    0);

                if (_iconPath is not null)
                {
                    session.SetIconPath(
                    _iconPath,
                    0);
                }
            }
            catch
            {
                /*
                 * Never let exceptions escape into a native Core Audio
                 * notification callback.
                 */
            }
        }

        // ---------------------------------------------------------------------
        // Device IDs
        // ---------------------------------------------------------------------

        private static unsafe string GetDeviceId(
            IMMDevice device)
        {
            device.GetId(out nint ptr);

            if (ptr == 0)
                throw new InvalidOperationException(
                    "IMMDevice::GetId returned NULL.");

            try
            {
                return new string((char*)ptr);
            }
            finally
            {
                NativeMethods.CoTaskMemFree(ptr);
            }
        }

        // ---------------------------------------------------------------------
        // COM activation
        // ---------------------------------------------------------------------

        private static unsafe IMMDeviceEnumerator CreateDeviceEnumerator()
        {
            nint ptr = 0;

            int hr = NativeMethods.CoCreateInstance(
                in CLSID_MMDeviceEnumerator,
                0,
                CLSCTX_ALL,
                in IID_IMMDeviceEnumerator,
                out ptr);

            ThrowIfFailed(
                hr,
                "Failed to create MMDeviceEnumerator.");

            try
            {
                return ComInterfaceMarshaller<IMMDeviceEnumerator>
                    .ConvertToManaged((void*)ptr)!;
            }
            finally
            {
                /*
                 * Release the reference returned directly from
                 * CoCreateInstance. The generated COM wrapper owns its
                 * managed representation independently.
                 */
                ComInterfaceMarshaller<IMMDeviceEnumerator>
                    .Free((void*)ptr);
            }
        }

        private static unsafe IAudioSessionManager2
            ActivateSessionManager(IMMDevice device)
        {
            device.Activate(
                in IID_IAudioSessionManager2,
                CLSCTX_ALL,
                0,
                out nint ptr);

            if (ptr == 0)
                throw new InvalidOperationException(
                    "IMMDevice::Activate returned NULL.");

            try
            {
                return ComInterfaceMarshaller<IAudioSessionManager2>
                    .ConvertToManaged((void*)ptr)!;
            }
            finally
            {
                ComInterfaceMarshaller<IAudioSessionManager2>
                    .Free((void*)ptr);
            }
        }

        private static void ThrowIfFailed(
            int hr,
            string message)
        {
            if (hr < 0)
                throw new COMException(message, hr);
        }

        // ---------------------------------------------------------------------
        // Core Audio session notification
        // ---------------------------------------------------------------------

        [GeneratedComClass]
        private sealed partial class SessionNotification
            : IAudioSessionNotification
        {
            private readonly AudioSessionDisplayNameMonitor _owner;

            public SessionNotification(
                AudioSessionDisplayNameMonitor owner)
            {
                _owner = owner;
            }

            public void OnSessionCreated(
                IAudioSessionControl newSession)
            {
                /*
                 * Keep this small and never propagate an exception into
                 * Core Audio.
                 */
                try
                {
                    _owner.RenameIfTarget(newSession);
                }
                catch
                {
                }
            }
        }

        // ---------------------------------------------------------------------
        // MMDevice endpoint notification
        // ---------------------------------------------------------------------

        [GeneratedComClass]
        private sealed partial class DeviceNotification
            : IMMNotificationClient
        {
            private readonly AudioSessionDisplayNameMonitor _owner;

            public DeviceNotification(
                AudioSessionDisplayNameMonitor owner)
            {
                _owner = owner;
            }

            private void SignalRefresh()
            {
                /*
                 * This is deliberately all we do from the MMDevice callback.
                 *
                 * IMMNotificationClient methods are required to be
                 * nonblocking.
                 */
                try
                {
                    _owner._refreshEvent.Set();
                }
                catch (ObjectDisposedException)
                {
                }
            }

            public void OnDeviceStateChanged(
                string deviceId,
                uint newState)
            {
                /*
                 * ACTIVE -> we'll add it.
                 *
                 * DISABLED / NOTPRESENT / UNPLUGGED -> we'll remove it.
                 *
                 * Just rescan either way.
                 */
                SignalRefresh();
            }

            public void OnDeviceAdded(
                string deviceId)
            {
                SignalRefresh();
            }

            public void OnDeviceRemoved(
                string deviceId)
            {
                SignalRefresh();
            }

            public void OnDefaultDeviceChanged(
                EDataFlow flow,
                ERole role,
                string? defaultDeviceId)
            {
                /*
                 * Nothing required.
                 *
                 * We intentionally monitor ALL active render endpoints,
                 * rather than just the default endpoint.
                 */
            }

            public void OnPropertyValueChanged(
                string deviceId,
                PROPERTYKEY key)
            {
                /*
                 * Endpoint properties aren't relevant to us.
                 */
            }
        }

        // ---------------------------------------------------------------------
        // Shutdown
        // ---------------------------------------------------------------------

        private void Shutdown()
        {
            /*
             * Stop endpoint callbacks first.
             *
             * Microsoft specifically says not to unregister from inside an
             * IMMNotificationClient callback. We're safely on our MTA worker
             * thread here instead.
             */
            if (_deviceEnumerator is not null &&
                _deviceNotification is not null)
            {
                try
                {
                    _deviceEnumerator
                        .UnregisterEndpointNotificationCallback(
                            _deviceNotification);
                }
                catch
                {
                }
            }

            DetachAllEndpoints();

            _deviceNotification = null;
            _sessionNotification = null;
            _deviceEnumerator = null;
        }

        public void Dispose()
        {
            if (_disposed)
                return;

            _disposed = true;

            _stopEvent.Set();

            if (Thread.CurrentThread != _thread)
                _thread.Join();

            _stopEvent.Dispose();
            _refreshEvent.Dispose();
            _startedEvent.Dispose();
        }

        private static partial class NativeMethods
        {
            [LibraryImport("ole32.dll")]
            internal static partial int CoInitializeEx(
                nint reserved,
                uint coInit);

            [LibraryImport("ole32.dll")]
            internal static partial void CoUninitialize();

            [LibraryImport("ole32.dll")]
            internal static partial int CoCreateInstance(
                in Guid clsid,
                nint outer,
                uint clsContext,
                in Guid iid,
                out nint result);

            [LibraryImport("ole32.dll")]
            internal static partial void CoTaskMemFree(
                nint ptr);
        }
    }
}
