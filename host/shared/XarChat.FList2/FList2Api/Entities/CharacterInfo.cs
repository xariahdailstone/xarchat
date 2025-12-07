using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class CharacterInfo
    {
        [JsonPropertyName("id")]
        public required CharacterId Id { get; set; }

        [JsonPropertyName("name")]
        public required CharacterName Name { get; set; }

        [JsonPropertyName("nameLower")]
        public string NameLower
        {
            get => this.Name.CanonicalValue;
            set => this.Name = CharacterName.Create(value);
        }

        [JsonPropertyName("avatarPath")]
        public required string AvatarPath { get; set; }
    }
}