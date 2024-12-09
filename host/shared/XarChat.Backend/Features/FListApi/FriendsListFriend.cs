using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class FriendsListFriend
    {
        [JsonPropertyName("source")]
        public string Source { get; set; }

        [JsonPropertyName("dest")]
        public string Dest { get; set; }

        [JsonPropertyName("last_online")]
        public long LastOnline { get; set; }
    }
}
