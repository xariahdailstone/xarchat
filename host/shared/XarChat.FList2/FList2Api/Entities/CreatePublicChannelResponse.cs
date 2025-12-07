using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class CreatePublicChannelResponse
    {
        [JsonPropertyName("id")]
        public required ChannelId ChannelId { get; set; }

        [JsonPropertyName("name")]
        public required ChannelName ChannelName { get; set; }

        [JsonPropertyName("description")]
        public required string? Description { get; set; }

        [JsonPropertyName("activeCharacterCount")]
        public required int ActiveCharacterCount { get; set; }

        [JsonPropertyName("ownerId")]
        public required int OwnerCharacterId { get; set; }
    }
}