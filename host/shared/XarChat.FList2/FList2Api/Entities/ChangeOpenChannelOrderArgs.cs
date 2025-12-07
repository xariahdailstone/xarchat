using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class ChangeOpenChannelOrderArgs
    {
        [JsonIgnore]
        public required CharacterId CharacterId { get; set; }

        [JsonPropertyName("channelIdToMove")]
        public required ChannelId ChannelIdToMove { get; set; }

        [JsonPropertyName("newPosition")]
        public int NewPosition { get; set; }
    }


}