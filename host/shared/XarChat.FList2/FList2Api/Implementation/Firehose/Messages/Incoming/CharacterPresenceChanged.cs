using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Incoming
{
    [IncomingMessage(Target = "CHARACTER_PRESENCE", Type = "PRESENCE_CHANGE_MANY")]
    public class CharacterPresenceChanged : IFirehoseIncomingMessage
    {
        [JsonPropertyName("list")]
        public required List<CharacterPresenceChangedItem> List { get; set; }
    }

    public class CharacterPresenceChangedItem
    {
        [JsonPropertyName("characterId")]
        public required CharacterId CharacterId { get; set; }

        [JsonPropertyName("statusMessage")]
        public required string? StatusMessage { get; set; }

        [JsonPropertyName("publicStatusView")]
        public required CharacterPresenceChangedStatusView PublicStatusView { get; set; }

        [JsonPropertyName("privateStatusView")]
        public required CharacterPresenceChangedStatusView PrivateStatusView { get; set; }
    }

    public class CharacterPresenceChangedStatusView
    {
        [JsonPropertyName("status")]
        public required string? Status { get; set; }

        [JsonPropertyName("title")]
        public required string? Title { get; set; }
    }
}
