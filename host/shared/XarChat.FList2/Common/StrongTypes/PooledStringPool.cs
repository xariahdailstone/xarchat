using System.Collections.Immutable;

namespace XarChat.FList2.Common.StrongTypes
{
    public interface IHasWeakReference<T>
        where T : class
    {
        WeakReference<T> WeakReference { get; }
    }

    public class ObjectPool<T, TKeyType>
        where T : class, IHasWeakReference<T>
        where TKeyType : notnull
    {
        private readonly object _instancesLock = new object();
        private IImmutableDictionary<TKeyType, WeakReference<T>> _instances;

        public ObjectPool(IEqualityComparer<TKeyType> keyComparer)
        {
            this.KeyComparer = keyComparer;
            _instances = ImmutableDictionary<TKeyType, WeakReference<T>>.Empty.WithComparers(keyComparer);
        }

        public IEqualityComparer<TKeyType> KeyComparer { get; }

        public T GetOrCreate(TKeyType key, Func<TKeyType, T> createFunc, Action<T, TKeyType> maybeUpgradeFunc)
        {
            if (_instances.TryGetValue(key, out var wref) && wref.TryGetTarget(out var cachedItem))
            {
                maybeUpgradeFunc(cachedItem, key);
                return cachedItem;
            }
            lock (_instancesLock)
            {
                if (_instances.TryGetValue(key, out wref) && wref.TryGetTarget(out cachedItem))
                {
                    maybeUpgradeFunc(cachedItem, key);
                    return cachedItem;
                }

                var newItem = createFunc(key);
                _instances = _instances.SetItem(key, newItem.WeakReference);
                return newItem;
            }
        }

        internal void Evict(TKeyType key, WeakReference<T> weakReference)
        {
            if (_instances.TryGetValue(key, out var wref) && wref == weakReference)
            {
                lock (_instancesLock)
                {
                    if (_instances.TryGetValue(key, out wref) && wref == weakReference)
                    {
                        _instances = _instances.Remove(key);
                    }
                }
            }
        }
    }
}
