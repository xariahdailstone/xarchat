using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.ChatLogImport
{
    public class ChannelIdentifier
    {
        [JsonPropertyName("name")]
        public string? ChannelName { get; init; }

        [JsonPropertyName("title")]
        public string? ChannelTitle { get; init; }
    }
}
