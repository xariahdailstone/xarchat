namespace XarChat.FList2.FList2Connection
{
    public interface IObservableList<out T> : IReadOnlyList<T>
    {
        IDisposable AddListUpdateHandler(Action<IListUpdateEventArgs<T>> args);
    }
}
