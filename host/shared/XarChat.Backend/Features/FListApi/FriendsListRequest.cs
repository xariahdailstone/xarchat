using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class FriendsListRequest
    {
        [JsonPropertyName("dest")]
        public string Dest { get; set; }

        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("source")]
        public string Source { get; set; }
    }
}
