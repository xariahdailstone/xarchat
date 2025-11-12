using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Runtime.ConstrainedExecution;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using Windows.Win32;
using Windows.Win32.Foundation;
using Windows.Win32.UI.WindowsAndMessaging;
using XarChat.Native.Win32;

namespace XarChat.Native.Win32.Wrapped
{
    public delegate nint WndProc(WindowHandle windowHandle, uint message, nuint wParam, nint lParam);

    [Flags]
    public enum WindowStyles : uint
    {
        BORDER = 0x00800000,
        CAPTION = 0x00C00000,
        CHILD = 0x40000000,
        CHILDWINDOW = 0x40000000,
        CLIPCHILDREN = 0x02000000,
        CLIPSIBLINGS = 0x04000000,
        DISABLED = 0x08000000,
        DLGFRAME = 0x00400000,
        GROUP = 0x00020000,
        HSCROLL = 0x00100000,
        ICONIC = 0x20000000,
        MAXIMIZE = 0x01000000,
        MAXIMIZEBOX = 0x00010000,
        MINIMIZE = 0x20000000,
        MINIMIZEBOX = 0x00020000,
        OVERLAPPED = 0x0,
        OVERLAPPEDWINDOW = OVERLAPPED | CAPTION | SYSMENU | THICKFRAME | MINIMIZEBOX | MAXIMIZEBOX,
        POPUP = 0x80000000,
        POPUPWINDOW = POPUP | BORDER | SYSMENU,
        SIZEBOX = 0x00040000,
        SYSMENU = 0x00080000,
        TABSTOP = 0x00010000,
        THICKFRAME = 0x00040000,
        TILED = 0x0,
        TILEDWINDOW = OVERLAPPEDWINDOW,
        VISIBLE = 0x10000000,
        VSCROLL = 0x00200000
    }

    [Flags]
    public enum ExtendedWindowStyles : int
    {
    }

    public class WindowHandle : IDisposable
    {
        public unsafe static WindowHandle Create(WindowClass windowClass, string title,
            Rectangle? bounds,
            WindowStyles windowStyles = 0,
            ExtendedWindowStyles extendedWindowStyles = 0,
            WindowHandle? parentWindow = null,
            InstanceHandle? instance = null,
            IntPtr? hMenu = null,
            IntPtr? lpParam = null)
        {
            var windowClassAtomPtr = ((IntPtr)windowClass.Atom).ToPointer();
            var winClassAtom = new PCWSTR((char*)windowClassAtomPtr);

            fixed (char* windTitle = title)
            {
                var xWinStylesEx = (WINDOW_EX_STYLE)extendedWindowStyles;
                var xWinStyles = (WINDOW_STYLE)windowStyles;
                var xhwnd = PInvoke.CreateWindowEx(xWinStylesEx, winClassAtom,
                    new PCWSTR(windTitle), xWinStyles,
                    bounds?.X ?? User32.CW.USEDEFAULT,
                    bounds?.Y ?? User32.CW.USEDEFAULT,
                    bounds?.Width ?? User32.CW.USEDEFAULT,
                    bounds?.Height ?? User32.CW.USEDEFAULT,
                    new HWND(parentWindow?.Handle ?? IntPtr.Zero),
                    new HMENU(hMenu ?? IntPtr.Zero),
                    new HINSTANCE(instance?.Handle ?? PInvoke.GetModuleHandle((string?)null).DangerousGetHandle()),
                    lpParam != null ? lpParam.Value.ToPointer() : IntPtr.Zero.ToPointer()
                );
                if (new IntPtr(xhwnd.Value) == 0)
                {
                    var errorCode = Marshal.GetLastWin32Error();
                    throw new ApplicationException(errorCode.ToString());
                }

                var xresult = new WindowHandle(xhwnd, true, windowClass: windowClass);
                return xresult;
            }
        }

        private readonly Windows.Win32.Foundation.HWND _hwnd;
        private readonly bool _ownsHandle;
        private readonly WindowClass? _windowClass;
        private bool _disposed = false;

        public WindowHandle(nint hWnd, bool ownsHandle,
            WindowClass? windowClass = null)
        {
            _hwnd = new Windows.Win32.Foundation.HWND(hWnd);
            _ownsHandle = ownsHandle;
            _windowClass = windowClass;
        }

        internal WindowHandle(HWND hWnd, bool ownsHandle,
            WindowClass? windowClass = null)
        {
            _hwnd = hWnd;
            _ownsHandle = ownsHandle;
            _windowClass = windowClass;
        }


        ~WindowHandle()
        {
            Dispose(false);
        }

        public WindowClass? WindowClass => _windowClass;

        public void Dispose()
        {
            GC.SuppressFinalize(this);
            Dispose(true);
        }

        protected virtual void Dispose(bool disposing)
        { 
            if (!_disposed)
            {
                _disposed = true;
                if (_ownsHandle)
                {
                    PInvoke.DestroyWindow(_hwnd);
                }
            }
        }

        public unsafe nint Handle => new IntPtr(_hwnd.Value);

        private nint UserPointer
        {
            get => User32.GetWindowLongPtr(_hwnd, User32.WindowLongFlags.GWL_USERDATA);
            set => User32.SetWindowLongPtr(_hwnd, User32.WindowLongFlags.GWL_USERDATA, value);
        }

