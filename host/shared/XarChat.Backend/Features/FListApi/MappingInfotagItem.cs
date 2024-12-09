using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class MappingInfotagItem
    {
        [JsonPropertyName("id")]
        public string Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("type")]
        public string Type { get; set; }

        [JsonPropertyName("list")]
        public string List { get; set; }

        [JsonPropertyName("group_id")]
        public string GroupId { get; set; }
    }
}
