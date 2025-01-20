using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ShowDevTools
{
    public class ShowDevToolsCommandHandler : XCHostCommandHandlerBase
    {
        private readonly IAppConfiguration _appConfig;
        private readonly IWindowControl _windowControl;

        public ShowDevToolsCommandHandler(
            IAppConfiguration appConfig,
            IWindowControl windowControl)
        {
            _appConfig = appConfig;
            _windowControl = windowControl;
        }

        protected override Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            if (_appConfig.EnableDevTools)
            {
                _windowControl.ShowDevTools();
            }
            return Task.CompletedTask;
        }
    }
}
