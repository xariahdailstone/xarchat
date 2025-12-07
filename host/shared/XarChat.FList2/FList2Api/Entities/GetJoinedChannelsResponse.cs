using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetJoinedChannelsResponse
    {
        [JsonPropertyName("allChannelSubscriptionsResponseDtos")]
        public required List<GetOpenChannelsForCharacter> Items { get; set; }
    }
}

