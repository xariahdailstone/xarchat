using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ProfileFieldsSectionGroup
    {
        [JsonPropertyName("group")]
        public required string Group { get; set; }

        [JsonPropertyName("items")]
        public required List<ProfileFieldsSectionGroupItem> Items { get; set; }
    }
}
