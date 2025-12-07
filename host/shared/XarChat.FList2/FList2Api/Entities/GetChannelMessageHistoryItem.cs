using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetChannelMessageHistoryItem
    {
        [JsonPropertyName("cursorId")]
        public string CursorId { get; set; }

        [JsonPropertyName("id")]
        public string Id { get; set; }

        [JsonPropertyName("ts")]
        public DateTimeOffset Timestamp { get; set; }

        [JsonPropertyName("body")]
        public string Body { get; set; }

        [JsonPropertyName("author")]
        public CharacterInfo Author { get; set; }

        [JsonPropertyName("channelName")]
        public ChannelName ChannelName { get; set; }

        [JsonPropertyName("channelId")]
        public ChannelId ChannelId { get; set; }

        [JsonPropertyName("isMeMessage")]
        public bool IsMeMessage { get; set; }

        [JsonPropertyName("genderColor")]
        public string GenderColor { get; set; }

        [JsonPropertyName("hiddenAt")]
        public DateTimeOffset? HiddenAt { get; set; }

        [JsonPropertyName("hiddenByCharacterId")]
        public CharacterId? HiddenByCharacterId { get; set; }

        [JsonPropertyName("hiddenByCharacterName")]
        public CharacterName? HiddenByCharacterName { get; set; }
    }
}

