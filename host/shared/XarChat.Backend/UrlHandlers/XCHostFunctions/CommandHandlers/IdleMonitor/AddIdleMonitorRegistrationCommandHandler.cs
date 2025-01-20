using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.IdleDetection;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.IdleMonitor
{
    internal class AddIdleMonitorRegistrationCommandHandler : XCHostCommandHandlerBase<AddIdleMonitorRegistrationArgs>
    {
        private readonly IIdleDetectionManager _idleDetectionManager;

        public AddIdleMonitorRegistrationCommandHandler(IIdleDetectionManager idleDetectionManager)
        {
            _idleDetectionManager = idleDetectionManager;
        }

        protected override async Task HandleCommandAsync(AddIdleMonitorRegistrationArgs args, CancellationToken cancellationToken)
        {
            var im = _idleDetectionManager;

            var writeMessageAsync = CommandContext.WriteMessage;
            var registration = im.RegisterDisposableCallback(
                TimeSpan.FromMilliseconds(args.IdleAfterMs), 
                (userState, screenState) =>
                {
                    _ = writeMessageAsync($"idlemonitorupdate {{ \"monitorName\": \"{args.MonitorName}\", \"userState\": \"{userState}\", \"screenState\": \"{screenState}\" }}");
                });
            CommandContext.XCHostSessionDisposables.Add(
                IdleMonitorRegistrationUtils.GetMonitorKey(args.MonitorName), registration);
        }
    }
}
