using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.ChatLogImport
{
    public class PMConversationIdentifier
    {
        [JsonPropertyName("myName")]
        public required string MyCharacterName { get; init; }

        [JsonPropertyName("interlocutorName")]
        public required string InterlocutorCharacterName { get; init; }
    }
}
