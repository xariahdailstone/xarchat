using XarChat.FList2.Common;
using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal record DefaultCharacterInfoWithPresenceData(
        CharacterId CharacterId,
        CharacterName CharacterName,
        string AvatarUrlPath,
        CharacterStatus CharacterStatus,
        string? StatusMessage)
    {
    }
}
