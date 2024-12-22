using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Native.Win32
{
    public static class CommDlg32
    {
        [DllImport("comdlg32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern bool GetOpenFileName([In, Out] OpenFileName ofn);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private class OpenFileName
        {
            public int structSize = 0;
            public IntPtr dlgOwner = IntPtr.Zero;
            public IntPtr instance = IntPtr.Zero;

            public String? filter = null;
            public String? customFilter = null;
            public int maxCustFilter = 0;
            public int filterIndex = 0;

            public String? file = null;
            public int maxFile = 0;

            public String? fileTitle = null;
            public int maxFileTitle = 0;

            public String? initialDir = null;

            public String? title = null;

            public int flags = 0;
            public short fileOffset = 0;
            public short fileExtension = 0;

            public String? defExt = null;

            public IntPtr custData = IntPtr.Zero;
            public IntPtr hook = IntPtr.Zero;

            public String? templateName = null;

            public IntPtr reservedPtr = IntPtr.Zero;
            public int reservedInt = 0;
            public int flagsEx = 0;
        }

        public static string? GetOpenFileName(
            nint ownerHwnd,
            IEnumerable<KeyValuePair<string, string>>? filter = null,
            string? selectedFile = null,
            string? dialogTitle = null)
        {
            var ofn = new OpenFileName();
            ofn.structSize = Marshal.SizeOf(typeof(OpenFileName));

            ofn.dlgOwner = ownerHwnd;

            if (!String.IsNullOrWhiteSpace(selectedFile))
            {
                ofn.file = selectedFile + new string(new char[1024 - selectedFile.Length]);
                ofn.initialDir = Path.GetDirectoryName(selectedFile);
            }
            else
            {
                ofn.file = new string(new char[1024]);
                ofn.initialDir = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            }
            ofn.maxFile = ofn.file.Length;

            if (filter != null && filter.Any())
            {
                var sb = new StringBuilder();
                foreach (var f in filter)
                {
                    sb.Append(f.Key);
                    sb.Append('\0');
                    sb.Append(f.Value);
                    sb.Append('\0');
                }
                sb.Append('\0');
                ofn.filter = sb.ToString();
            }
            else
            {
                ofn.filter = "All Files (*.*)\0*.*\0\0";
            }

            ofn.fileTitle = new string(new char[64]);
            ofn.maxFileTitle = ofn.fileTitle.Length;

            //ofn.initialDir = "C:\\";
            ofn.title = !String.IsNullOrWhiteSpace(dialogTitle) ? dialogTitle : "Select File";
            //ofn.defExt = "mp3";

            if (GetOpenFileName(ofn))
            {
                return ofn.file;
            }
            else
            {
                return null;
            }
        }
    }
}
