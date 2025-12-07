using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class CreatePublicChannelArgs
    {
        [JsonPropertyName("name")]
        public required ChannelName ChannelName { get; set; }

        [JsonPropertyName("ownerId")]
        public required CharacterId OwnerCharacterId { get; set; }

        [JsonPropertyName("descirption")]
        public required string? Description { get; set; }
    }
}