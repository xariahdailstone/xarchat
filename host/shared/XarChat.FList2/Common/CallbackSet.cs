using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Text;

namespace XarChat.FList2.Common
{
    internal class CallbackSet
    {
        private IImmutableDictionary<object, Action> _registeredCallbacks = ImmutableDictionary<object, Action>.Empty;

        private void SpinLoopUpdateDictionary(Func<IImmutableDictionary<object, Action>, IImmutableDictionary<object, Action>> updateFunc)
        {
            while (true)
            {
                var curValue = _registeredCallbacks;
                var newValue = updateFunc(curValue);
                if (curValue == newValue)
                {
                    break;
                }
                if (Interlocked.CompareExchange(ref _registeredCallbacks, newValue, curValue) == curValue)
                {
                    break;
                }
            }
        }

        public IDisposable Add(Action callback)
        {
            var myKey = new object();
            SpinLoopUpdateDictionary(oldValue => oldValue.Add(myKey, callback));

            return new ActionDisposable(() =>
            {
                SpinLoopUpdateDictionary(oldValue => oldValue.Remove(myKey));
            });
        }

        public void Invoke()
        {
            var callbacks = _registeredCallbacks;
            foreach (var value in callbacks.Values)
            {
                try { value(); }
                catch { }
            }
        }
    }

    internal class CallbackSet<TArg>
    {
        private IImmutableDictionary<object, Action<TArg>> _registeredCallbacks = ImmutableDictionary<object, Action<TArg>>.Empty;

        private void SpinLoopUpdateDictionary(Func<IImmutableDictionary<object, Action<TArg>>, IImmutableDictionary<object, Action<TArg>>> updateFunc)
        {
            while (true)
            {
                var curValue = _registeredCallbacks;
                var newValue = updateFunc(curValue);
                if (curValue == newValue)
                {
                    break;
                }
                if (Interlocked.CompareExchange(ref _registeredCallbacks, newValue, curValue) == curValue)
                {
                    break;
                }
            }
        }

        public IDisposable Add(Action<TArg> callback)
        {
            var myKey = new object();
            SpinLoopUpdateDictionary(oldValue => oldValue.Add(myKey, callback));

            return new ActionDisposable(() =>
            {
                SpinLoopUpdateDictionary(oldValue => oldValue.Remove(myKey));
            });
        }

        public void Invoke(TArg arg)
        {
            var callbacks = _registeredCallbacks;
            foreach (var value in callbacks.Values)
            {
                try { value(arg); }
                catch { }
            }
        }
    }

    public class DisposablesSet : IDisposable
    {
        private bool _disposed = false;
        private readonly List<IDisposable> _disposables = new List<IDisposable>();

        public void Dispose()
        {
            if (!_disposed)
            {
                _disposed = true;
                foreach (var d in _disposables)
                {
                    try { d.Dispose(); }
                    catch { }
                }
                _disposables.Clear();
            }
        }

        public IDisposable Add(IDisposable disposable)
        {
            if (_disposed) { throw new ObjectDisposedException(GetType().Name); }
            _disposables.Add(disposable);
            return disposable;
        }

        public void Remove(IDisposable disposable)
        {
            _disposables.Remove(disposable);
        }
    }
}
