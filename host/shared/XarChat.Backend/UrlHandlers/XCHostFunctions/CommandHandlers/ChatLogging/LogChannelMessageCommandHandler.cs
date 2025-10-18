using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.ChatLogging;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ChatLogging
{
    internal class LogChannelMessageCommandHandler : AsyncXCHostCommandHandlerBase<LogChannelMessageArgs>
    {
        private readonly IChatLogWriter _chatLogWriter;

        public LogChannelMessageCommandHandler(IChatLogWriter chatLogWriter)
        {
            _chatLogWriter = chatLogWriter;
        }

        protected override async Task HandleCommandAsync(LogChannelMessageArgs args, CancellationToken cancellationToken)
        {
            await _chatLogWriter.LogChannelMessageAsync(
                args.MyCharacterName,
                args.ChannelName, args.ChannelTitle,
                args.SpeakingCharacter, args.CharacterGender, args.CharacterStatus,
                args.MessageType, args.MessageText, cancellationToken);
        }
    }
}
