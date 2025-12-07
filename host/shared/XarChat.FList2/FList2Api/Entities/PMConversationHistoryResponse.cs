using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class PMConversationHistoryResponse
    {
        [JsonPropertyName("olderCursor")]
        public string? OlderCursor { get; set; }

        [JsonPropertyName("hasOlder")]
        public bool HasOlder { get; set; }

        [JsonPropertyName("newerCursor")]
        public string? NewerCursor { get; set; }

        [JsonPropertyName("hasNewer")]
        public bool HasNewer { get; set; }

        [JsonPropertyName("list")]
        public List<PMConversationHistoryItem> List { get; set; }
    }
}