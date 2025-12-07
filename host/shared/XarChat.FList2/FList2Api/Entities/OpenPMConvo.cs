using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class OpenPMConvo
    {
        [JsonPropertyName("characterName")]
        public CharacterName CharacterName { get; set; } // MY character name

        [JsonPropertyName("characterId")]
        public CharacterId CharacterId { get; set; } // MY character ID

        [JsonPropertyName("recipientName")]
        public CharacterName RecipientName { get; set; } // INTERLOCUTOR character name

        [JsonPropertyName("recipientId")]
        public CharacterId RecipientId { get; set; } // INTERLOCUTOR character ID

        [JsonPropertyName("sortOrder")]
        public int SortOrder { get; set; }  // Ascending = downwards

        [JsonPropertyName("presence")]
        public CharacterPresence Presence { get; set; } // INTERLOCUTOR presence

        [JsonPropertyName("recipientDeleted")]
        public bool RecipientDeleted { get; set; }

        [JsonPropertyName("recipientAvatarPath")]
        public string RecipientAvatarPath { get; set; }
    }
}