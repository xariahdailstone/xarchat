using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.WindowStateControl
{
    internal class WinMinimizeCommandHandler : XCHostCommandHandlerBase
    {
        private readonly IWindowControl _windowControl;

        public WinMinimizeCommandHandler(IWindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        protected override Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            _windowControl.Minimize();
            return Task.CompletedTask;
        }
    }
}
