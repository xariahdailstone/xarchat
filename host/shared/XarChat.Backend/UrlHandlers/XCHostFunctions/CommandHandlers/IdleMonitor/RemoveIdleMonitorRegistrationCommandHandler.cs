using XarChat.Backend.Features.IdleDetection;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.IdleMonitor
{
    internal class RemoveIdleMonitorRegistrationCommandHandler : XCHostCommandHandlerBase<RemoveIdleMonitorRegistrationArgs>
    {
        private readonly IIdleDetectionManager _idleDetectionManager;

        public RemoveIdleMonitorRegistrationCommandHandler(IIdleDetectionManager idleDetectionManager)
        {
            _idleDetectionManager = idleDetectionManager;
        }

        protected override Task HandleCommandAsync(RemoveIdleMonitorRegistrationArgs args, CancellationToken cancellationToken)
        {
            if (CommandContext.XCHostSessionDisposables.TryGetValue(args.MonitorName, out var registration))
            {
                registration.Dispose();
                CommandContext.XCHostSessionDisposables.Remove(args.MonitorName);
            }
            return Task.CompletedTask;
        }
    }
}
