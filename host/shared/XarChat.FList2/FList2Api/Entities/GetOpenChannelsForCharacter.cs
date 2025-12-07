using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetOpenChannelsForCharacter
    {
        [JsonPropertyName("characterId")]
        public required CharacterId CharacterId { get; set; }

        [JsonPropertyName("channelSubscriptionList")]
        public required List<GetOpenChannelInfo> OpenChannels { get; set; }
    }
}