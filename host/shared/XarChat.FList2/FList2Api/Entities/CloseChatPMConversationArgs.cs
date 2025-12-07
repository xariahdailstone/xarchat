using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class CloseChatPMConversationArgs
    {
        [JsonPropertyName("authorId")]
        public required CharacterId AuthorId { get; set; }

        [JsonPropertyName("recipientId")]
        public required CharacterId RecipientId { get; set; }
    }
}