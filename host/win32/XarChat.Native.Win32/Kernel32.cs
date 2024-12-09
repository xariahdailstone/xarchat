using Microsoft.Win32.SafeHandles;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using Windows.Win32;
using Windows.Win32.Foundation;
using Windows.Win32.Security;
//using Windows.Win32.Storage.FileSystem;
using XarChat.Native.Win32.Wrapped;

namespace XarChat.Native.Win32
{
    public static class Kernel32
    {
        //[DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        //public static extern nint GetModuleHandle([MarshalAs(UnmanagedType.LPWStr)] string? lpModuleName);

        public static unsafe string GetMainModuleName()
        {
            char[] res = new char[1024];
            fixed (char* resPtr = res)
            {
                var nameLen = PInvoke.GetModuleFileName(
                    new HMODULE(InstanceHandle.CurrentInstance.Handle),
                    new PWSTR(resPtr),
                    (uint)res.Length);

                var result = new String(resPtr, 0, (int)nameLen);
                return result;
            }
        }

        public static int GetLastError()
        {
            return Marshal.GetLastWin32Error();
        }

        public const int ERROR_ALREADY_EXISTS = 183;

        //public static bool AllocConsole()
        //{
        //    return PInvoke.AllocConsole();
        //}

        //public static bool FreeConsole()
        //{
        //    return PInvoke.FreeConsole();
        //}

        //public static SafeFileHandle CreateFile(string name, DesiredAccess desiredAccess,
        //    FileShareMode fileShareMode,
        //    FileCreationDisposition fileCreationDisposition,
        //    FileFlagsAndAttributes fileFlagsAndAttributes,
        //    SafeHandle? templateFile)
        //{
        //    var result = PInvoke.CreateFile(
        //        name, (uint)desiredAccess, 
        //        (FILE_SHARE_MODE)(uint)fileShareMode,
        //        null, 
        //        (FILE_CREATION_DISPOSITION)(uint)fileCreationDisposition,
        //        (FILE_FLAGS_AND_ATTRIBUTES)(uint)fileFlagsAndAttributes, 
        //        templateFile ?? new SafeFileHandle(IntPtr.Zero, false));
        //    return result;
        //}

        public enum DesiredAccess : UInt32
        {
            GenericRead = 0x40000000,
            GenericWrite = 0x80000000
        }

        [Flags]
        public enum FileShareMode : uint
        {
            None = 0x00000000,
            Delete = 0x00000004,
            Read = 0x00000001,
            Write = 0x00000002,
        }

        [Flags]
        public enum FileFlagsAndAttributes : uint
        {
            None = 0x00000000,
            FileAttributeReadOnly = 0x00000001,
            FileAttributeHidden = 0x00000002,
            FileAttributeSystem = 0x00000004,
            FileAttributeDirectory = 0x00000010,
            FileAttributeArchive = 0x00000020,
            FileAttributeDevice = 0x00000040,
            FileAttributeNormal = 0x00000080,
            FileAttributeTemporary = 0x00000100,
            FileAttributeSparseFile = 0x00000200,
            FileAttributeReparsePoint = 0x00000400,
            FileAttributeCompressed = 0x00000800,
            FileAttributeOffline = 0x00001000,
            FileAttributeNotContentIndexed = 0x00002000,
            FileAttributeEncrypted = 0x00004000,
            FileAttributeIntegrityStream = 0x00008000,
            FileAttributeVirtual = 0x00010000,
            FileAttributeNoScrubData = 0x00020000,
            FileAttributeEA = 0x00040000,
            FileAttributePinned = 0x00080000,
            FileAttributeUnpinnged = 0x00100000,
            FileAttributeRecallOnOpen = 0x00040000,
            FileAttributeRecallOnDataAccess = 0x00400000,
            FileFlagWriteThrough = 0x80000000,
            FileFlagOverlapped = 0x40000000,
            FileFlagNoBuffering = 0x20000000,
            FileFlagRandomAccess = 0x10000000,
            FileFlagSequentialScan = 0x08000000,
            FileFlagDeleteOnClose = 0x04000000,
            FileFlagBackupSemantics = 0x02000000,
            FileFlagPosixSemantics = 0x01000000,
            FileFlagSessionAware = 0x00800000,
            FileFlagOpenReparsePoint = 0x00200000,
            FileFlagOpenNoRecall = 0x00100000,
            FileFlagFirstPipeInstance = 0x00080000,
            PipeAccessDuplex = 0x00000003,
            PipeAccessInbound = 0x00000001,
            PipeAccessOutbound = 0x00000002,
            SecurityAnonymous = 0x00000000,
            SecurityIdentification = 0x00010000,
            SecurityImpersonation = 0x00020000,
            SecurityDelegation= 0x00030000,
            SecurityContextTracking = 0x00040000,
            SecurityEffectiveOnly = 0x00080000,
            SecuritySQOSPresent = 0x00100000,
            SecurityValidSQOSFlags = 0x001F0000,
        }

        public enum FileCreationDisposition : uint
        {
            CreateNew = 1U,
            CreateAlways = 2U,
            OpenExisting = 3U,
            OpenAlways = 4U,
            TruncateExisting = 5U,
        }

        private const UInt32 GENERIC_WRITE = 0x40000000;
        private const UInt32 GENERIC_READ = 0x80000000;
        private const UInt32 FILE_SHARE_READ = 0x00000001;
        private const UInt32 FILE_SHARE_WRITE = 0x00000002;
        private const UInt32 OPEN_EXISTING = 0x00000003;
        private const UInt32 FILE_ATTRIBUTE_NORMAL = 0x80;
        private const UInt32 ERROR_ACCESS_DENIED = 5;

    }
}
