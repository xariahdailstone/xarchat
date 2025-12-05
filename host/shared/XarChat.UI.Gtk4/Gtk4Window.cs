using System.Text;
using Wacton.Unicolour;
using XarChat.UI.Abstractions;

namespace XarChat.UI.Gtk4
{
    internal class Gtk4Window : IWindow
    {
        const uint GTK_STYLE_PROVIDER_PRIORITY_APPLICATION = 600;

        private readonly Gtk4Application _app;
        private readonly Gtk.CssProvider _cssProvider;
        private readonly Gtk.Window _win;

        private readonly Gtk.HeaderBar _headerBar;
        internal Gtk4Window(Gtk4Application app)
        {
            _app = app;
            _win = Gtk.Window.New();
            _win.Application = _app.GtkApplication;

            _cssProvider = new Gtk.CssProvider();
            _win.GetStyleContext().AddProvider(_cssProvider, GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);

            _headerBar = Gtk.HeaderBar.New();
            _win.Titlebar = _headerBar;
        }

        public Gtk4Application Application => _app;

        IApplication IWindow.Application => _app;

        protected internal Gtk.Window GtkWindow => _win;

        protected void ThrowIfNotUiThread()
        {
            if (this.NeedInvoke)
            {
                throw new InvalidOperationException("Operation must be performed on UI thread");
            }
        }

        public string Title
        {
            get
            {
                ThrowIfNotUiThread();
                return _win.Title ?? "";
            }
            set
            {
                ThrowIfNotUiThread();
                _win.Title = value;
            }
        }

        public Rectangle<int> Bounds
        {
            get
            {
                _win.GetBounds(out var x, out var y, out var width, out var height);
                return new Rectangle<int>(x, y, width, height);
            }
            set
            {
                _win.SetDefaultSize(value.Width, value.Height);
            }
        }

        public BackgroundForegroundColors? BackgroundColor
        {
            get
            {
                ThrowIfNotUiThread();
                return field;
            }
            set
            {
                ThrowIfNotUiThread();
                if (field != value)
                {
                    field = value;
                    UpdateCss();
                }
            }
        }

        public BackgroundForegroundColors? TitlebarColor
        {
            get
            {
                ThrowIfNotUiThread();
                return field;
            }
            set
            {
                ThrowIfNotUiThread();
                if (field != value)
                {
                    field = value;
                    UpdateCss();
                }
            }
        }

        private readonly Dictionary<EventHandler<EventArgs>, GObject.SignalHandler<GObject.Object, GObject.Object.NotifySignalArgs>> _sizeChangedHandlers = new();
        public event EventHandler<EventArgs>? SizeChanged
        {
            add
            {
                if (value is not null && !_sizeChangedHandlers.ContainsKey(value))
                {
                    GObject.SignalHandler<GObject.Object, GObject.Object.NotifySignalArgs> sigHandler = (o, e) =>
                    {
                        var name = e.Pspec.GetName();

                        if (name == Gtk.Window.DefaultWidthPropertyDefinition.UnmanagedName ||
                            name == Gtk.Window.DefaultHeightPropertyDefinition.UnmanagedName)
                        {
                            value(this, EventArgs.Empty);
                        }
                    };

                    _sizeChangedHandlers.Add(value, sigHandler);

                    _win.OnNotify += sigHandler;
                }
            }
            remove
            {
                if (value is not null && _sizeChangedHandlers.TryGetValue(value, out var sigHandler))
                {
                    _sizeChangedHandlers.Remove(value);
                    _win.OnNotify -= sigHandler;
                }
            }
        }

        private void UpdateCss()
        {
            var cssStrBuilder = new StringBuilder();

            var bgColor = this.BackgroundColor;
            if (bgColor is not null)
            {
                cssStrBuilder.Append($"window {{ ");
                if (bgColor.BackgroundColor is not null)
                {
                    cssStrBuilder.Append($" background: {ToHtmlColor(bgColor.BackgroundColor)}; }}");
                }
                if (bgColor.ForegroundColor is not null)
                {
                    cssStrBuilder.Append($" color: {ToHtmlColor(bgColor.ForegroundColor)}; }}");
                }
                cssStrBuilder.AppendLine($" }}");
            }

            var titlebarColor = this.TitlebarColor;
            if (titlebarColor is not null)
            {
                cssStrBuilder.Append($"headerbar {{ ");
                if (titlebarColor.BackgroundColor is not null)
                {
                    cssStrBuilder.Append($" background: {ToHtmlColor(titlebarColor.BackgroundColor)}; }}");
                }
                if (titlebarColor.ForegroundColor is not null)
                {
                    cssStrBuilder.Append($" color: {ToHtmlColor(titlebarColor.ForegroundColor)}; }}");
                }
                cssStrBuilder.AppendLine($" }}");
            }

            _cssProvider.LoadFromString(cssStrBuilder.ToString());
        }

        private object ToHtmlColor(Unicolour color)
        {
            static string ToHex(double d) { return ((byte)Math.Round(d * 255d)).ToString("X2"); }

            var rgb = color.Rgb;
            return "#" + ToHex(rgb.ConstrainedR) + ToHex(rgb.ConstrainedG) + ToHex(rgb.ConstrainedB);
        }

        public void Show()
        {
            ThrowIfNotUiThread();
            _win.Show();
        }
    }
}
