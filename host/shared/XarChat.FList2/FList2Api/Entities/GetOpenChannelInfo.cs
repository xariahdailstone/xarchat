using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetOpenChannelInfo
    {
        [JsonPropertyName("channelId")]
        public required ChannelId ChannelId { get; set; }

        [JsonPropertyName("channelName")]
        public required ChannelName ChannelName { get; set; }

        [JsonPropertyName("isPrivate")]
        public required bool IsPrivate { get; set; }

        [JsonPropertyName("ownerId")]
        public required CharacterId? OwnerId { get; set; }  // XXX: is null for official channels

        [JsonPropertyName("order")]
        public required int Order { get; set; }

        [JsonPropertyName("hasUnread")]
        public required bool HasUnread { get; set; }
    }
}