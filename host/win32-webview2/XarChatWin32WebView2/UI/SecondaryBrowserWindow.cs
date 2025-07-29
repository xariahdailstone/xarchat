using Microsoft.Extensions.DependencyInjection;
using Microsoft.Web.WebView2.Core;
using MinimalWin32Test.UI;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend;
using XarChat.Backend.Common;
using XarChat.Backend.Features.CommandableWindows;
using XarChat.Native.Win32;
using XarChat.Native.Win32.Wrapped;
using static MinimalWin32Test.UI.BrowserWindow;
using static XarChat.Native.Win32.User32;

namespace XarChatWin32WebView2.UI
{
	public class SecondaryBrowserWindow : WindowBase, ICommandableWindow
	{
		private readonly XarChatBackend _backend;
		private readonly ICommandableWindowRegistry _cwr;
		private readonly CoreWebView2Environment _coreWebView2Environment;
		private readonly MessageLoop _messageLoop;
		private readonly string _initialUrl;

		private static int _nextClassNum = 0;
		private WindowClass? _windowClass;

		private CoreWebView2Controller? _webViewController = null;
		private CoreWebView2? _webView = null;

		private int _myWindowId;

		public SecondaryBrowserWindow(
			XarChatBackend backend,
			CoreWebView2Environment coreWebView2Environment,
            MessageLoop messageLoop,
			string initialUrl)
        {
			_backend = backend;

			_cwr = backend.GetServiceProviderAsync().Result.GetRequiredService<ICommandableWindowRegistry>();
			_myWindowId = _cwr.GetNewWindowId();
			_cwr.RegisterWindow(_myWindowId, this);

			_coreWebView2Environment = coreWebView2Environment;
			_messageLoop = messageLoop;
			_initialUrl = initialUrl;

			this.Title = "XarChat";

			var cursorPoint = User32.GetCursorPos();
			var bounds = new Rectangle(100, 100, 700, 250);
			foreach (var scr in Screen.AllScreens)
			{
				if (scr.Bounds.Contains(cursorPoint))
				{
					var scrCenterX = scr.Bounds.Left + (scr.Bounds.Width / 2);
					var scrCenterY = scr.Bounds.Top + (scr.Bounds.Height / 2);

					bounds = new Rectangle(scrCenterX - (bounds.Width / 2), scrCenterY - (bounds.Height / 2),
						bounds.Width, bounds.Height);

					break;
				}
			}
			this.Bounds = bounds;
		}

		private bool _showNativeTitlebar = true;
		public bool ShowNativeTitlebar
		{
			get => _showNativeTitlebar;
			set
			{
				if (value != _showNativeTitlebar)
				{
					_showNativeTitlebar = value;
				}
			}
		}

		public void Close()
		{
			User32.PostMessage(this.WindowHandle.Handle, StandardWindowMessages.WM_CLOSE, 0, 0);
			//this.Dispose();
		}

		protected override void Dispose(bool disposing)
		{
			base.Dispose(disposing);
			_cwr.UnregisterWindow(_myWindowId);
		}

		protected override WindowClass GetWindowClass()
		{
			if (_windowClass == null)
			{
				var brush = Gdi32.CreateSolidBrush(InitializationWindow.TITLEBAR_COLOR);
				var mmName = Kernel32.GetMainModuleName();
				var icon = Shell32.ExtractIcon(mmName, 0);

				_windowClass = WindowClass.Register($"SecondaryBrowserWindow{_nextClassNum++}", WndProc,
					classIcon: icon,
					windowIcon: icon,
					//styles: XarChat.Native.Win32.Wrapped.ClassStyles.VerticalRedraw | XarChat.Native.Win32.Wrapped.ClassStyles.HorizontalRedraw,
					backgroundBrush: brush);
			}
			return _windowClass!;
		}

		protected override (WindowStyles WindowStyles, ExtendedWindowStyles ExtendedWindowStyles) GetWindowStyles()
		{
			var style = WindowStyles.CAPTION | WindowStyles.SYSMENU | WindowStyles.SIZEBOX | WindowStyles.MINIMIZEBOX | WindowStyles.MAXIMIZEBOX;
			//(WindowStyles)(0x00C00000 | 0x00080000 | 0x00040000);
			return (style, 0);
		}

		protected override nint WndProc(WindowHandle windowHandle, uint msg, nuint wParam, nint lParam)
		{
			switch (msg)
			{
				case User32.StandardWindowMessages.WM_DESTROY:
				case User32.StandardWindowMessages.WM_CLOSE:
					this.Dispose();
					break;
				case User32.StandardWindowMessages.WM_NCCALCSIZE:
					if (!_showNativeTitlebar)
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
					break;
				case User32.StandardWindowMessages.WM_SIZE:
					MaybeUpdateWindowSize();
					break;
				case User32.StandardWindowMessages.WM_MOVE:
					if (_webViewController != null)
					{
						_webViewController.NotifyParentWindowPositionChanged();
					}
					break;
			}
			return base.WndProc(windowHandle, msg, wParam, lParam);
		}

