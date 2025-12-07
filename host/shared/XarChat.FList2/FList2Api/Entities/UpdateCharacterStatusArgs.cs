using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class UpdateCharacterStatusArgs
    {
        public required CharacterId CharacterId { get; set; }

        public required CharacterStatus Status { get; set; }

        public required string? StatusMessage { get; set; }
    }
}