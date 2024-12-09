using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class MappingList
    {
        [JsonPropertyName("kinks")]
        public List<MappingKinkItem> Kinks { get; set; }

        [JsonPropertyName("kink_groups")]
        public List<MappingKinkGroupItem> KinkGroups { get; set; }

        [JsonPropertyName("infotags")]
        public List<MappingInfotagItem> Infotags { get; set; }

        [JsonPropertyName("infotag_groups")]
        public List<MappingInfotagGroupItem> InfotagGroups { get; set; }

        [JsonPropertyName("listitems")]
        public List<MappingListItem> ListItems { get; set; }
    }
}
