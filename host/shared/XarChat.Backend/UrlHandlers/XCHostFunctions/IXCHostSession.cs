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

    public interface IXCHostCommandHandlerRegistration
    {
        string Command { get; }

        Type HandlerType { get; }
    }

    public record XCHostCommandHandlerRegistration(string Command, Type HandlerType) : IXCHostCommandHandlerRegistration;

    public interface IXCHostCommandHandlerFactory
    {
        bool TryGetHandler(IServiceProvider serviceProvider, string cmd,
            [NotNullWhen(true)] out IXCHostCommandHandler? handler);
    }

    internal class XCHostCommandHandlerFactoryImpl : IXCHostCommandHandlerFactory
    {
        private readonly Dictionary<string, IXCHostCommandHandlerRegistration> _registrations
            = new Dictionary<string, IXCHostCommandHandlerRegistration>(StringComparer.OrdinalIgnoreCase);

        public XCHostCommandHandlerFactoryImpl(
            IEnumerable<IXCHostCommandHandlerRegistration> registrations)
        {
            foreach (var reg in registrations)
            {
                _registrations.Add(reg.Command, reg);
            }
        }

        public bool TryGetHandler(
            IServiceProvider serviceProvider, string cmd, 
            [NotNullWhen(true)] out IXCHostCommandHandler? handler)
        {
            if (_registrations.TryGetValue(cmd, out var registration))
            {
                handler = (IXCHostCommandHandler?)serviceProvider.GetService(registration.HandlerType);
                return (handler is not null);
            }
            handler = default;
            return false;
        }
    }

    public interface IXCHostCommandHandler
    {
        bool RunAsynchronously { get; }

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
