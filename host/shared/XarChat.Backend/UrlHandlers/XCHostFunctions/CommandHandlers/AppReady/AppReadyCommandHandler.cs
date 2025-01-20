using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.AppReady
{
    public class AppReadyCommandHandler : XCHostCommandHandlerBase
    {
        private readonly IWindowControl _windowControl;

        public AppReadyCommandHandler(IWindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        protected override Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            _windowControl.ApplicationReady();
            return Task.CompletedTask;
        }
    }
}
