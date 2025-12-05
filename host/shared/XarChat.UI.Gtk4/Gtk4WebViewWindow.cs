using System.Runtime.Versioning;
using Gdk;
using WebKit;
using XarChat.UI.Abstractions;

namespace XarChat.UI.Gtk4
{
    [SupportedOSPlatform("linux")]
    internal class Gtk4WebViewWindow : Gtk4Window, IWebViewWindow
    {
        private readonly WebKit.WebView _webView;

        public Gtk4WebViewWindow(Gtk4Application app)
            : base(app)
        {
            _webView = WebKit.WebView.New();

            _webView.OnLoadFailedWithTlsErrors += (o, e) =>
            {
                if (this.IgnoreLocalhostCertificateErrors)
                {
                    var uri = new Uri(e.FailingUri);
                    if (uri.Host == "localhost")
                    {
                        return true;
                    }
                }
                return false;
            };
            _webView.OnLoadChanged += (o, e) =>
            {
                switch (e.LoadEvent)
                {
                    case LoadEvent.Started:
                        Console.WriteLine("load started");
                        break;
                    case LoadEvent.Redirected:
                        Console.WriteLine("load redirected");
                        break;
                    case LoadEvent.Committed:
                        Console.WriteLine("load committed");
                        break;
                    case LoadEvent.Finished:
                        Console.WriteLine("load finished");
                        this.LoadCompleted?.Invoke(this, EventArgs.Empty);
                        break;
                }
            };
            
            this.GtkWindow.Child = _webView;
        }

        public bool CanLoadBeforeShow => true;

        public void NavigateTo(Uri uri)
        {
            ThrowIfNotUiThread();
            _webView.LoadUri(uri.ToString());
        }

        public bool DevToolsEnabled
        {
            get => field;
            set
            {
                if (field != value)
                {
                    field = value;
                    _webView.Settings = BuildWebkitSettings();
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
                    _webView.Settings = BuildWebkitSettings();
                }
            }
        } = true;

        public bool IgnoreLocalhostCertificateErrors { get; set; }

        private WebKit.Settings BuildWebkitSettings()
        {
            var s = new WebKit.Settings()
            {
                EnableDeveloperExtras = this.DevToolsEnabled,
                DisableWebSecurity = !this.WebSecurityEnabled
            };
            
            return s;
        }

        public event EventHandler<EventArgs>? LoadCompleted;
    }
}
