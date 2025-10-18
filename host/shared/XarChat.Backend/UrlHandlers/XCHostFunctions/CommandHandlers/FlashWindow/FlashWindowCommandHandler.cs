using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.FlashWindow
{
    internal class FlashWindowCommandHandler : XCHostCommandHandlerBase
    {
        private readonly IWindowControl _windowControl;

        public FlashWindowCommandHandler(
            IWindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        protected override Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            _windowControl.FlashWindow();
            return Task.CompletedTask;
        }
    }
}
