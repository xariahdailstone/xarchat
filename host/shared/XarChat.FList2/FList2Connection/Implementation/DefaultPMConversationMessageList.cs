namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultPMConversationMessageList : ObservableList<DefaultPMConversationMessage>, IPMConversationMessageList
    {
        IPMConversationMessage IReadOnlyList<IPMConversationMessage>.this[int index] => this[index];

        IDisposable IObservableList<IPMConversationMessage>.AddListUpdateHandler(Action<IListUpdateEventArgs<IPMConversationMessage>> args)
            => AddListUpdateHandler(args);

        IEnumerator<IPMConversationMessage> IEnumerable<IPMConversationMessage>.GetEnumerator() => GetEnumerator();
    }
}
