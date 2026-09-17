using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.Marshalling;

namespace XarChat.Native.Win32.ComInterop.AudioApi
{
    internal enum EDataFlow
    {
        Render = 0,
        Capture = 1,
        All = 2
    }

    internal enum ERole
    {
        Console = 0,
        Multimedia = 1,
        Communications = 2
    }

    internal enum AudioSessionState
    {
        Inactive = 0,
        Active = 1,
        Expired = 2
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct PROPERTYKEY
    {
        public Guid fmtid;
        public uint pid;
    }


    // ========================================================================
    // MMDevice
    // ========================================================================

    [GeneratedComInterface(
        StringMarshalling = StringMarshalling.Utf16)]
    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal partial interface IMMDeviceEnumerator
    {
        // Slot 3
        void EnumAudioEndpoints(
            EDataFlow dataFlow,
            uint stateMask,
            out IMMDeviceCollection devices);

        // Slot 4
        void GetDefaultAudioEndpoint(
            EDataFlow dataFlow,
            ERole role,
            out IMMDevice endpoint);

        // Slot 5
        void GetDevice(
            string deviceId,
            out IMMDevice device);

        // Slot 6
        void RegisterEndpointNotificationCallback(
            IMMNotificationClient client);

        // Slot 7
        void UnregisterEndpointNotificationCallback(
            IMMNotificationClient client);
    }


    [GeneratedComInterface]
    [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal partial interface IMMDeviceCollection
    {
        void GetCount(
            out uint count);

        void Item(
            uint deviceNumber,
            out IMMDevice device);
    }


    [GeneratedComInterface]
    [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal partial interface IMMDevice
    {
        // Slot 3
        void Activate(
            in Guid iid,
            uint clsCtx,
            nint activationParams,
            out nint interfacePointer);

        /*
         * Slot 4.
         *
         * Not used, but it must be present because GetId follows it.
         */
        void OpenPropertyStore(
            uint stgmAccess,
            out nint properties);

        // Slot 5
        void GetId(
            out nint id);

        // Slot 6
        void GetState(
            out uint state);
    }


    [GeneratedComInterface(
        StringMarshalling = StringMarshalling.Utf16)]
    [Guid("7991EEC9-7E89-4D85-8390-6C703CEC60C0")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal partial interface IMMNotificationClient
    {
        // Slot 3
        void OnDeviceStateChanged(
            string deviceId,
            uint newState);

        // Slot 4
        void OnDeviceAdded(
            string deviceId);

        // Slot 5
        void OnDeviceRemoved(
            string deviceId);

        // Slot 6
        void OnDefaultDeviceChanged(
            EDataFlow flow,
            ERole role,
            string? defaultDeviceId);

        // Slot 7
        void OnPropertyValueChanged(
            string deviceId,
            PROPERTYKEY key);
    }


    // ========================================================================
    // Audio session API
    // ========================================================================

    [GeneratedComInterface]
    [Guid("BFA971F1-4D5E-40BB-935E-967039BFBEE4")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal partial interface IAudioSessionManager
    {
        void GetAudioSessionControl(
            nint audioSessionGuid,
            uint streamFlags,
            out nint sessionControl);

        void GetSimpleAudioVolume(
            nint audioSessionGuid,
            uint streamFlags,
            out nint audioVolume);
    }


    [GeneratedComInterface]
    [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal partial interface IAudioSessionManager2
        : IAudioSessionManager
    {
        void GetSessionEnumerator(
            out IAudioSessionEnumerator sessionEnumerator);

        void RegisterSessionNotification(
            IAudioSessionNotification sessionNotification);

        void UnregisterSessionNotification(
            IAudioSessionNotification sessionNotification);

        /*
         * RegisterDuckNotification and UnregisterDuckNotification follow,
         * but we never call them.
         */
    }


    [GeneratedComInterface]
    [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal partial interface IAudioSessionEnumerator
    {
        void GetCount(
            out int sessionCount);

        void GetSession(
            int sessionIndex,
            out IAudioSessionControl session);
    }


    [GeneratedComInterface(
        StringMarshalling = StringMarshalling.Utf16)]
    [Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal partial interface IAudioSessionControl
    {
        void GetState(
            out AudioSessionState state);

        void GetDisplayName(
            out nint displayName);

        void SetDisplayName(
            string displayName,
            nint eventContext);

        void GetIconPath(
            out nint iconPath);

        void SetIconPath(
            string iconPath,
            nint eventContext);

        void GetGroupingParam(
            out Guid groupingId);

        void SetGroupingParam(
            in Guid groupingId,
            nint eventContext);

        void RegisterAudioSessionNotification(
            nint client);

        void UnregisterAudioSessionNotification(
            nint client);
    }


    [GeneratedComInterface(
        StringMarshalling = StringMarshalling.Utf16)]
    [Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal partial interface IAudioSessionControl2
        : IAudioSessionControl
    {
        void GetSessionIdentifier(
            out nint sessionIdentifier);

        void GetSessionInstanceIdentifier(
            out nint sessionInstanceIdentifier);

        void GetProcessId(
            out uint processId);

        /*
         * IsSystemSoundsSession and SetDuckingPreference follow,
         * but aren't needed here.
         */
    }


    [GeneratedComInterface]
    [Guid("641DD20B-4D41-49CC-ABA3-174B9477BB08")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal partial interface IAudioSessionNotification
    {
        void OnSessionCreated(
            IAudioSessionControl newSession);
    }
}
