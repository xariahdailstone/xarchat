using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.WindowStateControl
{
    internal class WinMaximizeCommandHandler : AsyncXCHostCommandHandlerBase
    {
        private readonly IWindowControl _windowControl;

        public WinMaximizeCommandHandler(IWindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        protected override Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            _windowControl.Maximize();
            return Task.CompletedTask;
        }
    }
}
