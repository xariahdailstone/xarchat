using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class FriendsListFriend
    {
        [JsonPropertyName("source")]
        public required string Source { get; set; }

        [JsonPropertyName("dest")]
        public required string Dest { get; set; }

        [JsonPropertyName("last_online")]
        public required long LastOnline { get; set; }
    }
}
