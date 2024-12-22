using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class GuestbookPagePostInfo
    {
        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("character")]
        public required ProfileFriendsInfoItem Character { get; set; }

        [JsonPropertyName("postedAt")]
        public long PostedAt { get; set; }

        [JsonPropertyName("message")]
        public required string Message { get; set; }

        [JsonPropertyName("reply")]
        public string? Reply { get; set; }

        [JsonPropertyName("private")]
        public bool Private { get; set; }

        [JsonPropertyName("approved")]
        public bool Approved { get; set; }

        [JsonPropertyName("canEdit")]
        public bool CanEdit { get; set; }
    }
}
