using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages;
using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Outgoing
{
    public class SendChannelMessage : IFirehoseOutgoingMessage
    {
        [JsonIgnore]
        public string MqDestination => $"/app/channel.{this.ChannelId}";

        [JsonPropertyName("optimisticId")]
        public Guid OptimisticId { get; set; } = Guid.NewGuid();

        [JsonPropertyName("optimisticTs")]
        public DateTimeOffset OptimisticTs { get; set; } = DateTimeOffset.UtcNow;

        [JsonPropertyName("body")]
        public required string Body { get; set; }

        [JsonPropertyName("author")]
        public required CharacterInfo Author { get; set; }

        [JsonPropertyName("channelId")]
        public required ChannelId ChannelId { get; set; }

        [JsonPropertyName("channelName")]
        public required ChannelName ChannelName { get; set; }

        [JsonPropertyName("isMeMessage")]
        public bool IsMeMessage { get; set; } = false;

        [JsonPropertyName("genderColor")]
        public required string GenderColor { get; set; }
    }
}
