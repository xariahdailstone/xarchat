using XarChat.FList2.FList2Api.Entities;

namespace XarChat.FList2.FList2Connection
{
    public interface IChannelMessage
    {
        public IJoinedChannel Channel { get; }

        public string Body { get; }

        public bool IsMeMessage { get; }

        public CharacterInfo Author { get; }

        public string GenderColor { get; }
    }
}
