using XarChat.FList2.Common;
using System.Diagnostics.CodeAnalysis;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultJoinedChannelCollection : ObservableList<DefaultJoinedChannel>, IJoinedChannelsList
    {
        IJoinedChannel IReadOnlyList<IJoinedChannel>.this[int index] => this[index];

        IDisposable IObservableList<IJoinedChannel>.AddListUpdateHandler(Action<IListUpdateEventArgs<IJoinedChannel>> args)
            => this.AddListUpdateHandler(args);

        public bool TryGetById(ChannelId id, [NotNullWhen(true)] out DefaultJoinedChannel channel)
        {
            var x = this.Where<DefaultJoinedChannel>(x => x.ChannelId == id).FirstOrDefault();
            if (x is not null)
            {
                channel = x;
                return true;
            }
            channel = default;
            return false;
        }

        IEnumerator<IJoinedChannel> IEnumerable<IJoinedChannel>.GetEnumerator() => GetEnumerator();
    }
}
