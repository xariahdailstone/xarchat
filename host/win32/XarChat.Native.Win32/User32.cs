using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using Windows.Win32;
using Windows.Win32.Graphics.Gdi;
using Windows.Win32.UI.WindowsAndMessaging;

namespace XarChat.Native.Win32
{
    public static partial class User32
    {
        internal static class StandardBrushes
        {
            public static readonly HBRUSH SCROLLBAR = new HBRUSH((IntPtr)0);
            public static readonly HBRUSH BACKGROUND = new HBRUSH((IntPtr)1);
            public static readonly HBRUSH DESKTOP = new HBRUSH((IntPtr)1);
            public static readonly HBRUSH ACTIVECAPTION = new HBRUSH((IntPtr)2);
            public static readonly HBRUSH INACTIVECAPTION = new HBRUSH((IntPtr)3);
            public static readonly HBRUSH MENU = new HBRUSH((IntPtr)4);
            public static readonly HBRUSH WINDOW = new HBRUSH((IntPtr)5);
            public static readonly HBRUSH WINDOWFRAME = new HBRUSH((IntPtr)6);
            public static readonly HBRUSH MENUTEXT = new HBRUSH((IntPtr)7);
            public static readonly HBRUSH WINDOWTEXT = new HBRUSH((IntPtr)8);
            public static readonly HBRUSH CAPTIONTEXT = new HBRUSH((IntPtr)9);
            public static readonly HBRUSH ACTIVEBORDER = new HBRUSH((IntPtr)10);
            public static readonly HBRUSH INACTIVEBORDER = new HBRUSH((IntPtr)11);
            public static readonly HBRUSH APPWORKSPACE = new HBRUSH((IntPtr)12);
            public static readonly HBRUSH HIGHLIGHT = new HBRUSH((IntPtr)13);
            public static readonly HBRUSH HIGHLIGHTTEXT = new HBRUSH((IntPtr)14);
            public static readonly HBRUSH BTNFACE = new HBRUSH((IntPtr)15);
            public static readonly HBRUSH THREEDFACE = new HBRUSH((IntPtr)15);
            public static readonly HBRUSH BTNSHADOW = new HBRUSH((IntPtr)16);
            public static readonly HBRUSH THREEDSHADOW = new HBRUSH((IntPtr)16);
            public static readonly HBRUSH GRAYTEXT = new HBRUSH((IntPtr)17);
            public static readonly HBRUSH BTNTEXT = new HBRUSH((IntPtr)18);
            public static readonly HBRUSH INACTIVECAPTIONTEXT = new HBRUSH((IntPtr)19);
            public static readonly HBRUSH BTNHIGHLIGHT = new HBRUSH((IntPtr)20);
            public static readonly HBRUSH TREEDHIGHLIGHT = new HBRUSH((IntPtr)20);
            public static readonly HBRUSH THREEDHILIGHT = new HBRUSH((IntPtr)20);
            public static readonly HBRUSH BTNHILIGHT = new HBRUSH((IntPtr)20);
            public static readonly HBRUSH THREEDDKSHADOW = new HBRUSH((IntPtr)21);
            public static readonly HBRUSH THREEDLIGHT = new HBRUSH((IntPtr)22);
            public static readonly HBRUSH INFOTEXT = new HBRUSH((IntPtr)23);
            public static readonly HBRUSH INFOBK = new HBRUSH((IntPtr)24);
        }

        //[DllImport("user32.dll")]
        //[return: MarshalAs(UnmanagedType.Bool)]
        //public static extern bool IsIconic(IntPtr hWnd);

        //[DllImport("user32.dll", SetLastError = true)]
        //[return: MarshalAs(UnmanagedType.Bool)]
        //public static extern bool GetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT lpwndpl);

        //[DllImport("user32.dll", SetLastError = true)]
        //public static extern uint RegisterWindowMessage(string lpString);

        public struct BeginPaintData
        {
            internal BeginPaintData(nint hWnd, PAINTSTRUCT paintStruct)
            {
                this.HWnd = hWnd;
                this.PaintStruct = paintStruct;
            }

            internal nint HWnd { get; }

            internal PAINTSTRUCT PaintStruct { get; }

            public nint HDC => PaintStruct.hdc;

