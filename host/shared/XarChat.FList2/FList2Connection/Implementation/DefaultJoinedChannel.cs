using XarChat.FList2.Common;
using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Outgoing;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultJoinedChannel : IJoinedChannel
    {
        public DefaultJoinedChannel(DefaultJoinedCharacterChat charChat, ChannelId channelId, ChannelName channelName)
        {
            this.JoinedCharacterChat = charChat;
            this.ChannelId = channelId;
            this.ChannelName = channelName;
        }

        public DefaultJoinedCharacterChat JoinedCharacterChat { get; }

        IJoinedCharacterChat IJoinedChannel.JoinedCharacterChat => this.JoinedCharacterChat;

        public ChannelId ChannelId { get; }

        public ChannelName ChannelName { get; }

        public DefaultChannelMessageCollection Messages { get; } = new DefaultChannelMessageCollection();

        IChannelMessageList IJoinedChannel.Messages => this.Messages;

        public async Task SendMessageAsync(string message, bool isEmote, CancellationToken cancellationToken)
        {
            var characterId = this.JoinedCharacterChat.CharacterId;

            var conn = this.JoinedCharacterChat.Connection;
            if (conn.ConnectedCharacters.TryGetById(characterId, out var charInfo))
            {
                var scm = new SendChannelMessage()
                {
                    ChannelId = this.ChannelId,
                    ChannelName = this.ChannelName,
                    Author = new CharacterInfo()
                    {
                        Id = characterId,
                        Name = charInfo.CharacterName,
                        AvatarPath = charInfo.AvatarUrlPath,
                        NameLower = charInfo.CharacterName.CanonicalValue
                    },
                    Body = message,
                    IsMeMessage = isEmote,
                    GenderColor = charInfo.GenderColor
                };
                await conn.FList2Api.Firehose.WriteAsync(scm, cancellationToken);
            }
            else
            {
                throw new ApplicationException("could not get connected character info");
            }
        }
    }
}
