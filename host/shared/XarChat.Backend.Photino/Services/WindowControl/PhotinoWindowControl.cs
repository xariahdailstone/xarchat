using Photino.NET;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend.Photino.Services.WindowControl
{
    public interface IPhotinoWindowControl : IWindowControl
    {
        PhotinoWindow PhotinoWindow { get; }

        string? ShowFileChooser(
            string title, string defaultPath, IReadOnlyList<(string Name, string[] Extensions)> filters);
    }

    public class PhotinoWindowControl : IPhotinoWindowControl
    {
        private readonly PhotinoWindow _photinoWindow;

        public PhotinoWindowControl(PhotinoWindow photinoWindow)
        {
            _photinoWindow = photinoWindow;
        }

        public IServiceProvider? ServiceProvider { get; set; }

        public PhotinoWindow PhotinoWindow => _photinoWindow;

        public void ApplicationReady()
        {
            Console.WriteLine("windowcontrol.ApplicationReady");

            var w = _photinoWindow.Width;
            var h = _photinoWindow.Height;
            var postStr = $"{{ \"type\": \"clientresize\", \"bounds\": [ {w}, {h} ]}}";
            Console.WriteLine($"posting {postStr}");
            _photinoWindow.SendWebMessage(postStr);
        }

        public void Close()
        {
            _photinoWindow.Close();
        }

        public void FlashWindow()
        {
            // TODO:
        }

        public Task InvokeOnUIThread(Action action)
        {
            var t = Task.Run(() =>
            {
                _photinoWindow.Invoke(action);
            });
            return t;
        }

        public void Maximize()
        {
            _photinoWindow.Minimized = false;
            _photinoWindow.Maximized = true;
        }

        public void Minimize()
        {
            _photinoWindow.Maximized = false;
            _photinoWindow.Minimized = true;
        }

        public Task RestartGPUProcess() => Task.CompletedTask;

        public void Restore()
        {
            _photinoWindow.Minimized = false;
            _photinoWindow.Maximized = false;
        }

        public Task SetBrowserZoomLevelAsync(float zoomLevel)
        {
            // TODO:
            return Task.CompletedTask;
        }

        public void ShowDevTools()
        {
            _photinoWindow.ShowDevTools();
        }

        public void StylesheetChanged(string stylesheetPath)
        {
            // TODO:
        }

        public string? ShowFileChooser(
            string title, string defaultPath, IReadOnlyList<(string Name, string[] Extensions)> filters)
        {
            var result = _photinoWindow.ShowOpenFile(
                title: title,
                defaultPath: defaultPath,
                multiSelect: false,
                filters: filters.ToArray());
            if (result is not null && result.Length > 0)
            {
                return result[0];
            }
            else
            {
                return null;
            }
        }
    }
}
