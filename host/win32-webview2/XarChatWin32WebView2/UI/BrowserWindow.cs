﻿using Microsoft.Web.WebView2.Core;
using XarChat.Native.Win32;
using System.Runtime.InteropServices;
using XarChat.Native.Win32.Wrapped;
using static XarChat.Native.Win32.User32;
using XarChat.Backend;
using XarChat.Backend.Features.WindowControl;
using XarChat.Backend.UrlHandlers.XCHostFunctions;
using Microsoft.Extensions.DependencyInjection;
using System.Drawing;
using XarChat.Backend.Features.AppDataFolder;
using Windows.Media.SpeechRecognition;
using XarChat.Backend.Common;
using System.Text.Json.Serialization;
using static MinimalWin32Test.UI.BrowserWindow;
using XarChat.Backend.Win32;
using XarChat.Backend.Features.CommandLine;
using MinimalWin32Test.Properties;
using System.Web;
using XarChatWin32WebView2.UI;
using XarChat.Backend.Features.MemoryHinter;
using WinRT;
using XarChat.Backend.Features.AppConfiguration;

namespace MinimalWin32Test.UI
{
    public class BrowserWindow : WindowBase
    {
        private static int _nextClassNum = 0;
        private WindowClass? _windowClass;

        private readonly MessageLoop _app;
        private readonly XarChatBackend _backend;
        private readonly IWindowControl _wc;

        private readonly ICommandLineOptions _commandLineOptions;

        private readonly CancellationTokenSource _disposedCTS = new CancellationTokenSource();

        public BrowserWindow(MessageLoop app, XarChatBackend backend, IWindowControl wc, ICommandLineOptions clo)
        {
            _app = app;
            _backend = backend;
            _wc = wc;
            _commandLineOptions = clo;
            //this.Bounds = new System.Drawing.Rectangle(100, 100, 640 * 2, 480 * 2);

            Task.Run(async () =>
            {
                var cancellationToken = _disposedCTS.Token;

                var ac = (await _backend.GetServiceProviderAsync()).GetRequiredService<IAppConfiguration>();
                using var subscr = ac.OnValueChanged("global.bgColor", (value) =>
                {
                    try
                    {
                        string valStr;
                        if (value == null)
                        {
                            valStr = "225;7";
                        }
                        else
                        {
                            valStr = value.ToString();
                        }
                        var parts = valStr.Split(';');
                        var hue = Convert.ToDouble(parts[0]);
                        var sat = Convert.ToDouble(parts[1]);
                        var hsvColor = new HslColor(hue, sat, 15d, 255);
                        _app.Post(() =>
                        {
                            this.TitlebarColor = hsvColor.ToColor();
                        });
                    }
                    catch { }
                }, true);
                try
                {
                    await Task.Delay(-1, cancellationToken);
                }
                catch when (cancellationToken.IsCancellationRequested) { }
            });
        }

        private ColorUtil _titlebarColor = new ColorUtil(0x282423);

        public Color TitlebarColor
        {
            get => _titlebarColor.SystemDrawingColor;
            set
            {
                if (value != _titlebarColor.SystemDrawingColor)
                {
                    _titlebarColor = new ColorUtil(value);
                    OnTitlebarColorChanged();
                }
            }
        }

        private void OnTitlebarColorChanged()
        {
            if (this._webViewController is not null)
            {
                this._webViewController.DefaultBackgroundColor = _titlebarColor.SystemDrawingColor;
            }
            if (this.IsHandleCreated)
            {
                InvalidateRect(this.WindowHandle!.Handle, this.Bounds, true);
            }
        }

        public void SetForegroundWindow()
        {
            try
            {
                XarChat.Native.Win32.User32.SetForegroundWindow(this.WindowHandle.Handle);
            }
            catch { }
		}

