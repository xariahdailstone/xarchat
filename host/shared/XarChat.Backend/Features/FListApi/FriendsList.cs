using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class FriendsList
    {
        [JsonPropertyName("bookmarklist")]
        public List<string> BookmarkList { get; set; }

        [JsonPropertyName("friendlist")]
        public List<FriendsListFriend> FriendList { get; set; }

        [JsonPropertyName("requestlist")]
        public List<FriendsListRequest> RequestList { get; set; }

        [JsonPropertyName("requestpending")]
        public List<FriendsListRequest> RequestPending { get; set; }
    }
}
