using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class UserCharacters
    {
        [JsonPropertyName("totalCount")]
        public required int TotalCount { get; set; }

        [JsonPropertyName("characterList")]
        public required List<UserCharacter> CharacterList { get; set; }
    }
}