using XarChat.FList2.Common;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection
{
    public interface IJoinedCharacterChat
    {
        IFList2Connection Connection { get; }

        CharacterId CharacterId { get; }

        CharacterName CharacterName { get; }

        string AvatarUrlPath { get; }

        string GenderColor { get; }

        IJoinedChannelsList JoinedChannels { get; }

        IOpenPMConversationsList OpenPMConversations { get; }
    }
}
