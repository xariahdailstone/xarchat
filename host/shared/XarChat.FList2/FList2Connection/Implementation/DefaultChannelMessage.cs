using XarChat.FList2.FList2Api.Entities;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultChannelMessage : IChannelMessage
    {
        public DefaultChannelMessage(DefaultJoinedChannel channel, string body, bool isMeMessage, CharacterInfo author, string genderColor)
        {
            this.Channel = channel;
            this.Body = body;
            this.IsMeMessage = isMeMessage;
            this.Author = author;
            this.GenderColor = genderColor;
        }

        public DefaultJoinedChannel Channel { get; }

        IJoinedChannel IChannelMessage.Channel => this.Channel;

        public string Body { get; }

        public bool IsMeMessage { get; }

        public CharacterInfo Author { get; }

        public string GenderColor { get; }
    }
}
