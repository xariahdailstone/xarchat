using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class MappingListItem
    {
        [JsonPropertyName("id")]
        public required string Id { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }

        [JsonPropertyName("value")]
        public required string Value { get; set; }
    }
}
