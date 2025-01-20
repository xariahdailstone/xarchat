namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.IdleMonitor
{
    internal static class IdleMonitorRegistrationUtils
    {
        internal static object GetMonitorKey(string name) => $"IdleMonitorRegistration-{name.ToLowerInvariant()}";
    }
}
