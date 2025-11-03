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
            IReadOnlyList<SelectLocalFileFilterEntry>? filters = null,
            string? dialogTitle = null,
            CancellationToken cancellationToken = default)
        {
            if (filters == null)
            {
                filters = new List<SelectLocalFileFilterEntry>()
                {
                    new SelectLocalFileFilterEntry("All Files", [])
                };
            }

            var wFilters = new List<KeyValuePair<string, string>>();
            foreach (var xf in filters)
            {
                var exts = String.Join(";", xf.Extensions.Select(x => x != "" ? $"*.{x}" : "*.*"));
                var fname = $"{xf.Name} ({exts})";
                wFilters.Add(new KeyValuePair<string, string>(fname, exts));
            }

            string? result = null;

            await _windowControl.InvokeOnUIThread(() =>
            {
                result = CommDlg32.GetOpenFileName(
                    ownerHwnd: _windowControl.WindowHandle, 
                    filter: wFilters,
                    selectedFile: initialFile,
                    dialogTitle: dialogTitle
                );

            });

            return result;
        }
    }
}
