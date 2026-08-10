using System.Runtime.InteropServices;
using System.Runtime.InteropServices.Marshalling;
using System.Runtime.Versioning;

namespace XarChat.Native.Win32.ComInterop.ComFileOpenDialog;

[SupportedOSPlatform("windows")]
public static partial class FileOpenDialog
{
    private const uint CLSCTX_INPROC_SERVER = 0x1;

    private const uint COINIT_APARTMENTTHREADED = 0x2;

    private const int ERROR_CANCELLED_HRESULT =
        unchecked((int)0x800704C7);

    private static readonly Guid CLSID_FileOpenDialog =
        new("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7");

    private static readonly Guid IID_IFileOpenDialog =
        new("D57C7288-D4AD-4768-BE02-9D969532D960");


    internal static string? Show(
        Action<IFileOpenDialog>? configure = null,
        nint owner = 0)
    {
        IFileOpenDialog? dialog = null;

        int hr = CoCreateInstance(
            in CLSID_FileOpenDialog,
            0,
            CLSCTX_INPROC_SERVER,
            in IID_IFileOpenDialog,
            out dialog);

        ThrowIfFailed(hr);

        if (dialog is null)
            throw new COMException(
                "CoCreateInstance returned a null IFileOpenDialog.");

        // Allow the caller to fully configure the dialog before it is shown.
        configure?.Invoke(dialog);

        hr = dialog.Show(owner);

        if (hr == ERROR_CANCELLED_HRESULT)
            return null;

        ThrowIfFailed(hr);

        hr = dialog.GetResult(out IShellItem item);
        ThrowIfFailed(hr);

        hr = item.GetDisplayName(
            SIGDN.SIGDN_FILESYSPATH,
            out nint pszName);

        ThrowIfFailed(hr);

        try
        {
            return Marshal.PtrToStringUni(pszName);
        }
        finally
        {
            CoTaskMemFree(pszName);
        }
    }


    private static void ThrowIfFailed(int hr)
    {
        if (hr < 0)
            throw new COMException(
                $"COM call failed with HRESULT 0x{hr:X8}.",
                hr);
    }

    internal static void SetFolder(this IFileOpenDialog dialog,
        string path)
    {
        IShellItem folder = CreateShellItem(path);
        int hr = dialog.SetFolder(folder);
        ThrowIfFailed(hr);
    }

    private static readonly Guid IID_IShellItem =
    new("43826D1E-E718-42EE-BC55-A1E261C37BFE");

    [LibraryImport(
        "shell32.dll",
        StringMarshalling = StringMarshalling.Utf16)]
    private static partial int SHCreateItemFromParsingName(
        string pszPath,
        nint pbc,
        in Guid riid,
        out IShellItem? ppv);

    internal static IShellItem CreateShellItem(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);

        IShellItem? item = null;

        int hr = SHCreateItemFromParsingName(
            path,
            0,
            in IID_IShellItem,
            out item);

        ThrowIfFailed(hr);

        return item
            ?? throw new COMException(
                "SHCreateItemFromParsingName returned a null IShellItem.");
    }


    //[LibraryImport("ole32.dll")]
    //private static partial int CoInitializeEx(
    //    nint pvReserved,
    //    uint dwCoInit);


    //[LibraryImport("ole32.dll")]
    //private static partial void CoUninitialize();


    [LibraryImport("ole32.dll")]
    private static partial void CoTaskMemFree(
        nint pv);


    //
    // LibraryImport understands GeneratedComInterface types.
    //
    // So ppv is turned into a ComWrappers-backed managed
    // IFileOpenDialog without Marshal.GetObjectForIUnknown().
    //
    [LibraryImport("ole32.dll")]
    private static partial int CoCreateInstance(
        in Guid rclsid,
        nint pUnkOuter,
        uint dwClsContext,
        in Guid riid,
        out IFileOpenDialog? ppv);
}

