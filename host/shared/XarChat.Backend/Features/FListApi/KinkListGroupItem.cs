using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class KinkListGroupItem
    {
        [JsonPropertyName("kink_id")]
        public long KinkId { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("description")]
        public string Description { get; set; }
    }
}
