using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ProfileFieldsSectionGroupItem
    {
        [JsonPropertyName("id")]
        public required long Id { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }

        [JsonPropertyName("type")]
        public required string Type { get; set; }

        [JsonPropertyName("list")]
        public List<string>? List { get; set; }
    }
}