        protected override WindowClass GetWindowClass()
        {
            if (_windowClass == null )
            {
                var brush = Gdi32.CreateSolidBrush(_titlebarColor.GdiColor);
                var mmName = Kernel32.GetMainModuleName();
                var icon = Shell32.ExtractIcon(mmName, 0);

                _windowClass = WindowClass.Register($"BrowserWindow{_nextClassNum++}", WndProc,
                    classIcon: icon,
                    windowIcon: icon,
                    //styles: XarChat.Native.Win32.Wrapped.ClassStyles.VerticalRedraw | XarChat.Native.Win32.Wrapped.ClassStyles.HorizontalRedraw,
                    backgroundBrush: brush);
            }
            return _windowClass!;
        }

        private bool _pendingWebViewResize = false;
        private bool _alreadySized = false;

        private OversizeBrowserManager? _obm;

        internal int NormalizedPixelsToSystemPixels(int normPx)
        {
            var winDpi = User32.GetDpiForWindow(this.WindowHandle.Handle);
            var scale = (float)winDpi / 96f;
            var result = (float)normPx * scale;
            return (int)Math.Ceiling(result);
        }

        internal const int BORDER_THICKNESS = 7;
        internal const int TOP_BORDER_THICKNESS = 6;

        private bool _destroyed = false;

        protected override nint WndProc(WindowHandle windowHandle, uint msg, nuint wParam, nint lParam)
        {
            switch (msg)
            {
                case User32.StandardWindowMessages.WM_DESTROY:
                case User32.StandardWindowMessages.WM_CLOSE:
                    _destroyed = true;
                    _app.Breakout();
                    //User32.PostQuitMessage(0);
                    break;
                //case User32.StandardWindowMessages.WM_SIZING:
                //    var targetRect = Marshal.PtrToStructure<RECT>(lParam);
                //    if (_webViewController != null)
                //    {
                //        _webViewController.Bounds = targetRect.ToRectangle();
                //    }
                //    break;
                case User32.StandardWindowMessages.WM_NCCALCSIZE:
                    {
                        var bCalcValidRects = wParam;
                        var p = Marshal.PtrToStructure<NCCALCSIZE_PARAMS>(lParam);
                        var bt = IsHandleCreated ? NormalizedPixelsToSystemPixels(BORDER_THICKNESS) : BORDER_THICKNESS;
                        p.rgrc[0].Left += bt;
                        //p.rgrc[0].Top += BORDER_THICKNESS;
                        p.rgrc[0].Right -= bt;
                        p.rgrc[0].Bottom -= bt;
                        Marshal.StructureToPtr(p, lParam, false);
                        return 0;
                    }
                //case User32.StandardWindowMessages.WM_SIZING:
                //    {
                //        if (_obm == null)
                //        {
                //            _obm = new OversizeBrowserManager(_app, this, _webViewController!);
                //        }

                //        var r = Marshal.PtrToStructure<RECT>(lParam);
                //        var width = r.Width - (NormalizedPixelsToSystemPixels(BORDER_THICKNESS) * 2);
                //        var height = r.Height - (NormalizedPixelsToSystemPixels(BORDER_THICKNESS));
                //        _obm.OnWindowResize(width, height);
                //        _webView!.PostWebMessageAsJson($"{{ \"type\": \"clientresize\", \"bounds\": [{width + 1},{height - NormalizedPixelsToSystemPixels(TOP_BORDER_THICKNESS) + 1}] }}");
                //    }
                //    break;
                case User32.StandardWindowMessages.WM_SIZE:
                    if (!_destroyed)
                    {
                        MaybeUpdateWindowState();
                        MaybeUpdateWindowSize();
                    }
                    break;
                case User32.StandardWindowMessages.WM_MOVE:
                    if (_webViewController != null && !_destroyed)
                    {
                        _webViewController.NotifyParentWindowPositionChanged();
                    }
                    break;
                case User32.StandardWindowMessages.WM_MOUSEMOVE:
                    {
                        int y = User32.GET_Y_LPARAM(lParam);
                        int x = User32.GET_X_LPARAM(lParam);
                        if (y < NormalizedPixelsToSystemPixels(BrowserWindow.TOP_BORDER_THICKNESS))
                        {
                            User32.SetCursor(Cursor.SizeNS.HCursor);
                        }
                    }
                    break;
                case User32.StandardWindowMessages.WM_LBUTTONDOWN:
                    {
                        int y = User32.GET_Y_LPARAM(lParam);
                        int x = User32.GET_X_LPARAM(lParam);
                        if (y < NormalizedPixelsToSystemPixels(BrowserWindow.TOP_BORDER_THICKNESS))
                        {
                            User32.PostMessage(windowHandle.Handle, User32.StandardWindowMessages.WM_NCLBUTTONDOWN, (UIntPtr)User32.HT.TOP, 0);
                        }
                        return 0;
                    }
                    break;
                case User32.StandardWindowMessages.WM_SHOWWINDOW:
                    {
                        MaybeUpdateWindowState();
                    }
                    break;
                case User32.StandardWindowMessages.WM_SYSCOMMAND:
                    {
                        var result = User32.DefWindowProc(windowHandle.Handle, msg, wParam, lParam);
                        MaybeUpdateWindowState();
                        MaybeUpdateWindowSize();
                        return result;
                    }
                case User32.StandardWindowMessages.WM_ACTIVATE:
                    {
                        switch ((User32.WA)(int)wParam)
                        {
                            case User32.WA.INACTIVE:
                                OnWindowDeactivated();
                                break;
                            default:
                                OnWindowActivated();
                                break;
                        }
                    }
                    break;
                case User32.StandardWindowMessages.WM_ERASEBKGND:
                    {
                        if (OnEraseBackground(windowHandle, msg, wParam, lParam) > 0)
                        {
                            return 1;
                        }
                    }
                    break;
            }
            return User32.DefWindowProc(windowHandle.Handle, msg, wParam, lParam);
        }

