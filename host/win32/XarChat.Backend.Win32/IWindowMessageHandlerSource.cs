using XarChat.Native.Win32.Wrapped;

namespace XarChat.Backend.Win32
{
    public interface IWindowMessageHandlerSource
    {
        IntPtr WindowHandle { get; }

        IDisposable AddWindowMessageHandler(PossibleWindowMessageHandlerFunc handler);
    }
}