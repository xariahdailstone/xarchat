using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.FileChooser;
using XarChat.Backend.Features.WindowControl;
using XarChat.Native.Win32;

namespace XarChat.Backend.Win32.FileChooser
{
    internal class Win32FileChooser : IFileChooser
    {
        private readonly IWin32WindowControl _windowControl;

        public Win32FileChooser(
            IWin32WindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        public async Task<string?> SelectLocalFileAsync(
            string? initialFile = null,
            IReadOnlyList<KeyValuePair<string, string>>? filter = null,
            string? dialogTitle = null,
            CancellationToken cancellationToken = default)
        {
            string? result = null;

            await _windowControl.InvokeOnUIThread(() =>
            {
                result = CommDlg32.GetOpenFileName(
                    ownerHwnd: _windowControl.WindowHandle, 
                    filter: filter,
                    selectedFile: initialFile,
                    dialogTitle: dialogTitle
                );

            });

            return result;
        }
    }
}
