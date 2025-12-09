using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages;
using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Outgoing
{
    public class SendPrivateMessageMessage : IFirehoseOutgoingMessage
    {
        [JsonIgnore]
        public string MqDestination => $"/app/privatemessage";

        [JsonPropertyName("optimisticId")]
        public Guid OptimisticId { get; set; } = Guid.NewGuid();

        [JsonPropertyName("optimisticTs")]
        public DateTimeOffset OptimisticTs { get; set; } = DateTimeOffset.UtcNow;

        [JsonPropertyName("body")]
        public required string Body { get; set; }

        [JsonPropertyName("author")]
        public required CharacterInfo Author { get; set; }

        [JsonPropertyName("recipient")]
        public required CharacterInfo Recipient { get; set; }

        [JsonPropertyName("type")]
        public required string Type { get; set; }

        [JsonPropertyName("isMeMessage")]
        public bool IsMeMessage { get; set; } = false;

        [JsonPropertyName("genderColor")]
        public required string GenderColor { get; set; }
    }
}
