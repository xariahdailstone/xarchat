using XarChat.Native.Win32;
using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using XarChat.Native.Win32.Wrapped;

using static XarChat.Native.Win32.Kernel32;
using static XarChat.Native.Win32.User32;

namespace MinimalWin32Test.UI
{
    //internal sealed class WindowClass : IDisposable
    //{
    //    private readonly User32.WndProc _wndProcFunc;
    //    private readonly UInt16 _classAtom;
    //    private bool _disposed = false;

    //    public WindowClass(string className, User32.WndProc wndProcFunc)
    //    {
    //        _wndProcFunc = wndProcFunc;

    //        var hInstance = GetModuleHandle(null);

    //        var wcx = new WNDCLASSEX()
    //        {
    //            cbSize = Marshal.SizeOf(typeof(WNDCLASSEX)),
    //            style = 0,
    //            lpfnWndProc = wndProcFunc, // TODO:
    //            cbClsExtra = 0,
    //            hInstance = hInstance, // TODO:
    //            hIcon = IntPtr.Zero, // TODO:
    //            hCursor = IntPtr.Zero, // TODO:
    //            hbrBackground = (IntPtr)COLOR.WINDOW, // TODO:
    //            lpszMenuName = null,
    //            lpszClassName = className,
    //            hIconSm = IntPtr.Zero, // TODO:
    //        };
    //        var result = RegisterClassEx(ref wcx);
    //        if (result == 0)
    //        {
    //            throw new ApplicationException("RegisterClassEx failed");
    //        }
    //        else
    //        {
    //            _classAtom = result;
    //        }
    //    }

    //    public void Dispose()
    //    {
    //        if (!_disposed)
    //        {
    //            _disposed = true;
    //            // TODO: destroy class
    //        }
    //    }

    //    public UInt16 ClassAtom => _classAtom;
    //}

    //internal class Win32Window : IDisposable
    //{
    //    private static object _windowClassesLock = new object();
    //    private static IImmutableDictionary<string, WindowClass> _windowClasses = ImmutableDictionary<string, WindowClass>.Empty;
    //    private static object _activeWindowsLock = new object();
    //    private static IImmutableDictionary<nint, Win32Window> _activeWindows = ImmutableDictionary<nint, Win32Window>.Empty;

    //    public static T CreateWindow<T>(string className, string name, uint style, int x, int y, int width, int height,
    //        nint hwndParent, nint menu, nint instance, nint lpParam)
    //        where T : Win32Window, new()
    //    {
    //        var win = new T();

    //        var hwnd = User32.CreateWindowExW(0, win.WindowClass.Atom, name, style, x, y, width, height, hwndParent, menu, instance, lpParam);
    //        if (hwnd == (nint)0)
    //        {
    //            var errorCode = Marshal.GetLastWin32Error();
    //            throw new ApplicationException(errorCode.ToString());
    //        }

    //        return win;
    //    }

    //    private static nint WndProcThunk<T>(WindowHandle windowHandle, uint msg, nint wParam, nint lParam)
    //        where T : Win32Window
    //    {
    //        var instance = (T)(_activeWindows[windowHandle.Handle]!);
    //        var result = instance.WndProc(windowHandle, msg, wParam, lParam);
    //        return result;
    //    }

    //    private bool _disposed = false;
    //    private WindowClass _windowClass;
    //    private nint? _hwnd = null;

    //    public Win32Window() 
    //    {
    //        _windowClass = WindowClass.Register(Guid.NewGuid().ToString(), WndProc);
    //    }

    //    ~Win32Window()
    //    {
    //        Dispose(false);
    //    }

    //    public WindowClass WindowClass => _windowClass;

    //    public nint? Handle => _hwnd;

    //    public void Dispose()
    //    {
    //        GC.SuppressFinalize(this);
    //        Dispose(true);
    //    }

    //    protected virtual void Dispose(bool disposing)
    //    {
    //        if (!_disposed)
    //        {
    //            _disposed = true;
    //            if (_hwnd != null)
    //            {
    //                DestroyWindow(_hwnd.Value);

    //                lock (_activeWindowsLock)
    //                {
    //                    _activeWindows = _activeWindows.Remove(_hwnd.Value);
    //                }
    //            }

    //            _windowClass?.Dispose();
                
    //        }
    //    }

    //    protected virtual nint WndProc(WindowHandle hWnd, uint msg, nint wParam, nint lParam)
    //    {
    //        switch (msg)
    //        {
    //            case StandardWindowMessages.WM_CREATE:
    //                _hwnd = hWnd.Handle;
    //                lock (_activeWindowsLock)
    //                {
    //                    _activeWindows = _activeWindows.Add(hWnd.Handle, this);
    //                }
    //                break;
    //            case StandardWindowMessages.WM_CLOSE:
    //                PostQuitMessage(0);
    //                break;
    //            default:
    //                return DefWindowProc(hWnd.Handle, msg, wParam, lParam);
    //        }

    //        return 0;
    //    }

    //    public virtual void Show()
    //    {
    //        if (_hwnd == null)
    //        {
    //            throw new InvalidOperationException("Cannot show, handle not yet created");
    //        }

    //        ShowWindow(_hwnd.Value, SW.SHOW);
    //    }
    //}
}
