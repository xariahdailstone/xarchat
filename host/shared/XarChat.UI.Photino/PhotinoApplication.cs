using System.Security.Principal;
using Photino.NET;
using XarChat.UI.Abstractions;

namespace XarChat.UI.Photino
{
    public class PhotinoApplication : IApplication
    {
        public PhotinoApplication()
        {
        }

        public SynchronizationContext SynchronizationContext => throw new NotImplementedException();

        public bool NeedInvoke => throw new NotImplementedException();

        public event EventHandler<EventArgs>? OnRunning;

        internal PhotinoWebViewWindow? MainWindow { get; set; }

        public bool SupportsMultipleWindows => false;

        public IWebViewWindow CreateWebViewWindow()
        {
            if (this.MainWindow is not null)
            {
                throw new InvalidOperationException("cannot create multiple windows");
            }

            var win = new PhotinoWebViewWindow(this);
            if (this.MainWindow is null)
            {
                this.MainWindow = win;
            }
            _activeWindows.Add(win);
            return win;
        }

        public void Exit()
        {
            foreach (var w in _activeWindows.ToArray())
            {
                w.Window.Close();
            }
        }

        private HashSet<PhotinoWebViewWindow> _activeWindows = new HashSet<PhotinoWebViewWindow>();

        public void Run()
        {
            var loopsRemaining = 10;
            this.OnRunning?.Invoke(this, EventArgs.Empty);
            while (_activeWindows.Count > 0)
            {
                var first = _activeWindows.First();
                Console.WriteLine("Waiting for window close");
                first.Window.WaitForClose();
                if (--loopsRemaining <= 0) { Console.WriteLine("loop breakout"); break; }
            }
            Console.WriteLine("All windows closed");
        }

        internal void WindowClosed(PhotinoWebViewWindow window)
        {
            _activeWindows.Remove(window);
        }
    }

    internal class PhotinoWebViewWindow : IWebViewWindow
    {
        private PhotinoWindow _window;

        public PhotinoWebViewWindow(PhotinoApplication application)
        {
            this.Application = application;

            _window = new PhotinoWindow(application.MainWindow?.Window)
                .SetDevToolsEnabled(this.DevToolsEnabled)
                .SetWebSecurityEnabled(this.WebSecurityEnabled)
                .SetIgnoreCertificateErrorsEnabled(this.IgnoreLocalhostCertificateErrors)
                .SetTitle("")
                .SetUseOsDefaultSize(true)
                .SetUseOsDefaultLocation(true)
                .SetMinSize(600, 400)
                .SetMaxSize(99999, 99999);

            _window.WindowCreated += (o, e) =>
            {
                Console.WriteLine("window created");
                this.Shown?.Invoke(this, EventArgs.Empty);
            };

            _window.WindowClosing += (o, e) =>
            {
                application.WindowClosed(this);
                return false;
            };
        }

        internal PhotinoApplication Application { get; }

        internal PhotinoWindow Window => _window;

        IApplication IWindow.Application => this.Application;

        public bool DevToolsEnabled 
        { 
            get => field;
            set
            {
                if (field != value)
                {
                    field = value;
                    _window.SetDevToolsEnabled(value);
                }
            }
        }

        public bool WebSecurityEnabled 
        {
            get => field;
            set
            {
                if (field != value)
                {
                    field = value;
                    _window.SetWebSecurityEnabled(value);
                }
            }
        } = true;

        public bool IgnoreLocalhostCertificateErrors 
        {
            get => field;
            set
            {
                if (field != value)
                {
                    field = value;
                    _window.SetIgnoreCertificateErrorsEnabled(value);
                }
            }
        }

        public string Title
        {
            get => _window.Title;
            set => _window.SetTitle(value);
        }

        public Rectangle<int> Bounds
        {
            get => new(_window.Left, _window.Top, _window.Width, _window.Height);
            set
            {
                if (value != this.Bounds)
                {
                    _window.Left = value.X;
                    _window.Top = value.Y;
                    _window.SetSize(value.Width, value.Height);   
                }
            }
        }

        public BackgroundForegroundColors? BackgroundColor 
        { 
            get => throw new NotImplementedException(); 
            set { }
        }

        public BackgroundForegroundColors? TitlebarColor
        { 
            get => throw new NotImplementedException();
            set
            {
                static int To255(double d) => (int)Math.Round(d * 255d);

                if (value?.BackgroundColor is not null)
                {
                    var rgb = value.BackgroundColor.Rgb;
                    _window.SetTitlebarColor(
                        To255(rgb.ConstrainedR),
                        To255(rgb.ConstrainedG),
                        To255(rgb.ConstrainedB));
                }
                else
                {
                    _window.SetTitlebarColor(-1, -1, -1);
                }
            }
        }

        public event EventHandler<EventArgs>? LoadCompleted;

        public event EventHandler<EventArgs>? SizeChanged;

        private Uri? _navigateToUri = null;
        private bool _showStarted = false;

        public bool CanLoadBeforeShow => false;

        public void NavigateTo(Uri uri)
        {
            _navigateToUri = uri;
            if (_showStarted)
            {
                _window.Load(uri);
            }
        }

        public void Show()
        {
            if (!_showStarted)
            {
                _showStarted = true;
                _window.Load(_navigateToUri?.ToString() ?? "about:blank");
            }
        }

        public event EventHandler<EventArgs>? Shown;
    }
}