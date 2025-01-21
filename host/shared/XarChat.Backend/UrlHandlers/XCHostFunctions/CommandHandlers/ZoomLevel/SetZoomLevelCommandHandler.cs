using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ZoomLevel
{
    internal class SetZoomLevelCommandHandler : XCHostCommandHandlerBase<JsonObject>
    {
        private readonly IWindowControl _windowControl;

        public SetZoomLevelCommandHandler(IWindowControl windowControl)
        {
            _windowControl = windowControl;
        }

        protected override async Task HandleCommandAsync(JsonObject args, CancellationToken cancellationToken)
        {
            if (args is not null && args.TryGetPropertyValue("value", out var valueNode) &&
                valueNode is not null &&
                valueNode.GetValueKind() == System.Text.Json.JsonValueKind.Number)
            {
                float f = (float)valueNode;
                await _windowControl.SetBrowserZoomLevelAsync(f);
            }
        }
    }
}
