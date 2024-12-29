using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.WindowControl
{
    public interface IWindowControl
    {
        IServiceProvider? ServiceProvider { get; set; }

        void ApplicationReady();
        void ShowDevTools();

        void StylesheetChanged(string stylesheetPath);

        void Minimize();
        void Maximize();
        void Restore();
        void Close();

        Task InvokeOnUIThread(Action action);

        Task RestartGPUProcess();
    }
}
