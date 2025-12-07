namespace XarChat.FList2.FList2Connection
{
    public class ListUpdateEventArgs<T> : IListUpdateEventArgs<T>
    {
        public ListUpdateEventArgs(ListUpdateAction action, T item, int index)
        {
            this.Action = action;
            this.Item = item;
            this.Index = index;
        }

        public ListUpdateAction Action { get; }

        public T Item { get; }

        public int Index { get; }
    }
}
