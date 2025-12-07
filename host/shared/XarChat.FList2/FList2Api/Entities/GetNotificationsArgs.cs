namespace XarChat.FList2.FList2Api.Entities
{
    public class GetNotificationsArgs
    {
        public required int Page { get; set; } // starts at 0

        public required int Size { get; set; }
    }
}