        private int OnEraseBackground(WindowHandle hwnd, uint msg, nuint wParam, nint lParam)
        {
            if (this.Bounds is not null)
            {
                using var hdcg = Graphics.FromHwnd(hwnd.Handle);
                using var bgBrush = new SolidBrush(_titlebarColor.SystemDrawingColor);
                hdcg.FillRectangle(bgBrush, new RectangleF(0, 0, this.Bounds!.Value.Width, this.Bounds.Value.Height));
                return 1;
            }
            else
            {
                return 0;
            }
        }

        private Size _lastNotifiedClientSize = new Size(0, 0);
        private Rectangle _lastNotifiedWindowSize = new Rectangle(0, 0, 0, 0);

        protected virtual void OnWindowDeactivated()
        {
            //_webViewMemManager?.SetLow(TimeSpan.FromSeconds(5));
        }

        protected virtual void OnWindowActivated()
        {
            _webViewMemManager?.SetNormal();
        }

        private void MaybeUpdateWindowSize()
        {
            if (_webView != null && _appReady && !_destroyed)
            {
                var clientRect = this.WindowHandle.ClientRect;
                if (clientRect.Width != _lastNotifiedClientSize.Width || clientRect.Height != _lastNotifiedClientSize.Height)
                {
                    if (_obm == null)
                    {
                        _obm = new OversizeBrowserManager(_app, this, _webViewController!);
                    }

                    var width = clientRect.Width;
                    var height = clientRect.Height;

                    _obm.OnWindowResize(width, height);
                    _webView!.PostWebMessageAsJson($"{{ \"type\": \"clientresize\", \"bounds\": [{width + 1},{height - NormalizedPixelsToSystemPixels(TOP_BORDER_THICKNESS) + 1}] }}");
                    _lastNotifiedClientSize = clientRect.Size;
                }

                var windowRect = this.WindowHandle.WindowRect;
                if (windowRect.Width != _lastNotifiedWindowSize.Width || windowRect.Height != _lastNotifiedWindowSize.Height ||
                    windowRect.Top != _lastNotifiedWindowSize.Top || windowRect.Left != _lastNotifiedWindowSize.Left)
                {
                    var desktopMetrics = GetDesktopMetricsString();
                    _webView!.PostWebMessageAsJson(JsonUtilities.Serialize(new WindowBoundsChangeMessageJson
                    {
                        Type = "windowBoundsChange",
                        DesktopMetrics = desktopMetrics,
                        WindowBounds = new List<int>() { windowRect.X, windowRect.Y, windowRect.Width, windowRect.Height }
                    }, SourceGenerationOptions.Default.WindowBoundsChangeMessageJson));
                    _lastNotifiedWindowSize = windowRect;
                }
            }
        }

