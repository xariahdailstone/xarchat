using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class CharacterPresenceStatusView
    {
        [JsonPropertyName("status")]
        public required CharacterStatus Status { get; set; }

        [JsonPropertyName("title")]
        public required string Title { get; set; }
    }
}