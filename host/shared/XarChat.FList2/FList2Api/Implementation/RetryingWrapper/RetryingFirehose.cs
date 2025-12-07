using XarChat.FList2.Common;
using XarChat.FList2.FList2Api.Implementation.Firehose;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages;
using System.Collections.Immutable;

namespace XarChat.FList2.FList2Api.Implementation.RetryingWrapper
{
    internal class RetryingFirehose : IFirehose, IDisposable
    {
        private readonly RetryingFList2Api _api;

        public RetryingFirehose(RetryingFList2Api retryingFList2Api)
        {
            this.FirehoseStatus = FirehoseStatus.Connecting;

            _api = retryingFList2Api;

            _api.ApiChanged += ParentApiChanged;
        }

        private void ParentApiChanged(object? sender, EventArgs e)
        {
            this.FirehoseStatus = FirehoseStatus.Connecting;

            _ = _api.DoWithCurrentFirehoseAsync(
                cancellationToken: _disposeCTS.Token,
                func: async (fh, cancellationToken) =>
                {
                    fh.AddFirehoseStatusChangedHandler(oldNew =>
                    {
                        if (!_isDisposed)
                        {
                            if (oldNew.NewValue == FirehoseStatus.Disconnected)
                            {
                                this.FirehoseStatus = FirehoseStatus.Connecting;
                            }
                            else
                            {
                                this.FirehoseStatus = oldNew.NewValue;
                            }
                        }
                    });
                    return 0;
                });
        }

        private bool _isDisposed = false;
        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();

        public void Dispose()
        {
            if (!_isDisposed)
            {
                Console.WriteLine("disposing " + GetType().Name);
                this.FirehoseStatus = FirehoseStatus.Disconnected;
                _isDisposed = true;
                _disposeCTS.Cancel();
            }
        }

        private void ThrowIfDisposed()
        {
            if (this._isDisposed)
            {
                throw new ObjectDisposedException(GetType().Name);
            }
        }

        public FirehoseStatus FirehoseStatus
        {
            get => field;
            private set
            {
                if (value != field)
                {
                    var oldValue = field;
                    field = value;
                    foreach (var handler in _changeHandlers.Values)
                    {
                        try { handler(new(oldValue, value)); }
                        catch { }
                    }
                }
            }
        }

        private IImmutableDictionary<object, Action<OldNew<FirehoseStatus>>> _changeHandlers
            = ImmutableDictionary<object, Action<OldNew<FirehoseStatus>>>.Empty;

        public IDisposable AddFirehoseStatusChangedHandler(Action<OldNew<FirehoseStatus>> callback)
        {
            var myKey = new object();
            while (true)
            {
                ThrowIfDisposed();
                var origValue = _changeHandlers;
                var newValue = _changeHandlers.SetItem(myKey, callback);
                if (newValue == origValue) { break; }
                if (Interlocked.CompareExchange(ref _changeHandlers, newValue, origValue) == origValue) { break; }
            }
            return new ActionDisposable(() =>
            {
                while (true)
                {
                    var origValue = _changeHandlers;
                    var newValue = _changeHandlers.Remove(myKey);
                    if (newValue == origValue) { break; }
                    if (Interlocked.CompareExchange(ref _changeHandlers, newValue, origValue) == origValue) { break; }
                }
            });
        }

        public async Task<IFirehoseIncomingMessage?> ReadAsync(CancellationToken cancellationToken)
        {
            using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);

            ThrowIfDisposed();

            var result = await _api.DoWithCurrentFirehoseAsync(
                cancellationToken: combinedCTS.Token,
                func: async (firehose, cancellationToken) =>
                {
                    ThrowIfDisposed();
                    try
                    {
                        var result = await firehose.ReadAsync(cancellationToken);
                        return result;
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("~~~ Firehose Read Failed: " + ex.GetType().Name + ": " + ex.Message);
                        throw;
                    }
                });
            return result;
        }

        public async Task WriteAsync(IFirehoseOutgoingMessage message, CancellationToken cancellationToken)
        {
            using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);

            ThrowIfDisposed();

            await _api.DoWithCurrentFirehoseAsync(
                cancellationToken: combinedCTS.Token,
                func: async (firehose, cancellationToken) =>
                {
                    ThrowIfDisposed();
                    await firehose.WriteAsync(message, cancellationToken);
                    return 0;
                });
        }
    }
}
