using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetChannelMessageHistoryArgs
    {
        public required ChannelId ChannelId { get; set; }

        public string? CursorLocation { get; set; }

        public CursorDirection? CursorDirection { get; set; }
    }
}