namespace XarChat.Backend.UrlHandlers.XCHostFunctions
{
    public abstract class XCHostSessionBase : IXCHostSession
    {
        private bool _disposed = false;

        public event EventHandler? Disposed;

        public virtual void Dispose()
        {
            if (!_disposed)
            {
                _disposed = true;
                try { this.Disposed?.Invoke(this, EventArgs.Empty); }
                catch { }
            }
        }

        public void PushStateTo(IXCHostSession session)
        {
            switch (_hostWindowState)
            {
                case HostWindowState.Restored:
                    session.WindowRestored();
                    break;
                case HostWindowState.Minimized:
                    session.WindowMinimized();
                    break;
                case HostWindowState.Maximized:
                    session.WindowMaximized();
                    break;
            }
        }

        private enum HostWindowState
        {
            Restored,
            Maximized,
            Minimized
        }

        private HostWindowState _hostWindowState;

        public virtual void WindowMaximized()
        {
            _hostWindowState = HostWindowState.Maximized;
        }

        public virtual void WindowMinimized()
        {
            _hostWindowState = HostWindowState.Minimized;
        }

        public virtual void WindowRestored()
        {
            _hostWindowState = HostWindowState.Restored;
        }
    }
}
