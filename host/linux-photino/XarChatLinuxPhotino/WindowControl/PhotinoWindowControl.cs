
using Photino.NET;
using XarChat.Backend.Features.WindowControl;

namespace XarChatLinuxPhotino.WindowControl
{
    public class PhotinoWindowControl : IWindowControl
    {
        private readonly PhotinoWindow _photinoWindow;

        public PhotinoWindowControl(PhotinoWindow photinoWindow)
        {
            _photinoWindow = photinoWindow;
        }

        public IServiceProvider? ServiceProvider { get; set; }

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

        public void Restore()
        {
            _photinoWindow.Maximized = false;
            _photinoWindow.Minimized = false;
        }

        public void ShowDevTools()
        {
            _photinoWindow.ShowDevTools();
            //_photinoWindow.DevToolsEnabled = true;
        }

        public void StylesheetChanged(string stylesheetPath)
        {
            // TODO:
        }
    }
}