        public class WindowBoundsChangeMessageJson
        {
            [JsonPropertyName("type")]
            public string Type { get; set; }

            [JsonPropertyName("desktopMetrics")]
            public string DesktopMetrics { get; set; }

            [JsonPropertyName("windowBounds")]
            public List<int> WindowBounds { get; set; }
        }

        private string GetDesktopMetricsString()
        {
            var screenMetrics = new List<string>();
            foreach (var scr in Screen.AllScreens)
            {
                var b = scr.Bounds;
                var thisScreenMetric = $"{b.X},{b.Y},{b.Width},{b.Height}";
                screenMetrics.Add(thisScreenMetric);
            }
            screenMetrics.Sort();
            var allScreenMetrics = String.Join("|", screenMetrics);
            return allScreenMetrics.ToString();
        }

        private void MaybeUpdateWindowState()
        {
            Task.Run(async () =>
            {
                var sp = await _backend.GetServiceProviderAsync();
                var eventSink = sp.GetRequiredService<IXCHostSession>();
                var ws = this.WindowState;
                switch (ws)
                {
                    case WindowState.Normal:
                        OnWindowRestored();
                        eventSink.WindowRestored();
                        break;
                    case WindowState.Minimized:
                        OnWindowMinimized();
                        eventSink.WindowMinimized();
                        break;
                    case WindowState.Maximized:
                        OnWindowMaximized();
                        eventSink.WindowMaximized();
                        break;
                }
            });
        }

        protected virtual void OnWindowMaximized()
        {
            _webViewMemManager?.SetNormal();
        }

        protected virtual void OnWindowRestored()
        {
            _webViewMemManager?.SetNormal();
        }

        protected virtual void OnWindowMinimized()
        {
            _webViewMemManager?.SetLow();
        }

        protected override (WindowStyles WindowStyles, ExtendedWindowStyles ExtendedWindowStyles) GetWindowStyles()
        {
            var style = WindowStyles.CAPTION | WindowStyles.SYSMENU | WindowStyles.SIZEBOX | WindowStyles.MINIMIZEBOX | WindowStyles.MAXIMIZEBOX;
                //(WindowStyles)(0x00C00000 | 0x00080000 | 0x00040000);
            return (style, 0);
        }

        private CoreWebView2Environment? _cenv = null;
        private CoreWebView2Controller? _webViewController = null;
        private CoreWebView2? _webView = null;

        private WebViewMemoryUsageManager _webViewMemManager = null;

        protected override void OnHandleCreating()
        {
            WriteToStartupLog("BrowserWindow.OnHandleCreating - Getting Backend Port...");
            var portNumber = _backend.GetAssetPortNumber().Result;
            WriteToStartupLog($"BrowserWindow.OnHandleCreating - Got Backend Port ({portNumber})");

            WriteToStartupLog("BrowserWindow.OnHandleCreating - Setting Title...");
            this.Title = $"XarChat";
            WriteToStartupLog("BrowserWindow.OnHandleCreating - Set Title");
        }

