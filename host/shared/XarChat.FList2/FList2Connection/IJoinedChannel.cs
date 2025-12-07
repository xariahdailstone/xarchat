using XarChat.FList2.Common;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection
{
    public interface IJoinedChannel
    {
        IJoinedCharacterChat JoinedCharacterChat { get; }

        ChannelId ChannelId { get; }

        ChannelName ChannelName { get; }

        IChannelMessageList Messages { get; }

        // TODO:

        Task SendMessageAsync(string message, bool isEmote, CancellationToken cancellationToken);
    }
}
