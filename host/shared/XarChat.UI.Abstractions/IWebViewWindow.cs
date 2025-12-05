namespace XarChat.UI.Abstractions
{
    public interface IWebViewWindow : IWindow
    {
        bool DevToolsEnabled { get; set; }
        bool WebSecurityEnabled { get; set; }
        bool IgnoreLocalhostCertificateErrors { get; set; }

        void NavigateTo(Uri uri);
    }
}
