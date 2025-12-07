using XarChat.FList2.Common;
using System.Collections;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class ObservableList<T> : IList<T>, IObservableList<T>
    {
        private readonly List<T> _inner = new List<T>();

        public T this[int index] 
        {
            get => _inner[index];
            set => throw new NotImplementedException();
        }

        public int Count => _inner.Count;

        public bool IsReadOnly => false;

        public void Add(T item)
        {
            _inner.Add(item);
            _updateListeners.Invoke(new ListUpdateEventArgs<T>(ListUpdateAction.Added, item, this.Count - 1));
        }

        private readonly CallbackSet<IListUpdateEventArgs<T>> _updateListeners = new();

        public IDisposable AddListUpdateHandler(Action<IListUpdateEventArgs<T>> args)
            => _updateListeners.Add(args);

        public void Clear()
        {
            var items = _inner.ToArray();
            _inner.Clear();
            for (var i = items.Length - 1; i >= 0; i--)
            {
                _updateListeners.Invoke(new ListUpdateEventArgs<T>(ListUpdateAction.Removed, items[i], i));
            }
        }

        public bool Contains(T item)
        {
            return _inner.Contains(item);
        }

        public void CopyTo(T[] array, int arrayIndex)
        {
            _inner.CopyTo(array, arrayIndex);
        }

        public IEnumerator<T> GetEnumerator()
        {
            return _inner.GetEnumerator();
        }

        public int IndexOf(T item)
        {
            return _inner.IndexOf(item);
        }

        public void Insert(int index, T item)
        {
            _inner.Insert(index, item);
            _updateListeners.Invoke(new ListUpdateEventArgs<T>(ListUpdateAction.Added, item, index));
        }

        public bool Remove(T item)
        {
            var index = _inner.IndexOf(item);
            if (index != -1)
            {
                _inner.RemoveAt(index);
                return true;
            }
            return false;
        }

        public void RemoveAt(int index)
        {
            var item = _inner[index];
            _inner.RemoveAt(index);
            _updateListeners.Invoke(new ListUpdateEventArgs<T>(ListUpdateAction.Removed, item, index));
        }

        public T[] ToArray()
        {
            var arr = new T[_inner.Count];
            this.CopyTo(arr, 0);
            return arr;
        }

        IEnumerator IEnumerable.GetEnumerator()
        {
            return _inner.GetEnumerator();
        }
    }
}
