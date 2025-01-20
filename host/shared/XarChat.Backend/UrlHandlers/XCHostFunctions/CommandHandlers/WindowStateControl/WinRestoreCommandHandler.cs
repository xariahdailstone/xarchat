using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.WindowStateControl
{
    internal class WinRestoreCommandHandler : AsyncXCHostCommandHandlerBase
    {
        private readonly IWindowControl _windowControl;

        public WinRestoreCommandHandler(IWindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        protected override Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            _windowControl.Restore();
            return Task.CompletedTask;
        }
    }
}
