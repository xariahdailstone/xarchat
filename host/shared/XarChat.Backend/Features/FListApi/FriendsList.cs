using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class FriendsList
    {
        [JsonPropertyName("bookmarklist")]
        public required List<string> BookmarkList { get; set; }

        [JsonPropertyName("friendlist")]
        public required List<FriendsListFriend> FriendList { get; set; }

        [JsonPropertyName("requestlist")]
        public required List<FriendsListRequest> RequestList { get; set; }

        [JsonPropertyName("requestpending")]
        public required List<FriendsListRequest> RequestPending { get; set; }
    }
}
