using XarChat.FList2.FList2Api.Entities;
using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Incoming
{
    [IncomingMessage(Target = "PRIVATE_CHAT", Type = "MESSAGE")]
    public class PMConvoMessageReceived : IFirehoseIncomingMessage
    {
        [JsonPropertyName("id")]
        public required string Id { get; set; }

        [JsonPropertyName("ts")]
        public required DateTimeOffset Timestamp { get; set; }

        [JsonPropertyName("optimisticId")]
        public required string OptimisticId { get; set; }

        [JsonPropertyName("body")]
        public required string Body { get; set; }

        [JsonPropertyName("author")]
        public required CharacterInfo Author { get; set; }

        [JsonPropertyName("recipient")]
        public required CharacterInfo Recipient { get; set; }

        [JsonPropertyName("type")]
        public required string Type { get; set; }  // SELF_AUTHORED or RECIPIENT_AUTHORED

        [JsonPropertyName("isMeMessage")]
        public required bool IsMeMessage { get; set; }

        [JsonPropertyName("genderColor")]
        public required string GenderColor { get; set; }
    }
}
