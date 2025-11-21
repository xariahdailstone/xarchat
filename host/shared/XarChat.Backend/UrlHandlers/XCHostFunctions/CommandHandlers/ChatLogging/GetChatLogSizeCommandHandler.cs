using XarChat.Backend.Features.ChatLogging;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ChatLogging
{
    internal class GetChatLogSizeCommandHandler : AsyncXCHostCommandHandlerBase
    {
        private readonly IChatLogWriter _chatLogWriter;

        public GetChatLogSizeCommandHandler(IChatLogWriter chatLogWriter)
        {
            _chatLogWriter = chatLogWriter;
        }

        protected override async Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            var res = await _chatLogWriter.GetLogFileSizeAsync(cancellationToken);
            CommandContext.WriteMessage("log.GotLogSize " + res.ToString());
        }
    }
}
