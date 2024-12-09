using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class KinkListGroup
    {
        [JsonPropertyName("group")]
        public string Group { get; set; }

        [JsonPropertyName("items")]
        public List<KinkListGroupItem> Items { get; set; }
    }
}
