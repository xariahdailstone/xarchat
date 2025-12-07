using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class PMConversationUnreadResponseItem
    {
        [JsonPropertyName("characterId")]
        public required CharacterId CharacterId { get; set; }

        [JsonPropertyName("character1Id")]
        public required CharacterId Character1Id { get; set; }

        [JsonPropertyName("character2Id")]
        public required CharacterId Character2Id { get; set; }
    }
}