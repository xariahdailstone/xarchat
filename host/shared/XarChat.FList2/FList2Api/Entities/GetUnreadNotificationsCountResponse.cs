using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetUnreadNotificationsCountResponse
    {
        [JsonPropertyName("count")]
        public required int Count { get; set; }
    }
}