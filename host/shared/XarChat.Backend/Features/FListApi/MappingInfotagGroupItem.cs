using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class MappingInfotagGroupItem
    {
        [JsonPropertyName("id")]
        public string Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }
    }
}