        protected override void OnHandleCreated()
        {
            WriteToStartupLog("BrowserWindow.OnHandleCreated - Getting Backend Port...");
            var assetPortNumber = _backend.GetAssetPortNumber().Result;
            WriteToStartupLog("BrowserWindow.OnHandleCreated - Getting Backend WS Port...");
            var wsPortNumber = _backend.GetWSPortNumber().Result;

            base.OnHandleCreated();
            WriteToStartupLog("BrowserWindow.OnHandleCreated - Handle Created");

            _app.Post(async () =>
            {
                var sp = await _backend.GetServiceProviderAsync();
                var appDataFolder = sp.GetRequiredService<IAppDataFolder>().GetAppDataFolder();

                WriteToStartupLog("BrowserWindow.OnHandleCreated - Creating CoreWebView2Environment");
                var cenv = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(
                    browserExecutableFolder: null,
                    userDataFolder: Path.Combine(appDataFolder, "WebView2Data"),
                    new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions(
                        additionalBrowserArguments: "--enable-features=msWebView2EnableDraggableRegions",
                        language: null,
                        targetCompatibleBrowserVersion: null,
                        allowSingleSignOnUsingOSPrimaryAccount: false
                    ));
                _cenv = cenv;

                WriteToStartupLog("BrowserWindow.OnHandleCreated - Creating CoreWebView2Controller");
                _webViewController = await cenv.CreateCoreWebView2ControllerAsync(this.WindowHandle.Handle);
                _webViewController.DefaultBackgroundColor = _titlebarColor.SystemDrawingColor;
                _webView = _webViewController.CoreWebView2;
                _webView.ServerCertificateErrorDetected += _webView_ServerCertificateErrorDetected;
                _webView.ContextMenuRequested += _webView_ContextMenuRequested;
                _webView.Settings.IsGeneralAutofillEnabled = false;
                _webView.Settings.IsPasswordAutosaveEnabled = false;
				_webView.NewWindowRequested += _webView_NewWindowRequested;

                WriteToStartupLog("BrowserWindow.OnHandleCreated - Creating WebViewMemoryUsageManager");
                _webViewMemManager = new WebViewMemoryUsageManager(_backend, _app, _webView);

                var bounds = this.WindowHandle.ClientRect;
                _webViewController.Bounds = new System.Drawing.Rectangle(
                    0, NormalizedPixelsToSystemPixels(TOP_BORDER_THICKNESS), 
                    bounds.Width, bounds.Height - NormalizedPixelsToSystemPixels(TOP_BORDER_THICKNESS));

                var fn = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/index.html");
                WriteToStartupLog("BrowserWindow.OnHandleCreated - Navigating to app");

                var devModeStr = "";
                if (AssemblyVersionInfo.XarChatBranch != "master")
                {
                    devModeStr = "&devmode=true";
                }

                _webView.Navigate($"https://localhost:{assetPortNumber}/app/index.html" +
                    $"?XarHostMode=2{devModeStr}" +
                    $"&ClientVersion={HttpUtility.UrlEncode(AssemblyVersionInfo.XarChatVersion.ToString())}" +
                    $"&ClientPlatform=win-x64" +
                    $"&ClientBranch={HttpUtility.UrlEncode(AssemblyVersionInfo.XarChatBranch)}" +
                    $"&wsport={wsPortNumber}");
                if ((_commandLineOptions.EnableDevTools ?? false) && (_commandLineOptions.OpenDevToolsOnLaunch ?? false))
                {
                    _webView.OpenDevToolsWindow();
                }

                WriteToStartupLog("BrowserWindow.OnHandleCreated - done");
            });
        }

		private void _webView_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
		{
            var deferral = e.GetDeferral();
            var sbw = new SecondaryBrowserWindow(_backend, _cenv!, _app, e.Uri);
            sbw.CoreWebView2Created += (_, _) =>
            {
                e.NewWindow = sbw.CoreWebView2!;
                deferral.Complete();
            };

			sbw.Show();

		}

		private readonly ISet<string> _keepMenuItems = new HashSet<string>()
        {
            "emoji", "undo", "cut", "copy", "paste", "selectAll",
            "saveImageAs", "copyImage", "copyImageLink", "copyLinkLocation",
            "spellcheck"
        };

