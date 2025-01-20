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
    internal class LogChannelMessageCommandHandler : XCHostCommandHandlerBase<LogChannelMessageArgs>
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

    internal class LogPMConvoMessageCommandHandler : XCHostCommandHandlerBase<LogPMConvoMessageArgs>
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

    internal class EndCharacterSessionCommandHandler : XCHostCommandHandlerBase
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
