using XarChat.FList2.FList2Api.Entities;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultPMConversationMessage : IPMConversationMessage
    {
        public DefaultPMConversationMessage(
            DefaultOpenPMConversation openPMConversation,
            Guid id, DateTime timestamp, Guid optimisticId, CharacterInfo author, string body, bool isMeMessage, string genderColor)
        {
            this.OpenPMConversation = openPMConversation;
            this.Id = id;   
            this.Timestamp = timestamp;
            this.OptimisticId = optimisticId;
            this.Author = author;
            this.Body = body;
            this.IsMeMessage = isMeMessage;
            this.GenderColor = genderColor;
        }

        public DefaultOpenPMConversation OpenPMConversation { get; }

        IOpenPMConversation IPMConversationMessage.OpenPMConversation => this.OpenPMConversation;

        public Guid Id { get; }

        public DateTime Timestamp { get; }

        public Guid OptimisticId { get; }

        public CharacterInfo Author { get; }

        public string Body { get; }

        public bool IsMeMessage { get; }

        public string GenderColor { get; }
    }
}
