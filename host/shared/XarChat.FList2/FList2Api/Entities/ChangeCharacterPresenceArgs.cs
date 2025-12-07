using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class ChangeCharacterPresenceArgs
    {
        [JsonPropertyName("characterId")]
        public required CharacterId CharacterId { get; set; }

        [JsonPropertyName("status")]
        public required CharacterStatus Status { get; set; }

        [JsonPropertyName("statusMessage")]
        public required string? StatusMessage { get; set; }
    }
}