        public object? UserData
        {
            get
            {
                try
                {
                    var up = this.UserPointer;
                    if (up != IntPtr.Zero)
                    {
                        var gch = GCHandle.FromIntPtr(up);
                        return gch.Target;
                    }
                }
                catch
                {
                }
                return null;
            }
            set
            {
                try
                {
                    var up = this.UserPointer;
                    if (up != IntPtr.Zero)
                    {
                        var gch = GCHandle.FromIntPtr(up);
                        gch.Free();
                    }
                }
                catch
                {
                }

                if (value != null)
                {
                    var gch = GCHandle.Alloc(value, GCHandleType.Normal);
                    var ptr = GCHandle.ToIntPtr(gch);
                    this.UserPointer = ptr;
                }
                else
                {
                    this.UserPointer = IntPtr.Zero;
                }
            }
        }

        public ShowWindowOptions ShowOptions
        {
            get
            {
                var wp = new WINDOWPLACEMENT()
                {
                    length = (uint)Marshal.SizeOf<WINDOWPLACEMENT>()
                };
                Windows.Win32.PInvoke.GetWindowPlacement(_hwnd, ref wp);
                //return wp.showCmd;

                //User32.WINDOWPLACEMENT wp = new User32.WINDOWPLACEMENT() { Length = Marshal.SizeOf<User32.WINDOWPLACEMENT>() };
                //User32.GetWindowPlacement(_hwnd, ref wp);
                return (ShowWindowOptions)((int)wp.showCmd);
            }
            set
            {
                PInvoke.ShowWindow(_hwnd, (SHOW_WINDOW_CMD)value);
                //User32.ShowWindow(this._hwnd, (User32.SW)value);
            }
        }

        public Rectangle ClientRect
        {
            get
            {
                RECT bounds;
                PInvoke.GetClientRect(_hwnd, out bounds);
                return new Rectangle(bounds.X, bounds.Y, bounds.Width, bounds.Height);
            }
        }

        public Rectangle WindowRect
        {
            get
            {
                RECT r;
                PInvoke.GetWindowRect(_hwnd, out r);
                return new Rectangle(r.X, r.Y, r.Width, r.Height);
            }
            set
            {
                PInvoke.MoveWindow(_hwnd, value.X, value.Y, value.Width, value.Height, false);
            }
        }

        internal static HWND ToHWND(WindowHandle wh) => wh._hwnd;
    }

    [Flags]
    public enum ShowWindowOptions : int
    {
        HIDE = 0,
        MAXIMIZE = 3,
        MINIMIZE = 6,
        RESTORE = 9,
        SHOW = 5,
        SHOWMAXIMIZED = 3,
        SHOWMINIMIZED = 2,
        SHOWMINNOACTIVE = 7,
        SHOWNA = 8,
        SHOWNOACTIVATE = 4,
        SHOWNORMAL = 1
    }

    public class InstanceHandle
    {
        public static InstanceHandle CurrentInstance => new InstanceHandle(PInvoke.GetModuleHandle((string?)null).DangerousGetHandle(), false);

        private readonly nint _handle;
        private readonly bool _ownsHandle;

        public InstanceHandle(nint handle, bool ownsHandle)
        {
            _handle = handle;
            _ownsHandle = ownsHandle;
        }

        public nint Handle => _handle;
    }

    //internal struct Point
    //{
    //    public Point(int x, int y)
    //    {
    //        this.X = x;
    //        this.Y = y;
    //    }

    //    public int X { get; }
    //    public int Y { get; }
    //}

    //internal struct Size
    //{
    //    public Size(int width, int height)
    //    {
    //        this.Width = width;
    //        this.Height = height;
    //    }

    //    public int Width { get; }
    //    public int Height { get; }
    //}

    //internal struct Rect
    //{
    //    public Rect(int x, int y, int width, int height)
    //        : this(new Point(x, y), new Size(width, height))
    //    {
    //    }

    //    public Rect(Point point, Size size)
    //    {
    //        this.Point = point;
    //        this.Size = size;
    //    }

    //    public Point Point { get; }

    //    public Size Size { get; }

    //    public int X => this.Point.X;

    //    public int Y => this.Point.Y;

    //    public int Width => this.Size.Width;

    //    public int Height => this.Size.Height;
    //}

    //internal class WindowHandle : IDisposable
    //{
    //    private readonly nint _hWnd;

    //    public WindowHandle(
    //        ExtendedWindowStyles extendedWindowStyles,
    //        WindowClass windowClass,
    //        string name,
    //        WindowStyles windowStyles,
    //        Rect bounds,
    //        WindowHandle? parent,
    //        IntPtr? menu,
    //        IntPtr? instance,
    //        IntPtr? lpParam)
    //    {
    //        var hWnd = Win32Native.User32.CreateWindowExW((int)extendedWindowStyles, windowClass.Handle,
    //            name, (uint)windowStyles, bounds.X, bounds.Y, bounds.Width, bounds.Height, parent?.Handle ?? IntPtr.Zero,
    //            menu ?? IntPtr.Zero, instance ?? IntPtr.Zero, lpParam ?? IntPtr.Zero);
    //        if (hWnd == (nint)0)
    //        {
    //            var errorCode = Marshal.GetLastWin32Error();
    //            throw new ApplicationException(errorCode.ToString());
    //        }
    //        this._hWnd = hWnd;
    //    }

    //    public void Dispose()
    //    {
    //        Win32Native.User32.DestroyWindow(_hWnd);
    //    }

    //    public IntPtr Handle => _hWnd;
    //}
}