            public bool ShouldPaintBackground => PaintStruct.fErase;

            public Rectangle RequestedPaintRect
                => new Rectangle(PaintStruct.rcPaint.X, PaintStruct.rcPaint.Y, PaintStruct.rcPaint.Width, PaintStruct.rcPaint.Height);

		}

        public static void MessageBox(nint hWnd, string text, string caption)
        {
            PInvoke.MessageBox(
                new Windows.Win32.Foundation.HWND(hWnd),
                text, caption, MESSAGEBOX_STYLE.MB_OK | MESSAGEBOX_STYLE.MB_ICONERROR);
		}

        public static void InvalidateRect(nint hWnd, Rectangle? rectangle, bool erase)
        {
            PInvoke.InvalidateRect(new Windows.Win32.Foundation.HWND(hWnd),
                rectangle is not null 
                    ? new Windows.Win32.Foundation.RECT(rectangle.Value.Left, rectangle.Value.Top, rectangle.Value.Right, rectangle.Value.Bottom)
                    : null,
                erase);
        }

        public static Point GetCursorPos()
        {
            PInvoke.GetCursorPos(out var pt);
            return new Point(pt.X, pt.Y);
        }

        public static BeginPaintData BeginPaint(nint hWnd)
        {
            var hdc = PInvoke.BeginPaint(new Windows.Win32.Foundation.HWND(hWnd), out var paintStruct);
            return new BeginPaintData(hWnd, paintStruct);
        }

        public static void EndPaint(BeginPaintData bpd)
        {
            PInvoke.EndPaint(new Windows.Win32.Foundation.HWND(bpd.HWnd), bpd.PaintStruct);
        }

        public static bool PostMessage(nint hWnd, uint msg, nuint wParam, nint lParam)
        {
            var result = PInvoke.PostMessage(new Windows.Win32.Foundation.HWND(hWnd), msg, 
                new Windows.Win32.Foundation.WPARAM(wParam),
                new Windows.Win32.Foundation.LPARAM(lParam));
            return result;
        }

        //[return: MarshalAs(UnmanagedType.Bool)]
        //[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        //public static extern bool PostMessage(nint hWnd, uint Msg, nint wParam, nint lParam);

        //[DllImport("user32.dll")]
        //public static extern int GetMessage(out MSG lpMsg, nint hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

        //[DllImport("user32.dll")]
        //public static extern bool TranslateMessage([In] ref MSG lpMsg);

        //[DllImport("user32.dll")]
        //public static extern nint DispatchMessage([In] ref MSG lpMsg);

        //[DllImport("user32.dll")]
        //public static extern void PostQuitMessage(int nExitCode);

        public static void PostQuitMessage(int nExitCode)
        {
            PInvoke.PostQuitMessage(nExitCode);
        }

        //[DllImport("user32.dll")]
        //public static extern nint DefWindowProc(nint hWnd, uint msg, nint wParam, nint lParam);

        public static nint DefWindowProc(nint hWnd, uint msg, nuint wParam, nint lParam)
        {
            var result = PInvoke.DefWindowProc(new Windows.Win32.Foundation.HWND(hWnd), msg, wParam, lParam);
            return result;
        }

        public static int GET_X_LPARAM(nint lParam) => (int) ((((IntPtr)lParam).ToInt64() & 0x0000ffffL) >> 0);
        public static int GET_Y_LPARAM(nint lParam) => (int) ((((IntPtr)lParam).ToInt64() & 0xffff0000L) >> 16);

        //[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        //public static extern nint CreateWindowEx(
        //    uint dwExStyle,
        //    [MarshalAs(UnmanagedType.LPWStr)]
        //    string lpClassName,
        //    [MarshalAs(UnmanagedType.LPWStr)]
        //    string lpWindowName,
        //    uint dwStyle,
        //    int x,
        //    int y,
        //    int nWidth,
        //    int nHeight,
        //    nint hWndParent,
        //    nint hMenu,
        //    nint hInstance,
        //    nint lpParam);

