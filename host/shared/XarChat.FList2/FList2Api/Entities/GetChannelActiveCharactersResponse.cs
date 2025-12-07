using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetChannelActiveCharactersResponse
    {
        [JsonPropertyName("totalCount")]
        public required int TotalCount { get; set; }

        [JsonPropertyName("list")]
        public required List<GetChannelActiveCharactersItem> List { get; set; }
    }

    public class GetChannelActiveCharactersItem
    {
        [JsonPropertyName("id")]
        public required CharacterId Id { get; set; }

        [JsonPropertyName("characterName")]
        public required CharacterName CharacterName { get; set; }

        [JsonPropertyName("characterNameLower")]
        public required string CharacterNameLower { get; set; }

        [JsonPropertyName("characterAvatarPath")]
        public required string CharacterAvatarPath { get; set; }

        [JsonPropertyName("presence")]
        public required CharacterPresence Presence { get; set; }

        [JsonPropertyName("badgeList")]
        public required List<string> BadgeList { get; set; }

        [JsonPropertyName("genderColor")]
        public required string GenderColor { get; set; }
    }
}