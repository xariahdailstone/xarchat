using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.EIconUpdateSubmitter;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.EIconSearch
{
    internal class SubmitEIconMetadataCommandHandler : XCHostCommandHandlerBase<SubmitEIconMetadataArgs>
    {
        private readonly IDataUpdateSubmitter _dataUpdateSubmitter;

        public SubmitEIconMetadataCommandHandler(IDataUpdateSubmitter dataUpdateSubmitter)
        {
            _dataUpdateSubmitter = dataUpdateSubmitter;
        }

        protected override Task HandleCommandAsync(SubmitEIconMetadataArgs args, CancellationToken cancellationToken)
        {
            _ = Task.Run(async () =>
            {
                await _dataUpdateSubmitter.SubmitHardLoadedEIconInfoAsync(
                    args.Name, args.ETag, args.ContentLength, cancellationToken);
            });

            return Task.CompletedTask;
        }
    }
}
