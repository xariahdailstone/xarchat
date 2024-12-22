using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ProfileFriendsInfo
    {
        [JsonPropertyName("friends")]
        public List<ProfileFriendsInfoItem>? Friends { get; set; }
    }
}
