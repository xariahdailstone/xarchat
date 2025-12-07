using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class PMConversationHistoryItem
    {
        [JsonPropertyName("cursorUuid")]
        public string? CursorUuid { get; set; }

        [JsonPropertyName("id")]
        public string Id { get; set; }

        [JsonPropertyName("ts")]
        public DateTimeOffset Timestamp { get; set; }

        [JsonPropertyName("body")]
        public string Body { get; set; }

        [JsonPropertyName("author")]
        public CharacterInfo Author { get; set; }

        [JsonPropertyName("recipient")]
        public CharacterInfo Recipient { get; set; }

        [JsonPropertyName("isMeMessage")]
        public bool IsMeMessage { get; set; }

        [JsonPropertyName("genderColor")]
        public string GenderColor { get; set; }
    }
}