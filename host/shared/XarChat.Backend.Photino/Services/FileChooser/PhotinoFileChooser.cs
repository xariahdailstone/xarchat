using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.FileChooser;
using XarChat.Backend.Features.WindowControl;
using XarChat.Backend.Photino.Services.WindowControl;

namespace XarChat.Backend.Photino.Services.FileChooser
{
    internal class PhotinoFileChooser : IFileChooser
    {
        private readonly IPhotinoWindowControl _windowControl;

        public PhotinoFileChooser(
            IPhotinoWindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        public async Task<string?> SelectLocalFileAsync(
            string? initialFile = null, 
            IReadOnlyList<KeyValuePair<string, string>>? filter = null, 
            string? dialogTitle = null, 
            CancellationToken cancellationToken = default)
        {
            string? res = null;

            await _windowControl.InvokeOnUIThread(() =>
            {
                res = _windowControl.ShowFileChooser(
                    title: dialogTitle ?? "Select a File",
                    defaultPath: Path.GetDirectoryName(initialFile) ?? System.Environment.CurrentDirectory,
                    filters: filter is not null
                        ? filter.Select(f => (f.Key, new string[] { f.Value })).ToList()
                        : [ ( "All Files", new string[] { "*" }) ]
                );
            });

            return res;
        }
    }
}
