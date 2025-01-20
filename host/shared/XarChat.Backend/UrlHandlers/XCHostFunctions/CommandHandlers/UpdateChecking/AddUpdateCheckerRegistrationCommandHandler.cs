using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.UpdateChecker;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.UpdateChecking
{
    internal class AddUpdateCheckerRegistrationUtils
    {
        public static object GetMonitorKey(string name) => $"AddUpdateCheckerRegistration-{name.ToLower()}";
    }

    internal class AddUpdateCheckerRegistrationCommandHandler : XCHostCommandHandlerBase<AddUpdateCheckerMonitorRegistrationArgs>
    {
        private readonly IUpdateChecker _updateChecker;

        public AddUpdateCheckerRegistrationCommandHandler(IUpdateChecker updateChecker)
        {
            _updateChecker = updateChecker;
        }

        protected override Task HandleCommandAsync(AddUpdateCheckerMonitorRegistrationArgs args, CancellationToken cancellationToken)
        {
            var writeMessageFunc = CommandContext.WriteMessage;

            var reg = new UpdateCheckerMonitorRegistration(_updateChecker, args.MonitorName, async (msg) =>
            {
                await writeMessageFunc(msg);
            });
            CommandContext.XCHostSessionDisposables.Add(
                AddUpdateCheckerRegistrationUtils.GetMonitorKey(args.MonitorName), reg);

            return Task.CompletedTask;
        }
    }

    internal class RemoveUpdateCheckerRegistrationCommandHandler : XCHostCommandHandlerBase<RemoveUpdateCheckerMonitorRegistrationArgs>
    {
        private readonly IUpdateChecker _updateChecker;

        public RemoveUpdateCheckerRegistrationCommandHandler(IUpdateChecker updateChecker)
        {
            _updateChecker = updateChecker;
        }

        protected override Task HandleCommandAsync(RemoveUpdateCheckerMonitorRegistrationArgs args, CancellationToken cancellationToken)
        {
            var k = AddUpdateCheckerRegistrationUtils.GetMonitorKey(args.MonitorName);
            if (CommandContext.XCHostSessionDisposables.TryGetValue(k, out var disp))
            {
                disp.Dispose();
                CommandContext.XCHostSessionDisposables.Remove(k);
            }
            return Task.CompletedTask;
        }
    }

    internal class RelaunchToApplyUpdateCommandHandler : XCHostCommandHandlerBase
    {
        private readonly IUpdateChecker _updateChecker;

        public RelaunchToApplyUpdateCommandHandler(IUpdateChecker updateChecker)
        {
            _updateChecker = updateChecker;
        }

        protected override async Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            _updateChecker.IndicateRelaunchOnExit();
            await CommandContext.WriteMessage("relaunchconfirmed");
        }
    }

    internal class LoginSuccessCommandHandler : XCHostCommandHandlerBase
    {
        private readonly IUpdateChecker _updateChecker;

        public LoginSuccessCommandHandler(IUpdateChecker updateChecker)
        {
            _updateChecker = updateChecker;
        }

        protected override Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            _updateChecker.IndicateSuccessfulLogin();
            return Task.CompletedTask;
        }
    }
}
