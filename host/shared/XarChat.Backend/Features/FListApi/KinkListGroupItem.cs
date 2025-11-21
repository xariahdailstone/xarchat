using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class KinkListGroupItem
    {
        [JsonPropertyName("kink_id")]
        public required long KinkId { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }

        [JsonPropertyName("description")]
        public required string Description { get; set; }
    }
}
