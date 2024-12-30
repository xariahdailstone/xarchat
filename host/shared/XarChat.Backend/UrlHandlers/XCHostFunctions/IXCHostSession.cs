namespace XarChat.Backend.UrlHandlers.XCHostFunctions
{
    public interface IXCHostSession : IDisposable
    {
        void WindowRestored();
        void WindowMinimized();
        void WindowMaximized();

        void CssFileUpdated(string filename);

        void PushStateTo(IXCHostSession session);

        event EventHandler? Disposed;
    }
}
