namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultChannelMessageCollection : ObservableList<DefaultChannelMessage>, IChannelMessageList
    {
        IChannelMessage IReadOnlyList<IChannelMessage>.this[int index] => this[index];

        IDisposable IObservableList<IChannelMessage>.AddListUpdateHandler(Action<IListUpdateEventArgs<IChannelMessage>> args)
            => AddListUpdateHandler(args);

        IEnumerator<IChannelMessage> IEnumerable<IChannelMessage>.GetEnumerator() => GetEnumerator();
    }
}
