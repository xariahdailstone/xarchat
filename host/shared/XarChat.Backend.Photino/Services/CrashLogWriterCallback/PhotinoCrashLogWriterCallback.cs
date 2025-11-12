using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.CrashLogWriter;
using XarChat.Backend.Photino.Services.WindowControl;

namespace XarChat.Backend.Photino.Services.CrashLogWriterCallback
{
    internal class PhotinoCrashLogWriterCallback : ICrashLogWriterCallback
    {
        private readonly IPhotinoWindowControl _photinoWindowControl;

        public PhotinoCrashLogWriterCallback(IPhotinoWindowControl photinoWindowControl)
        {
            _photinoWindowControl = photinoWindowControl;
        }

        public void OnCrashLogWritten(string filename, bool fatal)
        {
            _photinoWindowControl.InvokeOnUIThread(() =>
            {
                var photinoWindow = _photinoWindowControl.PhotinoWindow;
                if (fatal)
                {
                    photinoWindow.ShowMessage(
                        title: "XarChat Error",
                        text: "XarChat has encountered an unexpected error and must be shut down.\n\n" +
                            $"Details are logged to the file {filename}",
                        buttons: global::Photino.NET.PhotinoDialogButtons.Ok,
                        icon: global::Photino.NET.PhotinoDialogIcon.Error);
                }
                else
                {
                    photinoWindow.ShowMessage(
                        title: "XarChat Error",
                        text: "XarChat has encountered an unexpected error.\n\n" +
                            $"Details are logged to the file {filename}",
                        buttons: global::Photino.NET.PhotinoDialogButtons.Ok,
                        icon: global::Photino.NET.PhotinoDialogIcon.Error);
                }
            });
        }
    }
}
