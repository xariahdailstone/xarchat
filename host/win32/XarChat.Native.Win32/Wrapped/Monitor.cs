using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using Windows.Win32;
using Windows.Win32.Graphics.Gdi;

namespace XarChat.Native.Win32.Wrapped
{
    public class Screen
    {
        public static IEnumerable<Screen> AllScreens => EnumerateAllMonitors();

        private static IEnumerable<Screen> EnumerateAllMonitors()
        {
            List<Screen> result = new List<Screen>();

            User32.EnumDisplayMonitors(IntPtr.Zero, null, (hMonitor, hdc, rect, lParam) => 
            {
                result.Add(new Screen(hMonitor));
                return true;
            });

            return result;
        }

        private readonly IntPtr _hMonitor;

        public Screen(IntPtr hMonitor)
        {
            _hMonitor = hMonitor;
        }

        public Rectangle Bounds
        {
            get
            {
                MONITORINFO minfo = new MONITORINFO() { cbSize = (uint)Marshal.SizeOf<MONITORINFO>() };
                if (PInvoke.GetMonitorInfo(new HMONITOR(_hMonitor), ref minfo))
                {
                    return new Rectangle(
                        minfo.rcMonitor.X,
                        minfo.rcMonitor.Y,
                        minfo.rcMonitor.Width,
                        minfo.rcMonitor.Height);
                }
                else
                {
                    return Rectangle.Empty;
                }
            }
        }
    }
}