        private void _webView_ContextMenuRequested(object? sender, CoreWebView2ContextMenuRequestedEventArgs e)
        {
            var prevSeparator = true;
            for (var i = 0; i < e.MenuItems.Count; i++)
            {
                var shouldRemove = false;
                var currentMenuItem = e.MenuItems[i];
                if (currentMenuItem.Kind == CoreWebView2ContextMenuItemKind.Separator)
                {
                    if (prevSeparator)
                    {
                        shouldRemove = true;
                    }
                    prevSeparator = true;
                }
                else
                {
                    prevSeparator = false;

                    if (!_keepMenuItems.Contains(currentMenuItem.Name))
                    {
                        shouldRemove = true;
                    }
                }

                if (shouldRemove)
                {
                    e.MenuItems.RemoveAt(i);
                    i--;
                }
            }
            for (var i = e.MenuItems.Count - 1; i >= 0; i--)
            {
                var currentMenuItem = e.MenuItems[i];
                if (currentMenuItem.Kind == CoreWebView2ContextMenuItemKind.Separator)
                {
                    e.MenuItems.RemoveAt(i);
                }
                else
                {
                    break;
                }
            }
        }

        private void _webView_ServerCertificateErrorDetected(object? sender, CoreWebView2ServerCertificateErrorDetectedEventArgs e)
        {
            e.Action = CoreWebView2ServerCertificateErrorAction.AlwaysAllow;
        }

        public void ShowDevTools()
        {
            if (_webView != null)
            {
                _webView.OpenDevToolsWindow();
            }
        }

        public void StylesheetChanged(string stylesheetPath)
        {
            if (_webView != null)
            {
                stylesheetPath = stylesheetPath
                    .Replace("'", "\\'");
                _webView.ExecuteScriptAsync($"window.__refreshCss('{stylesheetPath}');");
            }
        }

        public void Close()
        {
            User32.PostMessage(this.WindowHandle.Handle, StandardWindowMessages.WM_CLOSE, 0, 0);
            //this.Dispose();
        }

        private bool _appReady = false;

        public void AppReady()
        {
            // TODO:
            _appReady = true;
            _lastNotifiedClientSize.Width = 0;
            _lastNotifiedClientSize.Height = 0;
            MaybeUpdateWindowSize();
        }

        public WindowState WindowState
        {
            get 
            {
                var sw = this.ShowWindowState;
                if (sw == ShowWindowOptions.SHOWMAXIMIZED) return WindowState.Maximized;
                if (sw == ShowWindowOptions.SHOWMINIMIZED) return WindowState.Minimized;
                return WindowState.Normal;
            }
            set
            {
                if (value != this.WindowState)
                {
                    switch (value)
                    {
                        case WindowState.Normal:
                            this.ShowWindowState = ShowWindowOptions.SHOWNORMAL;
                            break;
                        case WindowState.Minimized:
                            this.ShowWindowState = ShowWindowOptions.SHOWMINIMIZED;
                            break;
                        case WindowState.Maximized:
                            this.ShowWindowState = ShowWindowOptions.SHOWMAXIMIZED;
                            break;
                    }
                }
            }
        }

        private ShowWindowOptions _showWindowCommands;

        private ShowWindowOptions ShowWindowState
        {
            get
            {
                if (IsHandleCreated)
                {
                    _showWindowCommands = this.WindowHandle!.ShowOptions;
                }
                return _showWindowCommands;
            }
            set
            {
                _showWindowCommands = value;
                if (IsHandleCreated)
                {
                    this.WindowHandle!.ShowOptions = value;
                }
            }
        }
    }

    public enum WindowState
    {
        Normal,
        Maximized,
        Minimized
    }

    internal class BrowserWindowWindowControl : IWin32WindowControl
    {
        private MessageLoop _application;
        private BrowserWindow? _browserWindow;

        public BrowserWindowWindowControl(MessageLoop application)
        {
            _application = application;
        }

