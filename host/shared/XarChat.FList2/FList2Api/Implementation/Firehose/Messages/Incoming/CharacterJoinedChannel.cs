using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Incoming
{
    [IncomingMessage(Target = "CHANNEL", Type = "CHARACTERS_ACTIVE")]
    public class CharacterJoinedChannel : IFirehoseIncomingMessage
    {
        [JsonPropertyName("channelId")]
        public required ChannelId ChannelId { get; set; }

        [JsonPropertyName("characters")]
        public required List<CharacterJoinLeaveChannelCharacter> Characters { get; set; }
    }
}
