namespace XarChat.Backend.UrlHandlers.XCHostFunctions
{
    public interface IXCHostSessionProvider
    {
        IXCHostSession XCHostSession { get; }

        void SetXCHostSession(IXCHostSession session);
    }
}
