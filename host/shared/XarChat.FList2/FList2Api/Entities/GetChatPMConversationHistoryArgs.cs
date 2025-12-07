using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetChatPMConversationHistoryArgs
    {
        public required CharacterId MyCharacterId { get; set; }

        public required CharacterId InterlocutorCharacterId { get; set; }

        public string? CursorLocation { get; set; }

        public CursorDirection? CursorDirection { get; set; }
    }
}