        //[DllImport("user32.dll", SetLastError = true, EntryPoint = "CreateWindowExW")]
        //public static extern nint CreateWindowExW(
        //       int dwExStyle,
        //       ushort lpClassName, // <---
        //       [MarshalAs(UnmanagedType.LPWStr)]
        //       string lpWindowName,
        //       uint dwStyle,
        //       int x,
        //       int y,
        //       int nWidth,
        //       int nHeight,
        //       nint hWndParent,
        //       nint hMenu,
        //       nint hInstance,
        //       nint lpParam);

        //[DllImport("user32.dll")]
        //public static extern bool DestroyWindow(nint hWnd);

        //[DllImport("user32.dll", SetLastError = true)]
        //[return: MarshalAs(UnmanagedType.U2)]
        //public static extern ushort RegisterClassEx([In] ref WNDCLASSEX lpwcx);

        //[DllImport("user32.dll")]
        //public static extern bool ShowWindow(nint hWnd, SW nCmdShow);

        //[DllImport("user32.dll")]
        //public static extern bool GetClientRect(nint hWnd, out RECT lpRect);

        //[DllImport("user32.dll")]
        //public static extern bool GetWindowRect(nint hWnd, out RECT lpRect);

        //[DllImport("user32.dll")]
        //public static extern bool MoveWindow(nint hWnd, int x, int y, int nWidth, int nHeight, bool bRepaint);

        [Flags]
        public enum SW : int
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

        public static class CW
        {
            public const int USEDEFAULT = (unchecked((int)0x80000000));
        }

        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr")]
        public static extern nint GetWindowLongPtr(nint hWnd, WindowLongFlags nIndex);

        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr")]
        public static extern nint SetWindowLongPtr(nint hWnd, WindowLongFlags nIndex, nint dwNewLong);

        //[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        //public static extern nint LoadCursor(nint hInstance, [MarshalAs(UnmanagedType.LPWStr)] string lpCursorName);

        //[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        //public static extern nint LoadCursor(nint hInstance, int lpCursorName);

        //[DllImport("user32.dll", SetLastError = true)]
        //public static extern nint SetCursor(nint hCursor);

        public static void SetCursor(nint hCursor)
        {
            PInvoke.SetCursor(new Windows.Win32.UI.WindowsAndMessaging.HCURSOR(hCursor));
        }

        //[DllImport("user32.dll")]
        //public static extern uint GetDpiForWindow(nint hWnd);

        public static uint GetDpiForWindow(nint hWnd)
        {
            return PInvoke.GetDpiForWindow(new Windows.Win32.Foundation.HWND(hWnd));
        }

        public static nint FindWindow(string? className, string? windowName)
        {
            var hwnd = PInvoke.FindWindow(className, windowName);
            return hwnd.Value;
        }

        public static bool SetForegroundWindow(nint hwnd)
        {
            return PInvoke.SetForegroundWindow(new Windows.Win32.Foundation.HWND(hwnd));
        }

        public enum IDC : int
        {
            ARROW = 32512,
            IBEAM = 32513,
            WAIT = 32514,
            CROSS = 32515,
            UPARROW = 32516,
            SIZE = 32640,
            ICON = 32641,
            SIZENWSE = 32642,
            SIZENESW = 32643,
            SIZEWE = 32644,
            SIZENS = 32645,
            SIZEALL = 32646,
            NO = 32648,
            HAND = 32649,
            APPSTARTING = 32650,
            HELP = 32651
        }

        public enum WindowLongFlags : int
        {
            GWL_EXSTYLE = -20,
            GWLP_HINSTANCE = -6,
            GWLP_HWNDPARENT = -8,
            GWL_ID = -12,
            GWL_STYLE = -16,
            GWL_USERDATA = -21,
            GWL_WNDPROC = -4,
            DWLP_USER = 0x8,
            DWLP_MSGRESULT = 0x0,
            DWLP_DLGPROC = 0x4
        }

        public delegate nint WndProc(nint hWnd, uint msg, nuint wParam, nint lParam);

        public enum HT : int
        {
            CAPTION = 0x2,
            TOP = 0xC
        }

