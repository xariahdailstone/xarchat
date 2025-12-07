using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetPendingFriendRequestsResponse
    {
        [JsonPropertyName("sentRequestList")]
        public required List<PendingFriendRequestItem> SentRequestList { get; set; }

        [JsonPropertyName("receivedRequestList")]
        public required List<PendingFriendRequestItem> ReceivedRequestList { get; set; }
    }

    public class PendingFriendRequestItem
    {
        [JsonPropertyName("senderCharacterId")]
        public required CharacterId SenderCharacterId { get; set; }

        [JsonPropertyName("senderCharacterName")]
        public required CharacterName SenderCharacterName { get; set; }

        [JsonPropertyName("recipientCharacterId")]
        public required CharacterId RecipientCharacterId { get; set; }

        [JsonPropertyName("recipientCharacterName")]
        public required CharacterName RecipientCharacterName { get; set; }
    }
}