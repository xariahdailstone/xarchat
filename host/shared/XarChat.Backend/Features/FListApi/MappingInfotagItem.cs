using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class MappingInfotagItem
    {
        [JsonPropertyName("id")]
        public required string Id { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }

        [JsonPropertyName("type")]
        public required string Type { get; set; }

        [JsonPropertyName("list")]
        public required string List { get; set; }

        [JsonPropertyName("group_id")]
        public required string GroupId { get; set; }
    }
}
