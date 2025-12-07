using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Incoming
{
    [IncomingMessage(Target = "PRIVATE_CHAT", Type = "UNREAD_PRIVATE_CHAT")]
    public class PMConvoHasUnreadMessage : IFirehoseIncomingMessage
    {
        [JsonPropertyName("characterId")]
        public required CharacterId CharacterId { get; set; }

        [JsonPropertyName("privateChatId")]
        public required PMConvoHasUnreadMessageChatId PrivateChatId { get; set; }
    }

    public class PMConvoHasUnreadMessageChatId
    {
        [JsonPropertyName("character1Id")]
        public required CharacterId Character1Id { get; set; }

        [JsonPropertyName("character2Id")]
        public required CharacterId Character2Id { get; set; }
    }
}