		internal int NormalizedPixelsToSystemPixels(int normPx)
		{
			var winDpi = User32.GetDpiForWindow(this.WindowHandle.Handle);
			var scale = (float)winDpi / 96f;
			var result = (float)normPx * scale;
			return (int)Math.Ceiling(result);
		}

		private void MaybeUpdateWindowSize()
		{
			if (_webViewController != null)
			{
				var bounds = this.WindowHandle.ClientRect;
				if (!_showNativeTitlebar)
				{
					_webViewController.Bounds = new System.Drawing.Rectangle(
						0, NormalizedPixelsToSystemPixels(TOP_BORDER_THICKNESS),
						bounds.Width, bounds.Height - NormalizedPixelsToSystemPixels(TOP_BORDER_THICKNESS));
				}
				else
				{
					_webViewController.Bounds = new System.Drawing.Rectangle(
						0, 0,
						bounds.Width, bounds.Height);
				}
			}
		}

		internal const int BORDER_THICKNESS = 7;
		internal const int TOP_BORDER_THICKNESS = 6;

		protected override async void OnHandleCreated()
		{
			base.OnHandleCreated();

			var assetPortNumber = await _backend.GetAssetPortNumber();

			_webViewController = await _coreWebView2Environment.CreateCoreWebView2ControllerAsync(this.WindowHandle.Handle);
			_webViewController.DefaultBackgroundColor = System.Drawing.Color.FromArgb(
					(InitializationWindow.TITLEBAR_COLOR & 0x0000ff),
					(InitializationWindow.TITLEBAR_COLOR & 0x00ff00) >> 8,
					(InitializationWindow.TITLEBAR_COLOR & 0xff0000) >> 16);

			_webView = _webViewController.CoreWebView2;

			var effectiveScript = HostAccessScript
				.Replace("@@SVCURL@@", $"https://localhost:{assetPortNumber}")
				.Replace("@@WINDOWID@@", _myWindowId.ToString());
			await _webView.AddScriptToExecuteOnDocumentCreatedAsync(effectiveScript);
			this.CoreWebView2Created?.Invoke(this, EventArgs.Empty);

			MaybeUpdateWindowSize();

			_webView.Navigate(_initialUrl);
		}

		public async Task<JsonObject> ExecuteCommandAsync(JsonObject commandObject, CancellationToken cancellationToken)
		{
			var res = await this.InvokeAsync(async () =>
			{
				if (commandObject.TryGetPropertyValue("cmd", out var propNode))
				{
					var cmd = propNode!.ToString().ToLowerInvariant();
					switch (cmd)
					{
						case "rawnavigate":
							{
								if (commandObject.TryGetPropertyValue("url", out var urlNode))
								{
									var url = urlNode!.ToString();
									this.RawNavigate(url);
									return new JsonObject();
								}
							}
							break;
						case "opentaskmanager":
							{
								this.OpenTaskManager();
								return new JsonObject();
							}
					}
				}
				return new JsonObject();
			});

			return res;
		}

		internal void Invoke(Action action)
		{
			_messageLoop.Send(action);
		}

		internal Task<T> InvokeAsync<T>(Func<T> action)
		{
			var tcs = new TaskCompletionSource<T>();
			_messageLoop.Post(() =>
			{
				try
				{
					var result = action();
					tcs.TrySetResult(result);
				}
				catch (Exception ex)
				{
					tcs.TrySetException(ex);
				}
			});
			return tcs.Task;
		}

		internal Task<T> InvokeAsync<T>(Func<Task<T>> action)
		{
			var tcs = new TaskCompletionSource<T>();
			_messageLoop.Post(async () =>
			{
				try
				{
					var result = await action();
					tcs.TrySetResult(result);
				}
				catch (Exception ex)
				{
					tcs.TrySetException(ex);
				}
			});
			return tcs.Task;
		}

		private void RawNavigate(string url)
		{
			_webView?.Navigate(url);
		}

		private void OpenTaskManager()
		{
			_webView?.OpenTaskManagerWindow();
		}


        public event EventHandler? CoreWebView2Created;

		public CoreWebView2? CoreWebView2 => _webView;

		private const string HostAccessScript = @"
(function () {
	const SVCURL = '@@SVCURL@@';
	const WINDOWID = @@WINDOWID@@;
	const CMDURL = `${SVCURL}/api/windowcommand/${WINDOWID}`;

	class XCHost {
		rawNavigate(url) {
			fetch(CMDURL, {
				method: 'POST',
				body: JSON.stringify({
					cmd: 'rawNavigate',
					url: url
				})
			});
		}

		openTaskManager(url) {
			fetch(CMDURL, {
				method: 'POST',
				body: JSON.stringify({
					cmd: 'openTaskManager',
					url: url
				})
			});
		}
	}

	window._xchost = new XCHost();
})();
";
	}
}
