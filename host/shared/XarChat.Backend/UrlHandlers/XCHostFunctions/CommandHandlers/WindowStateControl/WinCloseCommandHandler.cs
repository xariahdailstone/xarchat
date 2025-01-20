using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.WindowStateControl
{
    internal class WinCloseCommandHandler : XCHostCommandHandlerBase
    {
        private readonly IWindowControl _windowControl;

        public WinCloseCommandHandler(IWindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        protected override Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            _windowControl.Close();
            return Task.CompletedTask;
        }
    }
}
