namespace XarChat.FList2.FList2Connection
{
    public interface IListUpdateEventArgs<out T>
    {
        ListUpdateAction Action { get; }

        T Item { get; }

        int Index { get; }
    }
}
