namespace XarChat.Backend.UrlHandlers.XCHostFunctions
{
    public class XCHostSessionProvider : IXCHostSessionProvider
    {
        private readonly object _hostSessionLock = new object();

        public IXCHostSession XCHostSession { get; private set; } = new NullXCHostSession();

        public void SetXCHostSession(IXCHostSession session)
        {
            session.Disposed += (o, e) =>
            {
                lock (_hostSessionLock)
                {
                    if (this.XCHostSession == session)
                    {
                        this.SetXCHostSession(new NullXCHostSession());
                    }
                }
            };

            IXCHostSession prevSession;
            lock (_hostSessionLock)
            {
                prevSession = this.XCHostSession;
                this.XCHostSession = session;
                prevSession.PushStateTo(session);
            }
            prevSession.Dispose();
        }

        public void WindowMaximized()
            => XCHostSession?.WindowMaximized();

        public void WindowMinimized()
            => XCHostSession?.WindowMinimized();

        public void WindowRestored()
            => XCHostSession?.WindowRestored();
    }
}
