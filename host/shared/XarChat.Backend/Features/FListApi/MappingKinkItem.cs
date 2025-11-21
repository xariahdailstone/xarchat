using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class MappingKinkItem
    {
        [JsonPropertyName("id")]
        public required string Id { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }

        [JsonPropertyName("description")]
        public required string Description { get; set; }

        [JsonPropertyName("group_id")]
        public required string GroupId { get; set; }
    }
}
