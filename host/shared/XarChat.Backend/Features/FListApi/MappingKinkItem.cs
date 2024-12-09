using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class MappingKinkItem
    {
        [JsonPropertyName("id")]
        public string Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("description")]
        public string Description { get; set; }

        [JsonPropertyName("group_id")]
        public string GroupId { get; set; }
    }
}
