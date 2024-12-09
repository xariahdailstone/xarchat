using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using Windows.Devices.Usb;
using Windows.UI.StartScreen;
using XarChat.Native.Win32;
using XarChat.Native.Win32.Wrapped;
using static XarChat.Native.Win32.User32;

namespace MinimalWin32Test.UI
{
	internal class InitializationWindow : WindowBase
	{
		public const int TITLEBAR_COLOR = 0x282423;
		public const int TITLEBAR_COLOR_ARGB = unchecked((int)(
			((uint)0xFF000000) |
			(((uint)TITLEBAR_COLOR & 0xFF0000) >> 16) |
			(((uint)TITLEBAR_COLOR & 0x00FF00) >> 0) |
			(((uint)TITLEBAR_COLOR & 0x0000FF) << 16)
			));

		private static int _nextClassNum = 0;
		private WindowClass? _windowClass;

		private readonly MessageLoop _messageLoop;


		public InitializationWindow(
			MessageLoop messageLoop)
        {
			_messageLoop = messageLoop;

			this.Title = "XarChat Initial Setup";

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

		protected override void Dispose(bool disposing)
		{
			base.Dispose(disposing);
			foreach (var ctl in _controls)
			{
				if (ctl is IDisposable dctl)
				{
					dctl.Dispose();
				}
			}
		}

		public void Close()
		{
			User32.PostMessage(this.WindowHandle.Handle, StandardWindowMessages.WM_CLOSE, 0, 0);
			//this.Dispose();
		}

		protected override WindowClass GetWindowClass()
		{
			if (_windowClass == null)
			{
				var brush = Gdi32.CreateSolidBrush(TITLEBAR_COLOR);
				var mmName = Kernel32.GetMainModuleName();
				var icon = Shell32.ExtractIcon(mmName, 0);

				_windowClass = WindowClass.Register($"InitializationWindow{_nextClassNum++}", WndProc,
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

		internal int NormalizedPixelsToSystemPixels(int normPx)
		{
			var winDpi = User32.GetDpiForWindow(this.WindowHandle.Handle);
			var scale = (float)winDpi / 96f;
			var result = (float)normPx * scale;
			return (int)Math.Ceiling(result);
		}

		internal const int BORDER_THICKNESS = 7;
		internal const int TOP_BORDER_THICKNESS = 6;

		protected override nint WndProc(WindowHandle windowHandle, uint msg, nuint wParam, nint lParam)
		{
			switch (msg)
			{
				case User32.StandardWindowMessages.WM_DESTROY:
				case User32.StandardWindowMessages.WM_CLOSE:
					_messageLoop.Breakout();
					this.Dispose();
					break;
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
				case User32.StandardWindowMessages.WM_PAINT:
					{
						this.OnPaint();
						return 0;
					}
			}
			return base.WndProc(windowHandle, msg, wParam, lParam);
		}

		private Label? _statusLabel = null;
		private string _status = "";

		protected override void OnHandleCreated()
		{
			base.OnHandleCreated();

			this._controls.Add(new Label(this)
			{
				Bounds = new Rectangle(0, 50, 700, 10),
				Text = "XarChat",
				Font = new Font("Tahoma", 18.0f),
				Color = Color.White
			});
			this._controls.Add(new Label(this)
			{
				Bounds = new Rectangle(0, 115, 700, 10),
				Text = "Please wait while XarChat does some first time setup",
				Font = new Font("Tahoma", 9.0f),
				Color = Color.White
			});

			var lblMessage = new Label(this)
			{
				Bounds = new Rectangle(0, this.Bounds!.Value.Height - 70, 700, 10),
				Text = _status,
				Font = new Font("Tahoma", 9.0f),
				Color = Color.FromArgb(170, 170, 170)
			};
			this._controls.Add(lblMessage);
			_statusLabel = lblMessage;

			this._controls.Add(new StatusBar(this)
			{
				Bounds = new Rectangle(0, this.Bounds!.Value.Height - 20, 700, 20)
			});
		}

		private void OnPaint()
		{
			var paintData = User32.BeginPaint(this.WindowHandle.Handle);

			{
				using var hdcg = Graphics.FromHdc(paintData.HDC);

				using var buffer = new Bitmap(this.WindowHandle.ClientRect.Width, this.WindowHandle.ClientRect.Height);
				using var g = Graphics.FromImage(buffer);
				//g.TranslateTransform(0 - paintData.RequestedPaintRect.X, 0 - paintData.RequestedPaintRect.Y);

				{
					//using var g = Graphics.FromHdc(paintData.HDC);
					g.SetClip(paintData.RequestedPaintRect);
					using var bgBrush = new SolidBrush(Color.FromArgb(TITLEBAR_COLOR_ARGB));

					g.FillRectangle(bgBrush, paintData.RequestedPaintRect);

					foreach (var control in _controls)
					{
						var klip = g.ClipBounds;
						g.SetClip(
								Rectangle.Intersect(
									paintData.RequestedPaintRect,
									new Rectangle(control.Bounds.X, control.Bounds.Y, control.Bounds.Width, control.Bounds.Height)
								)
							);
						g.TranslateTransform(control.Bounds.X, control.Bounds.Y);
						control.Paint(g);
						g.ResetTransform();
						g.SetClip(paintData.RequestedPaintRect);
					}
				}

				hdcg.SetClip(new Rectangle(paintData.RequestedPaintRect.X, paintData.RequestedPaintRect.Y,
						paintData.RequestedPaintRect.Width, paintData.RequestedPaintRect.Height));
				hdcg.DrawImage(buffer, paintData.RequestedPaintRect.Location);

				//using var titleFont = new Font("Tahoma", 18.0f);
				//using var titleBrush = new SolidBrush(Color.White);

				//var titleStr = "XarChat";
				//var titleSize = g.MeasureString(titleStr, titleFont);
				//g.DrawString(titleStr, titleFont, titleBrush,
				//	new PointF((this.WindowHandle.ClientRect.Width / 2f) - (titleSize.Width / 2), 50));

				//using var subtitleFont = new Font("Tahoma", 9.0f);
				//using var subtitleBrush = new SolidBrush(Color.White);

				//var subtitleStr = "Please wait while XarChat does some first time setup";
				//var subtitleSize = g.MeasureString(subtitleStr, subtitleFont);
				//g.DrawString(subtitleStr, subtitleFont, subtitleBrush,
				//	new PointF((this.WindowHandle.ClientRect.Width / 2f) - (subtitleSize.Width / 2), 
				//	50 + titleSize.Height + 10));
			}

			User32.EndPaint(paintData);
		}

		private List<PaintedControl> _controls = new List<PaintedControl>();

		internal void Invalidate(Rectangle rect)
		{
			User32.InvalidateRect(this.WindowHandle.Handle, null, false);
		}

		internal void Invoke(Action action)
		{
			_messageLoop.Send(action);
		}

		public void SetStatus(string status)
		{
			this.Invoke(() =>
			{
				if (status != _status)
				{
					_status = status;
					if (_statusLabel is not null)
					{
						_statusLabel.Text = status;
					}
				}
			});
		}
	}

	internal abstract class PaintedControl
	{
        protected PaintedControl(InitializationWindow window)
        {
			this.Window = window;
        }

		public InitializationWindow Window { get; }

		private Rectangle _bounds = new Rectangle(10, 10, 100, 100);

        public Rectangle Bounds 
		{
			get => _bounds;
			set
			{
				if (value != _bounds)
				{
					this.Invalidate();
					_bounds = value;
					this.Invalidate();
				}
			}
		}

		public abstract void Paint(Graphics g);

		protected void Invalidate()
		{
			Window.Invalidate(this.Bounds);
		}
	}

	internal class Label : PaintedControl
	{
		public static readonly Font DefaultFont = new Font("Tahoma", 9.0f);

		public Label(InitializationWindow window)
			: base(window)
        {
			this._text = "Label";
			this._font = DefaultFont;
			RecalculateSize();
        }

		private string _text;
		private Font _font;

        public string Text
		{
			get => _text;
			set
			{
				if (value != _text)
				{
					_text = value;
					RecalculateSize();
				}
			}
		}

		public Font Font
		{
			get => _font;
			set
			{
				if (value != _font)
				{
					_font = value;
					RecalculateSize();
				}
			}
		}

		private void RecalculateSize()
		{
			using var g = Graphics.FromHwnd(Window.WindowHandle.Handle);
			var strSize = g.MeasureString(Text, Font, this.Bounds.Width);
			this.Bounds = new Rectangle(this.Bounds.Location,
				new Size(this.Bounds.Width, (int)Math.Round(strSize.Height)));
			_calculatedSize = strSize;
			Invalidate();
		}

		private SizeF _calculatedSize;

		public Color Color { get; set; } = Color.White;

		public override void Paint(Graphics g)
		{
			using var brush = new SolidBrush(this.Color);
			g.DrawString(this.Text, this.Font, brush,
				new PointF((this.Bounds.Width / 2.0f) - (_calculatedSize.Width / 2.0f), 0.0f));
		}
	}

	internal class StatusBar : PaintedControl, IDisposable
	{
		private System.Threading.Timer _timer;

		private bool _disposed = false;

        public StatusBar(InitializationWindow window)
			: base(window)
        {
			_timer = new System.Threading.Timer((_) =>
			{
				if (!_disposed)
				{
					window.Invoke(() =>
					{
						if (!_disposed)
						{
							_gradX = (_gradX + 15) % (this.Bounds.Width * 2);
							this.Invalidate();
							_timer!.Change(16, Timeout.Infinite);
						}
					});
				}
			});
			_timer.Change(16, Timeout.Infinite);
		}

		public void Dispose()
		{
			_timer.Dispose();
		}

		private int _gradX = 0;

		public override void Paint(Graphics g)
		{
			var color = Color.FromArgb(200, 0, 200); // Color.FromArgb(new Random().Next());

			using var brush = new LinearGradientBrush(
				new Point(0 - _gradX, 0),
				new Point(0 - _gradX + this.Bounds.Width, 0),
				Color.Transparent,
				color)
			{
				WrapMode = WrapMode.TileFlipXY
			};
			//using var brush = new SolidBrush(Color.Purple);

			//g.FillRectangle(brush, new Rectangle(_gradX - this.Bounds.Width, 0, this.Bounds.Width, this.Bounds.Height));
			//g.FillRectangle(brush, new Rectangle(_gradX, 0, this.Bounds.Width, this.Bounds.Height));

			g.FillRectangle(brush, new Rectangle(0, 0, this.Bounds.Width, this.Bounds.Height));

		}
	}
}
