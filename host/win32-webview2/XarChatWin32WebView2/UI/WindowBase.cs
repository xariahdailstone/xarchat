using XarChat.Native.Win32;
using System.Drawing;
using System.Runtime.InteropServices;
using XarChat.Native.Win32.Wrapped;
using static XarChat.Native.Win32.User32;
using XarChat.Backend.Win32;
using XarChat.Backend.Common;
using System.Collections.Concurrent;

namespace MinimalWin32Test.UI
{
    public abstract class WindowBase : IHasWindowHandle, IWindowMessageHandlerSource, IDisposable
    {
        public WindowBase()
        {
            _title = this.GetType().Name;
        }

        ~WindowBase()
        {
            Dispose(false);
        }

        public TextWriter? StartupLogWriter { get; set; }

        protected void WriteToStartupLog(string message) => StartupLogWriter?.WriteLine(message);



        private WindowHandle? _windowHandle = null;

        public bool IsHandleCreated => _windowHandle != null;

        public void EnsureHandleCreated()
        {
            if (!IsHandleCreated)
            {
                OnHandleCreating();
                _windowHandle = CreateHandle();
                OnHandleCreated();
            }
        }

        protected virtual void OnHandleCreating()
        {
        }

        protected virtual void OnHandleCreated()
        {
            this.HandleCreated?.Invoke(this, EventArgs.Empty);
        }

        public event EventHandler? HandleCreated;

        protected abstract WindowClass GetWindowClass();

        protected abstract (WindowStyles WindowStyles, ExtendedWindowStyles ExtendedWindowStyles) GetWindowStyles();

        protected virtual WindowHandle CreateHandle()
        {
            WriteToStartupLog("WindowBase.CreateHandle start");

            WriteToStartupLog("WindowBase.CreateHandle calling GetWindowClass");
            var windowClass = GetWindowClass();

            WriteToStartupLog("WindowBase.CreateHandle calling GetWindowStyles");
            var winStyles = GetWindowStyles();

            WriteToStartupLog("WindowBase.CreateHandle calling WindowHandle.Create");
            var result = WindowHandle.Create(windowClass, _title, _bounds,
                winStyles.WindowStyles, winStyles.ExtendedWindowStyles,
                parentWindow: null,
                instance: InstanceHandle.CurrentInstance,
                hMenu: null,
                lpParam: null);

            _bounds = result.WindowRect;

            WriteToStartupLog("WindowBase.CreateHandle done");
            return result;
        }

        public WindowHandle WindowHandle
        {
            get
            {
                EnsureHandleCreated();
                return this._windowHandle!;
            }
        }

        private IHasWindowHandle? _parent = null;

        public IHasWindowHandle? Parent
        {
            get => _parent;
            set
            {
                if (_parent != value)
                {
                    _parent = value;
                    OnParentChanged();
                }
            }
        }

        protected virtual void OnParentChanged()
        {
            if (IsHandleCreated)
            {
                // TODO: update window
            }
        }


        private string _title;

        public string Title
        {
            get => _title;
            set
            {
                if (_title != value)
                {
                    _title = value;
                    OnTitleChanged();
                }
            }
        }

        protected virtual void OnTitleChanged()
        {
            if (IsHandleCreated)
            {
                // TODO: update window title
            }
        }

        private Rectangle? _bounds = null;

        public Rectangle? Bounds
        {
            get
            {
                if (IsHandleCreated)
                {
                    var result = _windowHandle!.WindowRect;
                    this._bounds = result;
                    return result;
                }
                else
                {
                    return _bounds;
                }
            }
            set
            {
                if (value == null)
                {
                    throw new ArgumentNullException(nameof(value));
                }
                if (IsHandleCreated)
                {
                    _windowHandle!.WindowRect = value.Value;
                }
                if (_bounds != value)
                {
                    _bounds = value;
                    OnBoundsChanged();
                }
            }
        }

        protected virtual void OnBoundsChanged()
        {
            if (IsHandleCreated)
            {
                // TODO: update window bounds
            }
        }

        private bool _disposed = false;

        public void Dispose()
        {
            GC.SuppressFinalize(this);
            Dispose(true);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (_disposed)
            {
                _disposed = true;

                _windowHandle?.Dispose();
            }
        }

        public void Show()
        {
            this.Visible = true;
        }

        public void Hide()
        {
            this.Visible = false;
        }

        private bool _visible = false;

        public bool Visible
        {
            get => _visible;
            set
            {
                if (_visible != value)
                {
                    _visible = value;
                    if (value)
                    {
                        WriteToStartupLog("WindowBase.Visible calling EnsureHandleCreated");
                        EnsureHandleCreated();
                        WriteToStartupLog("WindowBase.Visible setting ShowOptions");
                        this.WindowHandle.ShowOptions = this.WindowHandle.ShowOptions | ShowWindowOptions.SHOW;
                    }
                    else
                    {
                        if (IsHandleCreated)
                        {
                            this.WindowHandle.ShowOptions = this.WindowHandle.ShowOptions & ~ShowWindowOptions.SHOW;
                        }
                    }
                }
            }
        }

        nint IWindowMessageHandlerSource.WindowHandle => this.WindowHandle.Handle;

        protected virtual nint WndProc(WindowHandle windowHandle, uint msg, nuint wParam, nint lParam)
        {
            foreach (var h in _messageHandlerFuncs.Values)
            {
                var res = h(windowHandle, msg, wParam, lParam);
                if (res is not null)
                {
                    return res.Value;
                }
            }
            return User32.DefWindowProc(windowHandle.Handle, msg, wParam, lParam);
        }

        private readonly ConcurrentDictionary<object, PossibleWindowMessageHandlerFunc> _messageHandlerFuncs
            = new ConcurrentDictionary<object, PossibleWindowMessageHandlerFunc>();

        public IDisposable AddWindowMessageHandler(PossibleWindowMessageHandlerFunc handler)
        {
            var myKey = new object();
            _messageHandlerFuncs.TryAdd(myKey, handler);
            return new ActionDisposable(() =>
            {
                _messageHandlerFuncs.TryRemove(new (myKey, handler));
            });
        }
    }
}
