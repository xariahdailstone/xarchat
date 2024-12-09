using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class MappingListItem
    {
        [JsonPropertyName("id")]
        public string Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("value")]
        public string Value { get; set; }
    }
}
