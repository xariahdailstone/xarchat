using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class UserDetails
    {
        [JsonPropertyName("createdAt")]
        public required DateTime CreatedAt { get; set; }

        [JsonPropertyName("timezoneOffset")]
        public required int? TimeZoneOffset { get; set; }

        [JsonPropertyName("moderationRole")]
        public required string? ModerationRole { get; set; }

        [JsonPropertyName("moderationCharacterId")]
        public required int? ModerationCharacterId { get; set; }

        [JsonPropertyName("email")]
        public required string Email { get; set; }

        [JsonPropertyName("pendingDeletion")]
        public required bool PendingDeletion { get; set; }

        [JsonPropertyName("deletionTime")]
        public required DateTime? DeletionTime { get; set; }
    }
}