        public static class StandardWindowMessages
        {
            public const uint WM_CREATE = 0x1;
            public const uint WM_DESTROY = 0x2;
            public const uint WM_MOVE = 0x3;
            public const uint WM_SIZE = 0x5;
            public const uint WM_ACTIVATE = 0x6;
            public const uint WM_CLOSE = 0x10;
            public const uint WM_PAINT = 0x000F;
			public const uint WM_SHOWWINDOW = 0x0018;
            public const uint WM_NCLBUTTONDOWN = 0xA1;
            public const uint WM_SIZING = 0x0214;
            public const uint WM_NCCALCSIZE = 0x0083;
            public const uint WM_SYSCOMMAND = 0x0112;
            public const uint WM_MOUSEMOVE = 0x0200;
            public const uint WM_MOUSELEAVE = 0x02A3;
            public const uint WM_LBUTTONDOWN = 0x0201;
            public const uint WM_LBUTTONUP = 0x0202;
        }

        public enum WA : int
        {
            INACTIVE = 0x0,
            ACTIVE = 0x1,
            CLICKACTIVE = 0x2
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct NCCALCSIZE_PARAMS
        {
            [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)]
            public RECT[] rgrc;
            public WINDOWPOS lppos;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct WINDOWPOS
        {
            public nint hwnd;
            public nint hwndInsertAfter;
            public int x;
            public int y;
            public int cx;
            public int cy;
            public uint flags;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        public struct WNDCLASSEX
        {
            /// <summary>
            /// The size, in bytes, of this structure. Set this member to sizeof(WNDCLASSEX). Be sure to set this member before calling the GetClassInfoEx function.
            /// </summary>
            [MarshalAs(UnmanagedType.U4)]
            public int cbSize;

            /// <summary>
            /// The class style(s). This member can be any combination of the Class Styles.
            /// </summary>
            [MarshalAs(UnmanagedType.U4)]
            public ClassStyles style;

            /// <summary>
            /// A pointer to the window procedure. You must use the CallWindowProc function to call the window procedure. For more information, see WindowProc.
            /// </summary>
            public WndProc lpfnWndProc; // not WndProc

            /// <summary>
            /// The number of extra bytes to allocate following the window-class structure. The system initializes the bytes to zero.
            /// </summary>
            public int cbClsExtra;

            /// <summary>
            /// The number of extra bytes to allocate following the window instance. The system initializes the bytes to zero.
            /// If an application uses WNDCLASSEX to register a dialog box created by using the CLASS directive in the resource file, 
            /// it must set this member to DLGWINDOWEXTRA.
            /// </summary>
            public int cbWndExtra;

            /// <summary>
            /// A handle to the instance that contains the window procedure for the class.
            /// </summary>
            public nint hInstance;

            /// <summary>
            /// A handle to the class icon. This member must be a handle to an icon resource. If this member is NULL, the system provides a default icon.
            /// </summary>
            public nint hIcon;

            /// <summary>
            /// A handle to the class cursor. This member must be a handle to a cursor resource. If this member is NULL, 
            /// an application must explicitly set the cursor shape whenever the mouse moves into the application's window.
            /// </summary>
            public nint hCursor;

            /// <summary>
            /// A handle to the class background brush.
            /// See https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-wndclassexa
            /// </summary>
            public nint hbrBackground;

            /// <summary>
            /// Pointer to a null-terminated character string that specifies the resource name of the class menu, as the name appears 
            /// in the resource file. If you use an integer to identify the menu, use the MAKEINTRESOURCE macro. If this member is NULL, 
            /// windows belonging to this class have no default menu.
            /// </summary>
            [MarshalAs(UnmanagedType.LPWStr)]
            public string? lpszMenuName;

            /// <summary>
            /// A pointer to a null-terminated string or is an atom. If this parameter is an atom, it must be a class atom created by a 
            /// previous call to the RegisterClass or RegisterClassEx function. The atom must be in the low-order word of lpszClassName; 
            /// the high-order word must be zero.
            ///
            /// If lpszClassName is a string, it specifies the window class name. The class name can be any name registered with 
            /// RegisterClass or RegisterClassEx, or any of the predefined control-class names.
            ///
            /// The maximum length for lpszClassName is 256. If lpszClassName is greater than the maximum length, the RegisterClassEx 
            /// function will fail.
            /// </summary>
            [MarshalAs(UnmanagedType.LPWStr)]
            public string lpszClassName;

            /// <summary>
            /// A handle to a small icon that is associated with the window class. If this member is NULL, the system searches the 
            /// icon resource specified by the hIcon member for an icon of the appropriate size to use as the small icon.
            /// </summary>
            public nint hIconSm;

            //Use this function to make a new one with cbSize already filled in.
            //For example:
            //var WndClss = WNDCLASSEX.Build()
            public static WNDCLASSEX Build()
            {
                var nw = new WNDCLASSEX();
                nw.cbSize = Marshal.SizeOf(typeof(WNDCLASSEX));
                return nw;
            }
        }

        public enum COLOR : int
        {
            SCROLLBAR = 0,
            BACKGROUND = 1,
            DESKTOP = 1,
            ACTIVECAPTION = 2,
            INACTIVECAPTION = 3,
            MENU = 4,
            WINDOW = 5,
            WINDOWFRAME = 6,
            MENUTEXT = 7,
            WINDOWTEXT = 8,
            CAPTIONTEXT = 9,
            ACTIVEBORDER = 10,
            INACTIVEBORDER = 11,
            APPWORKSPACE = 12,
            HIGHLIGHT = 13,
            HIGHLIGHTTEXT = 14,
            BTNFACE = 15,
            THREEDFACE = 15,
            BTNSHADOW = 16,
            THREEDSHADOW = 16,
            GRAYTEXT = 17,
            BTNTEXT = 18,
            INACTIVECAPTIONTEXT = 19,
            BTNHIGHLIGHT = 20,
            TREEDHIGHLIGHT = 20,
            THREEDHILIGHT = 20,
            BTNHILIGHT = 20,
            THREEDDKSHADOW = 21,
            THREEDLIGHT = 22,
            INFOTEXT = 23,
            INFOBK = 24
        }

        [Flags]
        public enum ClassStyles : uint
        {
            /// <summary>Aligns the window's client area on a byte boundary (in the x direction). This style affects the width of the window and its horizontal placement on the display.</summary>
            ByteAlignClient = 0x1000,

            /// <summary>Aligns the window on a byte boundary (in the x direction). This style affects the width of the window and its horizontal placement on the display.</summary>
            ByteAlignWindow = 0x2000,

            /// <summary>
            /// Allocates one device context to be shared by all windows in the class.
            /// Because window classes are process specific, it is possible for multiple threads of an application to create a window of the same class.
            /// It is also possible for the threads to attempt to use the device context simultaneously. When this happens, the system allows only one thread to successfully finish its drawing operation.
            /// </summary>
            ClassDC = 0x40,

            /// <summary>Sends a double-click message to the window procedure when the user double-clicks the mouse while the cursor is within a window belonging to the class.</summary>
            DoubleClicks = 0x8,

            /// <summary>
            /// Enables the drop shadow effect on a window. The effect is turned on and off through SPI_SETDROPSHADOW.
            /// Typically, this is enabled for small, short-lived windows such as menus to emphasize their Z order relationship to other windows.
            /// </summary>
            DropShadow = 0x20000,

            /// <summary>Indicates that the window class is an application global class. For more information, see the "Application Global Classes" section of About Window Classes.</summary>
            GlobalClass = 0x4000,

            /// <summary>Redraws the entire window if a movement or size adjustment changes the width of the client area.</summary>
            HorizontalRedraw = 0x2,

            /// <summary>Disables Close on the window menu.</summary>
            NoClose = 0x200,

            /// <summary>Allocates a unique device context for each window in the class.</summary>
            OwnDC = 0x20,

            /// <summary>
            /// Sets the clipping rectangle of the child window to that of the parent window so that the child can draw on the parent.
            /// A window with the CS_PARENTDC style bit receives a regular device context from the system's cache of device contexts.
            /// It does not give the child the parent's device context or device context settings. Specifying CS_PARENTDC enhances an application's performance.
            /// </summary>
            ParentDC = 0x80,

            /// <summary>
            /// Saves, as a bitmap, the portion of the screen image obscured by a window of this class.
            /// When the window is removed, the system uses the saved bitmap to restore the screen image, including other windows that were obscured.
            /// Therefore, the system does not send WM_PAINT messages to windows that were obscured if the memory used by the bitmap has not been discarded and if other screen actions have not invalidated the stored image.
            /// This style is useful for small windows (for example, menus or dialog boxes) that are displayed briefly and then removed before other screen activity takes place.
            /// This style increases the time required to display the window, because the system must first allocate memory to store the bitmap.
            /// </summary>
            SaveBits = 0x800,

            /// <summary>Redraws the entire window if a movement or size adjustment changes the height of the client area.</summary>
            VerticalRedraw = 0x1
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct MSG
        {
            public nint hwnd;
            public uint message;
            public nuint wParam;
            public nint lParam;
            public int time;
            public POINT pt;
            public int lPrivate;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;

            public POINT(int x, int y)
            {
                X = x;
                Y = y;
            }

            public override string ToString()
            {
                return $"X: {X}, Y: {Y}";
            }
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left, Top, Right, Bottom;

            public RECT(int left, int top, int right, int bottom)
            {
                Left = left;
                Top = top;
                Right = right;
                Bottom = bottom;
            }

            public RECT(Rectangle r) : this(r.Left, r.Top, r.Right, r.Bottom) { }

            public int X
            {
                get { return Left; }
                set { Right -= Left - value; Left = value; }
            }

            public int Y
            {
                get { return Top; }
                set { Bottom -= Top - value; Top = value; }
            }

            public int Height
            {
                get { return Bottom - Top; }
                set { Bottom = value + Top; }
            }

            public int Width
            {
                get { return Right - Left; }
                set { Right = value + Left; }
            }

            public Point Location
            {
                get { return new Point(Left, Top); }
                set { X = value.X; Y = value.Y; }
            }

            public Size Size
            {
                get { return new Size(Width, Height); }
                set { Width = value.Width; Height = value.Height; }
            }

            public static implicit operator Rectangle(RECT r)
            {
                return new Rectangle(r.Left, r.Top, r.Width, r.Height);
            }

            public static implicit operator RECT(Rectangle r)
            {
                return new RECT(r);
            }

            public static bool operator ==(RECT r1, RECT r2)
            {
                return r1.Equals(r2);
            }

            public static bool operator !=(RECT r1, RECT r2)
            {
                return !r1.Equals(r2);
            }

            public bool Equals(RECT r)
            {
                return r.Left == Left && r.Top == Top && r.Right == Right && r.Bottom == Bottom;
            }

            public override bool Equals(object? obj)
            {
                if (obj is RECT)
                    return Equals((RECT)obj);
                else if (obj is Rectangle)
                    return Equals(new RECT((Rectangle)obj));
                return false;
            }

            public override int GetHashCode()
            {
                return ((Rectangle)this).GetHashCode();
            }

            public override string ToString()
            {
                return string.Format(System.Globalization.CultureInfo.CurrentCulture, "{{Left={0},Top={1},Right={2},Bottom={3}}}", Left, Top, Right, Bottom);
            }
        }

        /// <summary>
        /// Contains information about the placement of a window on the screen.
        /// </summary>
        [Serializable]
        [StructLayout(LayoutKind.Sequential)]
        public struct WINDOWPLACEMENT
        {
            /// <summary>
            /// The length of the structure, in bytes. Before calling the GetWindowPlacement or SetWindowPlacement functions, set this member to sizeof(WINDOWPLACEMENT).
            /// <para>
            /// GetWindowPlacement and SetWindowPlacement fail if this member is not set correctly.
            /// </para>
            /// </summary>
            public int Length;

            /// <summary>
            /// Specifies flags that control the position of the minimized window and the method by which the window is restored.
            /// </summary>
            public int Flags;

            /// <summary>
            /// The current show state of the window.
            /// </summary>
            public SW ShowCmd;

            /// <summary>
            /// The coordinates of the window's upper-left corner when the window is minimized.
            /// </summary>
            public POINT MinPosition;

            /// <summary>
            /// The coordinates of the window's upper-left corner when the window is maximized.
            /// </summary>
            public POINT MaxPosition;

            /// <summary>
            /// The window's coordinates when the window is in the restored position.
            /// </summary>
            public RECT NormalPosition;

            /// <summary>
            /// Gets the default (empty) value.
            /// </summary>
            public static WINDOWPLACEMENT Default
            {
                get
                {
                    WINDOWPLACEMENT result = new WINDOWPLACEMENT();
                    result.Length = Marshal.SizeOf(result);
                    return result;
                }
            }
        }

    }
}