[GeneratedComInterface(StringMarshalling = StringMarshalling.Utf16)]
[Guid("B4DB1657-70D7-485E-8E3E-6FCB5A5C1802")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal partial interface IModalWindow
{
    //
    // PreserveSig is important here because cancellation is returned
    // as an HRESULT and we don't want it automatically converted into
    // an exception.
    //
    [PreserveSig]
    int Show(nint hwndOwner);
}


[GeneratedComInterface(StringMarshalling = StringMarshalling.Utf16)]
[Guid("42F85136-DB7E-439C-85F1-E4075D135FC8")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal partial interface IFileDialog : IModalWindow
{
    [PreserveSig]
    int SetFileTypes(
        uint cFileTypes,
        nint rgFilterSpec);

    [PreserveSig]
    int SetFileTypeIndex(
        uint iFileType);

    [PreserveSig]
    int GetFileTypeIndex(
        out uint piFileType);

    [PreserveSig]
    int Advise(
        nint pfde,
        out uint pdwCookie);

    [PreserveSig]
    int Unadvise(
        uint dwCookie);

    [PreserveSig]
    int SetOptions(
        FILEOPENDIALOGOPTIONS fos);

    [PreserveSig]
    int GetOptions(
        out FILEOPENDIALOGOPTIONS pfos);

    [PreserveSig]
    int SetDefaultFolder(
        nint psi);

    [PreserveSig]
    int SetFolder(
        IShellItem psi);

    [PreserveSig]
    int GetFolder(
        out nint ppsi);

    [PreserveSig]
    int GetCurrentSelection(
        out nint ppsi);

    [PreserveSig]
    int SetFileName(
        string pszName);

    [PreserveSig]
    int GetFileName(
        out nint pszName);

    [PreserveSig]
    int SetTitle(
        string pszTitle);

    [PreserveSig]
    int SetOkButtonLabel(
        string pszText);

    [PreserveSig]
    int SetFileNameLabel(
        string pszLabel);

    [PreserveSig]
    int GetResult(
        out IShellItem ppsi);

    [PreserveSig]
    int AddPlace(
        nint psi,
        FDAP fdap);

    [PreserveSig]
    int SetDefaultExtension(
        string pszDefaultExtension);

    [PreserveSig]
    int Close(
        int hr);

    [PreserveSig]
    int SetClientGuid(
        in Guid guid);

    [PreserveSig]
    int ClearClientData();

    [PreserveSig]
    int SetFilter(
        nint pFilter);
}


[GeneratedComInterface(StringMarshalling = StringMarshalling.Utf16)]
[Guid("D57C7288-D4AD-4768-BE02-9D969532D960")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal partial interface IFileOpenDialog : IFileDialog
{
    [PreserveSig]
    int GetResults(
        out nint ppenum);

    [PreserveSig]
    int GetSelectedItems(
        out nint ppsai);
}

[GeneratedComInterface]
[Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal partial interface IShellItem
{
    [PreserveSig]
    int BindToHandler(
        nint pbc,
        in Guid bhid,
        in Guid riid,
        out nint ppv);

    [PreserveSig]
    int GetParent(
        out nint ppsi);

    [PreserveSig]
    int GetDisplayName(
        SIGDN sigdnName,
        out nint ppszName);

    [PreserveSig]
    int GetAttributes(
        uint sfgaoMask,
        out uint psfgaoAttribs);

    [PreserveSig]
    int Compare(
        nint psi,
        uint hint,
        out int piOrder);
}

[Flags]
internal enum FILEOPENDIALOGOPTIONS : uint
{
    FOS_OVERWRITEPROMPT = 0x00000002,
    FOS_STRICTFILETYPES = 0x00000004,
    FOS_NOCHANGEDIR = 0x00000008,
    FOS_PICKFOLDERS = 0x00000020,
    FOS_FORCEFILESYSTEM = 0x00000040,
    FOS_ALLNONSTORAGEITEMS = 0x00000080,
    FOS_NOVALIDATE = 0x00000100,
    FOS_ALLOWMULTISELECT = 0x00000200,
    FOS_PATHMUSTEXIST = 0x00000800,
    FOS_FILEMUSTEXIST = 0x00001000,
    FOS_CREATEPROMPT = 0x00002000,
    FOS_SHAREAWARE = 0x00004000,
    FOS_NOREADONLYRETURN = 0x00008000,
    FOS_NOTESTFILECREATE = 0x00010000,
    FOS_HIDEMRUPLACES = 0x00020000,
    FOS_HIDEPINNEDPLACES = 0x00040000,
    FOS_NODEREFERENCELINKS = 0x00100000,
    FOS_OKBUTTONNEEDSINTERACTION = 0x00200000,
    FOS_DONTADDTORECENT = 0x02000000,
    FOS_FORCESHOWHIDDEN = 0x10000000,
    FOS_DEFAULTNOMINIMODE = 0x20000000,
    FOS_FORCEPREVIEWPANEON = 0x40000000,
    FOS_SUPPORTSTREAMABLEITEMS = 0x80000000,
}


internal enum FDAP
{
    FDAP_BOTTOM = 0,
    FDAP_TOP = 1
}


internal enum SIGDN : uint
{
    SIGDN_NORMALDISPLAY = 0x00000000,
    SIGDN_PARENTRELATIVEPARSING = 0x80018001,
    SIGDN_DESKTOPABSOLUTEPARSING = 0x80028000,
    SIGDN_PARENTRELATIVEEDITING = 0x80031001,
    SIGDN_DESKTOPABSOLUTEEDITING = 0x8004C000,

    SIGDN_FILESYSPATH = 0x80058000,

    SIGDN_URL = 0x80068000,
    SIGDN_PARENTRELATIVEFORADDRESSBAR = 0x8007C001,
    SIGDN_PARENTRELATIVE = 0x80080001,
    SIGDN_PARENTRELATIVEFORUI = 0x80094001
}

public static class FileOpenDialogExtensions
{
    
}