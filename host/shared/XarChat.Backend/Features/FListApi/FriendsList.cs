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


    public class SendFriendRequestResponse
    {
        [JsonPropertyName("request")]
        public required FriendRequest Request { get; set; }
    }

    public class FriendRequest
    {
        [JsonPropertyName("id")]
        public required int Id { get; set; }

        [JsonPropertyName("source")]
        public required CharacterIdName Source { get; set; }

        [JsonPropertyName("target")]
        public required CharacterIdName Target { get; set; }

        [JsonPropertyName("createdAt")]
        public required long CreatedAt { get; set; }
    }

    public class CharacterIdName
    {
        [JsonPropertyName("id")]
        public required int Id { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }
    }
}
