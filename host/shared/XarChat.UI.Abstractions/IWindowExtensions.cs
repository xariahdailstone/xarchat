namespace XarChat.UI.Abstractions
{
    public static class IWindowExtensions
    {
        extension (IWindow webViewWindow)
        {
            public bool NeedInvoke => webViewWindow.Application.NeedInvoke;
        }

        public static async Task InvokeAsync(this IWindow webViewWindow, Action action)
        {
            await webViewWindow.Application.InvokeAsync(action);
        }
    }
}
