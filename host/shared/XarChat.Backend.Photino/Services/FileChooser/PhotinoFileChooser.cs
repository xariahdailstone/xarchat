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

            string? res = null;

            await _windowControl.InvokeOnUIThread(() =>
            {
                //_windowControl.PhotinoWindow.ShowMessage(
                //    "Debug",
                //    "Showing file chooser for " +
                //    String.Join(";", filters.Select(f => String.Join(";", f.Extensions))));

                res = _windowControl.ShowFileChooser(
                    title: dialogTitle ?? "Select a File",
                    defaultPath: Path.GetDirectoryName(initialFile) ?? System.Environment.CurrentDirectory,
                    filters: filters.Select(f => (f.Name, f.Extensions.ToArray())).ToArray()
                );
            });

            return res;
        }
    }
}
