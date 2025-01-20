using System.Diagnostics.CodeAnalysis;
using System.Text.Json.Nodes;

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

    public interface IXCHostCommandHandler
    {
        Task HandleCommandAsync(XCHostCommandContext context, CancellationToken cancellationToken);
    }

    public record XCHostCommandContext(
        string Command, 
        string Args, 
        Func<string, Task> WriteMessage,
        IDictionary<object, IDisposable> XCHostSessionDisposables)
    {
    }
}
