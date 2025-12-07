using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetChannelMessageHistoryResponse
    {
        [JsonPropertyName("olderCursor")]
        public required string? OlderCursor { get; set; }

        [JsonPropertyName("hasOlder")]
        public required bool HasOlder { get; set; }

        [JsonPropertyName("newerCursor")]
        public required string? NewerCursor { get; set; }

        [JsonPropertyName("hasNewer")]
        public required bool HasNewer { get; set; }

        [JsonPropertyName("list")]
        public required List<GetChannelMessageHistoryItem> List { get; set; }
    }
}

