using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class ChatEnabledCharacters
    {
        [JsonPropertyName("characterId")]
        public CharacterId CharacterId { get; set; }

        [JsonPropertyName("characterNameLower")]
        public string CharacterNameLower
        {
            get => this.CharacterName.CanonicalValue;
            set => this.CharacterName = CharacterName.Create(value);
        }

        [JsonPropertyName("characterName")]
        public CharacterName CharacterName { get; set; }

        [JsonPropertyName("avatarUrlPath")]
        public string AvatarUrlPath { get; set; }

        [JsonPropertyName("genderColor")]
        public string GenderColor { get; set; }
    }
}