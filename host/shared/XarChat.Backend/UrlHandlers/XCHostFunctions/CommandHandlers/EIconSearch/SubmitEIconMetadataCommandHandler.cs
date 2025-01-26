using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.EIconUpdateSubmitter;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.EIconSearch
{
    internal class SubmitEIconMetadataCommandHandler : AsyncXCHostCommandHandlerBase<SubmitEIconMetadataArgs>
    {
        private readonly IDataUpdateSubmitter _dataUpdateSubmitter;

        public SubmitEIconMetadataCommandHandler(IDataUpdateSubmitter dataUpdateSubmitter)
        {
            _dataUpdateSubmitter = dataUpdateSubmitter;
        }

        protected override async Task HandleCommandAsync(
            SubmitEIconMetadataArgs args, CancellationToken cancellationToken)
        {
            await _dataUpdateSubmitter.SubmitHardLoadedEIconInfoAsync(
                args.Name, args.ETag, args.ContentLength, cancellationToken);
        }
    }
}
