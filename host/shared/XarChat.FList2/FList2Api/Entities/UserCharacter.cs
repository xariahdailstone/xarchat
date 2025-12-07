using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class UserCharacter
    {
        [JsonPropertyName("id")]
        public required CharacterId Id { get; set; }

        [JsonPropertyName("characterName")]
        public required CharacterName CharacterName { get; set; }

        [JsonPropertyName("characterNameLower")]
        public required string CharacterNameLower 
        {
            get => this.CharacterName.CanonicalValue;
            set => this.CharacterName = CharacterName.Create(value);
        }

        [JsonPropertyName("avatarPath")]
        public required string AvatarPath { get; set; }
    }
}