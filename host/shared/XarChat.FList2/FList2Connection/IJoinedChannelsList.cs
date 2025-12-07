using XarChat.FList2.Common;
using System.Diagnostics.CodeAnalysis;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection
{
    public interface IJoinedChannelsList : IObservableList<IJoinedChannel>
    {

        bool TryGetByName(ChannelName name, [NotNullWhen(true)] out IJoinedChannel? channel)
        {
            foreach (var item in this)
            {
                if (item.ChannelName == name)
                {
                    channel = item;
                    return true;
                }
            }
            channel = null;
            return false;
        }
    }
}
