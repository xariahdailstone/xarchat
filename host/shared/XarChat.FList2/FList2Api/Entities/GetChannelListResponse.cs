using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetChannelListResponse
    {
        [JsonPropertyName("totalCount")]
        public required int TotalCount { get; set; }

        [JsonPropertyName("list")]
        public required List<GetChannelListResponseItem> List { get; set; }
    }

    public class GetChannelListResponseItem
    {
        [JsonPropertyName("id")]
        public ChannelId Id { get; set; }

        [JsonPropertyName("name")]
        public ChannelName Name { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("activeCharacterCount")]
        public int ActiveCharacterCount { get; set; }

        [JsonPropertyName("ownerId")]
        public CharacterId? OwnerId { get; set; }
    }
}