using System.Runtime.InteropServices;
using Windows.Win32;
using Windows.Win32.Foundation;
using Windows.Win32.UI.WindowsAndMessaging;
using XarChat.Native.Win32;

namespace XarChat.Native.Win32.Wrapped
{
    public class WindowClass : IDisposable
    {
        private readonly string _className;
        private readonly InstanceHandle? _instanceHandle;
        private readonly ushort _atom;
        private readonly bool _ownsHandle;
        private readonly object? _wndProc;
        private bool _disposed = false;

        public unsafe static WindowClass Register(
            string className,
            WndProc windowProc,
            ClassStyles? styles = 0,
            int classExtraBytes = 0,
            int windowExtraBytes = 0,
            InstanceHandle? instance = null,
            nint? classIcon = null,
            nint? windowIcon = null,
            nint? classCursor = null,
            nint? backgroundBrush = null,
            string? menuResourceName = null)
        {
            WNDPROC wndProc = (hWnd, message, wParam, lParam) =>
            {
                using var wh = new WindowHandle(hWnd, false);
                var result = windowProc(wh, message, wParam, lParam);
                return (LRESULT)result;
            };

            fixed (char* classNamePtr = className)
            fixed (char* menuResourceNamePtr = menuResourceName)
            {
                var zcx = new WNDCLASSEXW()
                {
                    cbSize = (uint)Marshal.SizeOf(typeof(User32.WNDCLASSEX)),
                    style = (WNDCLASS_STYLES)(styles ?? 0),
                    lpfnWndProc = wndProc,
                    cbClsExtra = classExtraBytes,
                    cbWndExtra = windowExtraBytes,
                    hInstance = new HINSTANCE((instance ?? InstanceHandle.CurrentInstance).Handle),
                    hIcon = new HICON(classIcon ?? IntPtr.Zero),
                    hCursor = new HCURSOR(classCursor ?? IntPtr.Zero),
                    hbrBackground = new Windows.Win32.Graphics.Gdi.HBRUSH(backgroundBrush ?? (nint)User32.COLOR.BACKGROUND),
                    lpszMenuName = new PCWSTR(menuResourceNamePtr),
                    lpszClassName = new PCWSTR(classNamePtr),
                    hIconSm = new HICON(windowIcon ?? IntPtr.Zero),
                };

                var zresult = Windows.Win32.PInvoke.RegisterClassEx(zcx);
                if (zresult == 0)
                {
                    var errorCode = Marshal.GetLastWin32Error();
                    throw new ApplicationException($"RegisterClassEx failed: {errorCode}");
                }

                return new WindowClass(zresult, true, className, instance, wndProc);
            }
        }

        public WindowClass(ushort atom, bool ownsHandle, string className, InstanceHandle? instance)
        {
            _className = className;
            _disposed = false;
            _atom = atom;
            _ownsHandle = ownsHandle;
            _wndProc = null;
			_instanceHandle = instance;

		}

        private WindowClass(ushort atom, bool ownsHandle, string className, InstanceHandle? instance, object? wndProc)
        {
            _className = className;
            _disposed = false;
            _atom = atom;
            _ownsHandle = ownsHandle;
            _wndProc = wndProc;
			_instanceHandle = instance;
		}

        ~WindowClass()
        {
            Dispose(false);
        }

        public void Dispose()
        {
            GC.SuppressFinalize(this);
            Dispose(true);
        }

        protected unsafe virtual void Dispose(bool disposing)
        {
            if (!_disposed)
            {
                _disposed = true;
                if (_ownsHandle)
                {
                    var ih = new HINSTANCE((_instanceHandle ?? InstanceHandle.CurrentInstance).Handle);
                    fixed (char* classNamePtr = _className)
                    {
                        Windows.Win32.PInvoke.UnregisterClass(new PCWSTR(classNamePtr), ih);
                    }
                }
            }
            GC.KeepAlive(_wndProc);
        }

        public ushort Atom => _atom;
    }
}
