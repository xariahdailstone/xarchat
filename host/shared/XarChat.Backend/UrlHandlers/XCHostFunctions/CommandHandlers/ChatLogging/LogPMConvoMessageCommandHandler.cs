using XarChat.Backend.Features.ChatLogging;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ChatLogging
{
    internal class LogPMConvoMessageCommandHandler : AsyncXCHostCommandHandlerBase<LogPMConvoMessageArgs>
    {
        private readonly IChatLogWriter _chatLogWriter;

        public LogPMConvoMessageCommandHandler(IChatLogWriter chatLogWriter)
        {
            _chatLogWriter = chatLogWriter;
        }

        protected override async Task HandleCommandAsync(LogPMConvoMessageArgs args, CancellationToken cancellationToken)
        {
            await _chatLogWriter.LogPMConvoMessageAsync(
                args.MyCharacterName,
                args.Interlocutor,
                args.SpeakingCharacter, args.CharacterGender, args.CharacterStatus,
                args.MessageType, args.MessageText, cancellationToken);
        }
    }
}
