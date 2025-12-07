using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class CharacterPresence
    {
        [JsonPropertyName("characterId")]
        public required CharacterId CharacterId { get; set; }

        [JsonPropertyName("publicStatusView")]
        public required CharacterPresenceStatusView PublicStatusView { get; set; }

        [JsonPropertyName("privateStatusView")]
        public required CharacterPresenceStatusView PrivateStatusView { get; set; }

        [JsonPropertyName("statusMessage")]
        public required string? StatusMessage { get; set; }
    }
}