        public BrowserWindow? BrowserWindow
        {
            get => _browserWindow;
            set => _browserWindow = value;
        }

        private void InvokeInApplication(Action action)
        {
            _application.Send(action);
        }

        public IntPtr WindowHandle => _browserWindow?.WindowHandle.Handle ?? IntPtr.Zero;

        public IServiceProvider? ServiceProvider { get; set; }

        public void ApplicationReady() => InvokeInApplication(() => _browserWindow?.AppReady());

        public void Close() => InvokeInApplication(() => _browserWindow?.Close());

        public void Maximize()
        {
            InvokeInApplication(() =>
            {
                if (_browserWindow != null) { _browserWindow.WindowState = WindowState.Maximized; }
            });
        }

        public void Minimize()
        {
            InvokeInApplication(() =>
            {
                if (_browserWindow != null) { _browserWindow.WindowState = WindowState.Minimized; }
            });
        }

        public void Restore()
        {
            InvokeInApplication(() =>
            {
                if (_browserWindow != null) { _browserWindow.WindowState = WindowState.Normal; }
            });
        }

        public void ShowDevTools() => InvokeInApplication(() => _browserWindow?.ShowDevTools());

        public void StylesheetChanged(string stylesheetPath)
        {
            InvokeInApplication(() =>
            {
                if (_browserWindow != null) { _browserWindow.StylesheetChanged(stylesheetPath); }
            });
        }
    }

    public class OversizeBrowserManager
    {
        private readonly MessageLoop _app;
        private readonly BrowserWindow _browserWindow;
        private readonly CoreWebView2Controller _coreWebView2Controller;

        private readonly Timer _tmr;

        const int MIN_OVERSIZE_WIDTH = 1920 * 2;
        const int MIN_OVERSIZE_HEIGHT = 1080 * 2;

        public OversizeBrowserManager(MessageLoop app, BrowserWindow browserWindow, CoreWebView2Controller coreWebView2Controller)
        {
            _app = app;
            _browserWindow = browserWindow;
            _coreWebView2Controller = coreWebView2Controller;
            _tmr = new Timer(app);
        }

        public void OnWindowResize(int windowWidth, int windowHeight)
        {
            if (_coreWebView2Controller != null)
            {
                try
                {
                    var curBounds = _coreWebView2Controller.Bounds;
                    var w = Math.Max(curBounds.Width, Math.Max(MIN_OVERSIZE_WIDTH, windowWidth));
                    var h = Math.Max(curBounds.Height, Math.Max(MIN_OVERSIZE_HEIGHT, windowHeight));

                    if (w != curBounds.Width || h != curBounds.Height)
                    {
                        _coreWebView2Controller.Bounds = new System.Drawing.Rectangle(
                            0, _browserWindow.NormalizedPixelsToSystemPixels(BrowserWindow.TOP_BORDER_THICKNESS),
                            w, h - _browserWindow.NormalizedPixelsToSystemPixels(BrowserWindow.TOP_BORDER_THICKNESS));
                    }

                    _tmr.Change(TimeSpan.FromSeconds(1), () =>
                    {
                        _coreWebView2Controller.Bounds = new System.Drawing.Rectangle(
                            0, _browserWindow.NormalizedPixelsToSystemPixels(BrowserWindow.TOP_BORDER_THICKNESS),
                            windowWidth + 1, windowHeight - _browserWindow.NormalizedPixelsToSystemPixels(BrowserWindow.TOP_BORDER_THICKNESS) + 1);
                    });
                }
                catch { }
            }
        }
    }

    public class Timer
    {
        private readonly MessageLoop _sctx;
        private readonly object _stateLock = new object();
        private CancellationTokenSource? _regCTS;

        public Timer(MessageLoop sctx)
        {
            _sctx = sctx;
        }

