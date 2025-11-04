using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class MappingKinkGroupItem
    {
        [JsonPropertyName("id")]
        public required string Id { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }
    }
}
