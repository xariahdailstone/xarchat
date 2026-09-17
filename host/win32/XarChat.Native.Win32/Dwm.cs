using System.Runtime.InteropServices;
using Windows.Wdk;
using Windows.Win32;
using Windows.Win32.Foundation;
using PInvoke = Windows.Win32.PInvoke;

namespace XarChat.Native.Win32
{
    public static class Dwm
    {
        private const uint E_INVALIDARG = 0x80070057;

        public unsafe static bool IsCaptionColorSupported(nint hwnd)
        {
            //var hwndObj = new HWND(hwnd);
            //var colorRef = new COLORREF();

            //var res = PInvoke.DwmGetWindowAttribute(
            //    hwndObj,
            //    Windows.Win32.Graphics.Dwm.DWMWINDOWATTRIBUTE.DWMWA_CAPTION_COLOR,
            //    &colorRef,
            //    (uint)Marshal.SizeOf<COLORREF>());

            //if ((uint)res.Value == E_INVALIDARG)
            //{
            //    return false;
            //}
            //else
            //{
            //    return true;
            //}

            return Environment.OSVersion.Version.Major >= 10 && Environment.OSVersion.Version.Build >= 22000;
        }

        public static bool SetCaptionBackgroundColor(nint hwnd, byte r, byte g, byte b)
        {
            var colorRefValue = r | (g << 8) | (b << 16);
            var colorRef = new COLORREF((uint)colorRefValue);
            var colorRefSpan = MemoryMarshal.CreateReadOnlySpan(ref colorRef, 1);
            var colorRefSpanBytes = MemoryMarshal.AsBytes(colorRefSpan);
            try
            {
                PInvoke.DwmSetWindowAttribute(
                    new HWND(hwnd),
                    Windows.Win32.Graphics.Dwm.DWMWINDOWATTRIBUTE.DWMWA_CAPTION_COLOR,
                    colorRefSpanBytes);
                return true;
            }
            catch
            {
                return false;
            }
        }

        public static bool SetCaptionForegroundColor(nint hwnd, byte r, byte g, byte b)
        {
            var colorRefValue = r | (g << 8) | (b << 16);
            var colorRef = new COLORREF((uint)colorRefValue);
            var colorRefSpan = MemoryMarshal.CreateReadOnlySpan(ref colorRef, 1);
            var colorRefSpanBytes = MemoryMarshal.AsBytes(colorRefSpan);
            try
            {
                PInvoke.DwmSetWindowAttribute(
                    new HWND(hwnd),
                    Windows.Win32.Graphics.Dwm.DWMWINDOWATTRIBUTE.DWMWA_TEXT_COLOR,
                    colorRefSpanBytes);
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