        public void Change(TimeSpan tickAfter, Action action)
        {
            CancellationTokenSource myRegCTS = new CancellationTokenSource();

            lock (_stateLock)
            {
                if (_regCTS != null)
                {
                    _regCTS.Cancel();
                    _regCTS = null;
                }

                _regCTS = myRegCTS;
            }

            _sctx.Post(async () =>
            {
                try
                {
                    try
                    {
                        await Task.Delay(tickAfter, _regCTS.Token).ConfigureAwait(true);
                    }
                    catch (OperationCanceledException)
                    {
                        return;
                    }

                    var shouldRun = false;
                    lock (_stateLock)
                    {
                        if (_regCTS == myRegCTS)
                        {
                            _regCTS.Dispose();
                            _regCTS = null;
                            shouldRun = true;
                        }
                    }
                    if (shouldRun)
                    {
                        action();
                    }
                }
                catch { }
            });
        }

        public bool Cancel()
        {
            lock (_stateLock)
            {
                if (_regCTS != null)
                {
                    _regCTS.Cancel();
                    _regCTS = null;
                    return true;
                }
            }
            return false;
        }
    }

    public class WebViewMemoryUsageManager : IDisposable
    {
        private readonly XarChatBackend _backend;
        private readonly MessageLoop _app;
        private readonly CoreWebView2 _coreWebView2;
        private readonly System.Threading.Timer _timer;
        private CoreWebView2MemoryUsageTargetLevel _targetLevel;

        public WebViewMemoryUsageManager(
            XarChatBackend backend,
            MessageLoop app, 
            CoreWebView2 coreWebView2)
        {
            _backend = backend;
            _app = app;
            _coreWebView2 = coreWebView2;

            _timer = new System.Threading.Timer(TimerTick);
        }

        public void Dispose()
        {
            _timer.Dispose();
        }

        public void SetNormal()
        {
            _targetLevel = CoreWebView2MemoryUsageTargetLevel.Normal;
            _timer.Change(TimeSpan.Zero, Timeout.InfiniteTimeSpan);
        }   

        public void SetLow(TimeSpan? timeSpan = null)
        {
            _targetLevel = CoreWebView2MemoryUsageTargetLevel.Low;
            timeSpan = timeSpan ?? TimeSpan.Zero;
            _timer.Change(timeSpan.Value, Timeout.InfiniteTimeSpan);
        }

        private void TimerTick(object? state) 
        {
            _app.Post(() =>
            {
                _coreWebView2.MemoryUsageTargetLevel = _targetLevel;
                if (_targetLevel == CoreWebView2MemoryUsageTargetLevel.Low)
                {
                    try
                    {
                        var sp = _backend.GetServiceProviderAsync().GetAwaiter().GetResult();
                        var mh = sp.GetService<IMemoryHinter>();
                        if (mh is not null)
                        {
                            mh.ReduceWorkingSet();
                        }
                    }
                    catch { }
                }
            });
        }
    }

    [JsonSourceGenerationOptions(WriteIndented = true)]
    [JsonSerializable(typeof(WindowBoundsChangeMessageJson))]
    internal partial class SourceGenerationOptions : JsonSerializerContext
    {
    }

    public struct ColorUtil
    {
        public ColorUtil(System.Drawing.Color color)
        {
            this.GdiColor = ((uint)color.B << 16) | ((uint)color.G << 8) | ((uint)color.R << 0);
        }

        public ColorUtil(uint gdiColor)
        {
            this.GdiColor = gdiColor;
        }

        public uint GdiColor { get; private set; }

        public byte R => (byte)(GdiColor & 0xFF);

        public byte G => (byte)((GdiColor & 0xFF00) >> 8);

        public byte B => (byte)((GdiColor & 0xFF0000) >> 16);

        public System.Drawing.Color SystemDrawingColor
            => System.Drawing.Color.FromArgb(unchecked((int)(
                ((uint)0xFF000000) |
                (((uint)GdiColor & 0xFF0000) >> 16) |
                (((uint)GdiColor & 0x00FF00) >> 0) |
                (((uint)GdiColor & 0x0000FF) << 16)
            )));
    }

}
