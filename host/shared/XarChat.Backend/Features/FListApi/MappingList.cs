using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class MappingList
    {
        [JsonPropertyName("kinks")]
        public required List<MappingKinkItem> Kinks { get; set; }

        [JsonPropertyName("kink_groups")]
        public required List<MappingKinkGroupItem> KinkGroups { get; set; }

        [JsonPropertyName("infotags")]
        public required List<MappingInfotagItem> Infotags { get; set; }

        [JsonPropertyName("infotag_groups")]
        public required List<MappingInfotagGroupItem> InfotagGroups { get; set; }

        [JsonPropertyName("listitems")]
        public required List<MappingListItem> ListItems { get; set; }
    }
}
