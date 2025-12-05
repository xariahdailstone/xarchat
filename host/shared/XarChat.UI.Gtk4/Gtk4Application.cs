using XarChat.UI.Abstractions;

namespace XarChat.UI.Gtk4
{
    public class Gtk4Application : IApplication
    {
        private SynchronizationContext? _syncContext = null;
        private Thread _uiThread;
        private readonly Gtk.Application _gtkApp;

        public Gtk4Application(string applicationId)
        {
            Gtk.Module.Initialize();
            Gdk.Module.Initialize();
            WebKit.Module.Initialize();

            _uiThread = Thread.CurrentThread;
            _gtkApp = Gtk.Application.New(applicationId, Gio.ApplicationFlags.FlagsNone);
            _gtkApp.OnActivate += (o, e) =>
            {
                this._syncContext = SynchronizationContext.Current;
                this.OnRunning?.Invoke(this, EventArgs.Empty);
            };
        }

        public SynchronizationContext SynchronizationContext
        {
            get => _syncContext is not null ? _syncContext : throw new InvalidOperationException("Cannot read SynchronizationContext before calling Run()");
        }

        private void ThrowIfNotRunning()
        {
            if (this._syncContext is null)
            {
                throw new InvalidOperationException("Application is not running");
            }
        }

        private void ThrowIfNotUiThread()
        {
            if (NeedInvoke)
            {
                throw new InvalidOperationException("Operation must be called from the UI thread");
            }
        }

        internal Gtk.Application GtkApplication => _gtkApp;

        public bool NeedInvoke => Thread.CurrentThread != _uiThread;

        public event EventHandler<EventArgs>? OnRunning;

        public bool SupportsMultipleWindows => true;

        public IWebViewWindow CreateWebViewWindow()
        {
            ThrowIfNotRunning();
            ThrowIfNotUiThread();

            var result = new Gtk4WebViewWindow(this);
            return result;
        }

        public void Run()
        {
            _gtkApp.RunWithSynchronizationContext([]);
            this._syncContext = null;
        }

        public void Exit()
        {
            ThrowIfNotRunning();

            this.InvokeAsync(() =>
            {
                _gtkApp.Quit();
            });
        }
    }
}
