using XarChat.FList2.Common;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultJoinedCharacterChat : IJoinedCharacterChat
    {
        public DefaultJoinedCharacterChat(
            DefaultFList2Connection connection, CharacterId characterId, CharacterName characterName, string avatarUrlPath, string genderColor)
        {
            this.Connection = connection;
            this.CharacterId = characterId;
            this.CharacterName = characterName;
            this.AvatarUrlPath = avatarUrlPath;
            this.GenderColor = genderColor;
        }

        public DefaultFList2Connection Connection { get; }

        IFList2Connection IJoinedCharacterChat.Connection => this.Connection;

        public CharacterId CharacterId { get; }

        public CharacterName CharacterName { get; }
        
        public string AvatarUrlPath { get; }

        public string GenderColor { get; }

        public DefaultJoinedChannelCollection JoinedChannels { get; } = new DefaultJoinedChannelCollection();

        IJoinedChannelsList IJoinedCharacterChat.JoinedChannels => this.JoinedChannels;

        public DefaultOpenPMConversationsList OpenPMConversations { get; } = new DefaultOpenPMConversationsList();

        IOpenPMConversationsList IJoinedCharacterChat.OpenPMConversations => this.OpenPMConversations;
    }
}
