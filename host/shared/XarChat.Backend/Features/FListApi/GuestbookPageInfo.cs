using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class GuestbookPageInfo
    {
        [JsonPropertyName("page")]
        public int Page { get; set; }

        [JsonPropertyName("nextPage")]
        public bool NextPage { get; set; }

        [JsonPropertyName("canEdit")]
        public bool CanEdit { get; set; }

        [JsonPropertyName("posts")]
        public required List<GuestbookPagePostInfo> Posts { get; set; }
    }
}
