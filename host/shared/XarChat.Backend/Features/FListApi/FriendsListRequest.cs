using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class FriendsListRequest
    {
        [JsonPropertyName("dest")]
        public required string Dest { get; set; }

        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("source")]
        public required string Source { get; set; }
    }
}
