using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetCharacterNameResponse
    {
        [JsonPropertyName("id")]
        public required CharacterId CharacterId { get; set; }

        [JsonPropertyName("characterName")]
        public required CharacterName CharacterName { get; set; }

        [JsonPropertyName("avatarPath")]
        public required string AvatarPath { get; set; }
    }
}