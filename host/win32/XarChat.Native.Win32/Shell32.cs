using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.Marshalling;
using System.Text;
using System.Threading.Tasks;
using Windows.Win32;
using Windows.Win32.Foundation;
using Windows.Win32.UI.Shell;
using Windows.Win32.UI.Shell.Common;
using XarChat.Native.Win32.ComInterop.ComFileOpenDialog;
using XarChat.Native.Win32.Wrapped;

namespace XarChat.Native.Win32
{
    public static class Shell32
    {
        public static unsafe IntPtr ExtractIcon(string exeFileName, uint iconIndex)
        {
            fixed (char* exeFileNamePtr = exeFileName)
            {
                var hIcon = PInvoke.ExtractIcon(
                    new HINSTANCE(InstanceHandle.CurrentInstance.Handle),
                    new PCWSTR(exeFileNamePtr),
                    iconIndex);
                return new IntPtr(hIcon.Value);
            }
        }

        public static unsafe string? BrowseForFolderx(
            IntPtr ownerWindow,
            string windowTitle,
            string? initialDirectory)
        {
            const uint BIF_RETURNONLYFSDIRS = 0x00000001;
            const uint BIF_EDITBOX = 0x00000010;
            const uint BIF_NEWDIALOGSTYLE = 0x00000040;
            const uint BIF_NONEWFOLDERBUTTON = 0x00000200;

            var resultBuffer = new char[500];
            fixed (char* resultBufferPtr = resultBuffer)
            fixed (char* windowTitlePtr = windowTitle)
            {
                BROWSEINFOW browseInfo = new BROWSEINFOW();
                browseInfo.hwndOwner = new HWND(ownerWindow);
                browseInfo.pidlRoot = (ITEMIDLIST*)0;
                browseInfo.pszDisplayName = new PWSTR(resultBufferPtr);
                browseInfo.lpszTitle = new PWSTR(windowTitlePtr);
                browseInfo.ulFlags = BIF_RETURNONLYFSDIRS | BIF_EDITBOX | BIF_NEWDIALOGSTYLE | BIF_NONEWFOLDERBUTTON;
                browseInfo.lpfn = null;
                browseInfo.lParam = 0;
                browseInfo.iImage = 0;
                ITEMIDLIST* itemIdListPtr = PInvoke.SHBrowseForFolder(browseInfo);

                // TODO: implement initialDirectory ... hookup lpfn, handle BFFM_INITIALIZED,
                // send BFFM_SETSELECTION message

                if (PInvoke.SHGetPathFromIDList(itemIdListPtr, new PWSTR(resultBufferPtr)))
                {
                    var sb = new StringBuilder(resultBuffer.Length);
                    for (var i = 0; i < resultBuffer.Length; i++)
                    {
                        var ch = resultBuffer[i];
                        if (ch == '\0')
                        {
                            break;
                        }
                        else
                        {
                            sb.Append(ch);
                        }
                    }
                    return sb.ToString();
                }
                else
                {
                    return null;
                }
            }
        }



        #region COM

        public static string? BrowseForFolder(
            IntPtr ownerWindow,
            string windowTitle,
            string? initialDirectory)
        {
            var result = FileOpenDialog.Show(
                configure: dialog =>
                {
                    dialog.SetTitle(windowTitle);
                    if (initialDirectory != null)
                    {
                        dialog.SetFolder(initialDirectory);
                    }

                    FILEOPENDIALOGOPTIONS fos = new FILEOPENDIALOGOPTIONS();
                    dialog.GetOptions(out fos);
                    fos |= FILEOPENDIALOGOPTIONS.FOS_PICKFOLDERS
                        | FILEOPENDIALOGOPTIONS.FOS_FORCEFILESYSTEM
                        | FILEOPENDIALOGOPTIONS.FOS_DONTADDTORECENT;
                    dialog.SetOptions(fos);
                },
                owner: ownerWindow);

            return result;
        }

        #endregion
    }

}
