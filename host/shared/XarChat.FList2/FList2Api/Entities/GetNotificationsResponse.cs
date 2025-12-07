using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{

    public class GetNotificationsResponse
    {
        [JsonPropertyName("notifications")]
        public required List<GetNotificationsResponseItem> Notifications { get; set; }

        [JsonPropertyName("totalElements")]
        public required int TotalElements { get; set; }

        [JsonPropertyName("totalPages")]
        public required int TotalPages { get; set; }

        [JsonPropertyName("hasNext")]
        public required bool HasNext { get; set; }
    }

    public class GetNotificationsResponseItem
    {
        [JsonPropertyName("id")]
        public required int Id { get; set; }

        [JsonPropertyName("title")]
        public required string Title { get; set; } // "New Friend Request"

        [JsonPropertyName("message")]
        public required string Message { get; set; } // "You have received a new friend request"

        [JsonPropertyName("context")]
        public required string Context { get; set; } // "FRIEND_REQUEST"

        [JsonPropertyName("createdAt")]
        public required DateTimeOffset CreatedAt { get; set; }

        [JsonPropertyName("link")]
        public required string Link { get; set; }
    }
}