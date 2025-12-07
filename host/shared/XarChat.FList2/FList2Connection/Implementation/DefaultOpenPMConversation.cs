using XarChat.FList2.Common;
using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Outgoing;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultOpenPMConversation : IOpenPMConversation
    {
        public DefaultOpenPMConversation(
            DefaultJoinedCharacterChat joinedCharacterChat, CharacterInfo interlocutor)
        {
            this.JoinedCharacterChat = joinedCharacterChat;
            this.Interlocutor = interlocutor;
        }

        public DefaultJoinedCharacterChat JoinedCharacterChat { get; }

        IJoinedCharacterChat IOpenPMConversation.JoinedCharacterChat => this.JoinedCharacterChat;

        public CharacterInfo Interlocutor { get; }

        public DefaultPMConversationMessageList Messages { get; } = new DefaultPMConversationMessageList();

        IPMConversationMessageList IOpenPMConversation.Messages => this.Messages;

        public async Task SendMessageAsync(string message, bool isEmote, CancellationToken cancellationToken)
        {
            var jcc = this.JoinedCharacterChat;
            var fh = jcc.Connection.FList2Api.Firehose;

            var spmm = new SendPrivateMessageMessage()
            {
                OptimisticTs = DateTimeOffset.UtcNow,
                Author = new FList2Api.Entities.CharacterInfo()
                {
                    Id = jcc.CharacterId,
                    Name = jcc.CharacterName,
                    AvatarPath = jcc.AvatarUrlPath
                },
                GenderColor = jcc.GenderColor,
                Recipient = this.Interlocutor,
                Body = message,
                IsMeMessage = isEmote,
                Type = "SELF_AUTHORED"
            };
            await fh.WriteAsync(spmm, cancellationToken);
        }
    }
}
