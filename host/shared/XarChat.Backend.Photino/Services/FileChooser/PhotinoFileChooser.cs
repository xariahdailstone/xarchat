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
            if (filter == null)
            {
                filter = new List<KeyValuePair<string, string>>()
                {
                    new KeyValuePair<string, string>("All Files", "*.*")
                };
            }

            // For Photino, filter entries should be just the extension; but per our
            // contract they're passed in like "*.mp3", or even "*.txt;*.pdf"...
            // so we'll split the list by semicolon, and then remove the "*." from
            // the start of each entry.

            var pfilters = new List<(string Name, string[] Extensions)>();
            foreach (var kvp in filter)
            {
                var pfname = kvp.Key;
                var pexts = new List<string>();
                foreach (var epart in kvp.Value.Split(';').Select(x => x.Trim()))
                {
                    var tepart = epart;
                    if (tepart.StartsWith("*."))
                    {
                        tepart = tepart.Substring(2);
                    }
                    if (tepart == "*")
                    {
                        tepart = "";
                    }
                    pexts.Add(tepart);
                }
                pfilters.Add((pfname, pexts.ToArray()));
            }

            string? res = null;

            await _windowControl.InvokeOnUIThread(() =>
            {
                res = _windowControl.ShowFileChooser(
                    title: dialogTitle ?? "Select a File",
                    defaultPath: Path.GetDirectoryName(initialFile) ?? System.Environment.CurrentDirectory,
                    filters: pfilters
                );
            });

            return res;
        }
    }
}
