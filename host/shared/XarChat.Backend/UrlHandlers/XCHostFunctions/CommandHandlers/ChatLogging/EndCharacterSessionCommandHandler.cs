using XarChat.Backend.Features.ChatLogging;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ChatLogging
{
    internal class EndCharacterSessionCommandHandler : AsyncXCHostCommandHandlerBase
    {
        private readonly IChatLogWriter _chatLogWriter;

        public EndCharacterSessionCommandHandler(IChatLogWriter chatLogWriter)
        {
            _chatLogWriter = chatLogWriter;
        }

        protected override Task HandleCommandAsync(CancellationToken cancellationToken)
        {
            _chatLogWriter.EndLogSource(CommandContext.Args);
            return Task.CompletedTask;
        }
    }
}
