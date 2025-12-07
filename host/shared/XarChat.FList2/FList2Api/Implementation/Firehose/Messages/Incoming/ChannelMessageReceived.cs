using XarChat.FList2.FList2Api.Entities;
using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Incoming
{
    [IncomingMessage(Target = "CHANNEL", Type = "MESSAGE")]
    public class ChannelMessageReceived : IFirehoseIncomingMessage
    {
        [JsonPropertyName("channelId")]
        public required ChannelId ChannelId { get; set; }

        [JsonPropertyName("channelName")]
        public required ChannelName ChannelName { get; set; }

        [JsonPropertyName("body")]
        public required string Body { get; set; }

        [JsonPropertyName("isMeMessage")]
        public required bool IsMeMessage { get; set; }

        [JsonPropertyName("author")]
        public required CharacterInfo Author { get; set; }

        [JsonPropertyName("genderColor")]
        public required string GenderColor { get; set; }
    }
}
