using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Native.Win32;

namespace XarChat.Native.Win32.Wrapped
{
    public static class Extensions
    {
        public static System.Drawing.Rectangle ToRectangle(this User32.RECT rect)
            => new System.Drawing.Rectangle(rect.X, rect.Y, rect.Width, rect.Height);
    }
}
