using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ProfileFieldsSectionGroup
    {
        [JsonPropertyName("group")]
        public string Group { get; set; }

        [JsonPropertyName("items")]
        public List<ProfileFieldsSectionGroupItem> Items { get; set; }
    }
}
