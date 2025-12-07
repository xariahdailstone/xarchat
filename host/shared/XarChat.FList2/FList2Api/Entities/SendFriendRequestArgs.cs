using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class SendFriendRequestArgs
    {
        [JsonPropertyName("recipientCharacterId")]
        public required CharacterId RecipientCharacterId { get; set; }

        [JsonPropertyName("senderCharacterId")]
        public required CharacterId SenderCharacterId { get; set; }
    }
}