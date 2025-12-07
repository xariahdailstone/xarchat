using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class CharacterOpenPMConvos
    {
        [JsonPropertyName("characterId")]
        public required CharacterId CharacterId { get; set; }

        [JsonPropertyName("presence")]
        public required CharacterPresence Presence { get; set; }

        [JsonPropertyName("list")]
        public required List<OpenPMConvo> List { get; set; }
    }
}