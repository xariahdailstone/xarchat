using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml.Linq;
using XarChat.Native.Win32.Wrapped;

namespace MinimalWin32Test.UI
{
    public interface IHasWindowHandle
    {
        WindowHandle WindowHandle { get; }
    }
}
