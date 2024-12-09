using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Runtime.InteropServices;
using Windows.Win32;
using Windows.Win32.Graphics.Gdi;
using System.Drawing;

namespace XarChat.Native.Win32
{
    public static partial class User32
    {
        /// <summary>
        /// 
        /// </summary>
        /// <param name="hMonitor"></param>
        /// <param name="hDc"></param>
        /// <param name="rect"></param>
        /// <param name="lParam"></param>
        /// <returns>True to continue enumeration; false to stop enumeration.</returns>
        public delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hDc, Rectangle? rect, nint lParam);

        public static unsafe void EnumDisplayMonitors(IntPtr hdc, Rectangle? clippingRect, MonitorEnumProc enumProc, nint lParam = 0)
        {
            var monitorEnumFunc = (HMONITOR hm, HDC hdc, Windows.Win32.Foundation.RECT* rect, Windows.Win32.Foundation.LPARAM x) =>
            {
                Rectangle? r = (rect != (void*)0) ?
                    new Rectangle(rect->left, rect->top, rect->Width, rect->Height) :
                    null;

                var result = enumProc(hm.Value, hdc.Value, r, lParam);
                return new Windows.Win32.Foundation.BOOL(result);
            };

            PInvoke.EnumDisplayMonitors(
                new HDC(hdc),
                clippingRect != null ? new Windows.Win32.Foundation.RECT(clippingRect.Value) : null,
                new MONITORENUMPROC(monitorEnumFunc),
                new Windows.Win32.Foundation.LPARAM(lParam));

            GC.KeepAlive(monitorEnumFunc);
        }
	}
}
