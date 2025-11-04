using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class KinkListGroup
    {
        [JsonPropertyName("group")]
        public required string Group { get; set; }

        [JsonPropertyName("items")]
        public required List<KinkListGroupItem> Items { get; set; }
    }
}
