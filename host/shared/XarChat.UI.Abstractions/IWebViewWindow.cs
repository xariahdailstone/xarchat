namespace XarChat.UI.Abstractions
{
    public interface IWebViewWindow : IWindow
    {
        bool DevToolsEnabled { get; set; }
        bool WebSecurityEnabled { get; set; }
        bool IgnoreLocalhostCertificateErrors { get; set; }

        bool CanLoadBeforeShow { get; }
        
        void NavigateTo(Uri uri);

        event EventHandler<EventArgs>? LoadCompleted;
    }
}
