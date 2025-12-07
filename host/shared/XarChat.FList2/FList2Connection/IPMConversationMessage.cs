using XarChat.FList2.FList2Api.Entities;

namespace XarChat.FList2.FList2Connection
{
    public interface IPMConversationMessage
    {
        IOpenPMConversation OpenPMConversation { get; }

        string Id { get; }

        DateTime Timestamp { get; }

        string OptimisticId { get; }

        CharacterInfo Author { get; }

        string Body { get; }

        bool IsMeMessage { get; }

        public string GenderColor { get; }
    }
}
