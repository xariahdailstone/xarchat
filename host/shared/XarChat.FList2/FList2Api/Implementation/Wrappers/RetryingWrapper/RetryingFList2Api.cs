using Nito.AsyncEx;
using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Text;
using System.Threading;
using System.Threading.Channels;
using XarChat.FList2.Common;
using XarChat.FList2.FList2Api.Implementation.Firehose;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Incoming;

namespace XarChat.FList2.FList2Api.Implementation.Wrappers.RetryingWrapper
{
    internal class RetryingFList2Api : FList2ApiWrapperBase
    {
        private readonly TimeSpan _retryDelay;
        private readonly Func<CancellationToken, Task<IFList2Api>> _recreateInnerFunc;
        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();

        public RetryingFList2Api(
            IFList2Api inner, 
            Func<CancellationToken, Task<IFList2Api>> recreateInnerFunc,
            TimeSpan retryDelay) 
            : base(inner)
        {
            _recreateInnerFunc = recreateInnerFunc;
            _retryDelay = retryDelay;

            _firehose = new RetryingFirehose(this);
            _firehose.SetInnerFirehose(inner.Firehose);
        }

        public override ValueTask DisposeAsync()
        {
            if (!_disposeCTS.IsCancellationRequested)
            {
                _disposeCTS.Cancel();
                _firehose.Dispose();
            }
            return base.DisposeAsync();
        }

        private readonly AsyncReaderWriterLock _reloginLock = new AsyncReaderWriterLock();
        private Task _reloggingInTask = Task.CompletedTask;

        private async Task PerformReloginAsync()
        {
            var cancellationToken = _disposeCTS.Token;
            var tcs = new TaskCompletionSource();
            _reloggingInTask = tcs.Task;
            try
            {
                await this.Inner.DisposeAsync();
                while (true)
                {
                    try
                    {
                        await Task.Delay(_retryDelay, cancellationToken);
                        this.Inner = await _recreateInnerFunc(cancellationToken);
                        tcs.SetResult();
                    }
                    catch
                    {
                        await Task.Delay(5000, cancellationToken);
                    }
                }
            }
            catch (Exception ex)
            {
                tcs.SetException(ex);
                throw;
            }
        }

        private async Task PerformWithRetryAsync(Func<IFList2Api, Task> asyncFunc, CancellationToken cancellationToken)
        {
            await PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                asyncFunc: async (api) =>
                {
                    await asyncFunc(api);
                    return 0;
                });
        }

        private async Task<TResult> PerformWithRetryAsync<TResult>(Func<IFList2Api, Task<TResult>> asyncFunc, CancellationToken cancellationToken)
        {
            var isFirstTry = true;
        TRYAGAIN:
            if (cancellationToken.IsCancellationRequested)
            {
                throw new OperationCanceledException(cancellationToken);
            }
            IFList2Api? innerApi = null;
            try
            {
                using var heldReadLock = await _reloginLock.ReaderLockAsync(cancellationToken);
                await await Task.WhenAny(_reloggingInTask, Task.Delay(-1, cancellationToken));
                innerApi = Inner;
                var result = await asyncFunc(innerApi);
                return result;
            }
            catch (HttpRequestException ex) when (isFirstTry && ex.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                using (var heldWriteLock = await _reloginLock.WriterLockAsync(cancellationToken))
                {
                    if (Inner == innerApi)
                    {
                        await await Task.WhenAny(PerformReloginAsync(), Task.Delay(-1, cancellationToken));
                    }
                }
                isFirstTry = false;
                goto TRYAGAIN;
            }
        }

        protected override Task InvokeInnerApiAsync(Func<IFList2Api, Task> asyncInnerInvocationFunc, CancellationToken cancellationToken)
        {
            return PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                asyncFunc: (api) => asyncInnerInvocationFunc(api));
        }

        protected override Task<TResult> InvokeInnerApiAsync<TArg0, TResult>(TArg0 arg0, Func<IFList2Api, TArg0, Task<TResult>> asyncInnerInvocationFunc, CancellationToken cancellationToken)
        {
            return PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                asyncFunc: (api) => asyncInnerInvocationFunc(api, arg0));
        }

        protected override Task InvokeInnerApiAsync<TArg0>(TArg0 arg0, Func<IFList2Api, TArg0, Task> asyncInnerInvocationFunc, CancellationToken cancellationToken)
        {
            return PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                asyncFunc: (api) => asyncInnerInvocationFunc(api, arg0));
        }

        protected override Task<TResult> InvokeInnerApiAsync<TResult>(Func<IFList2Api, Task<TResult>> asyncInnerInvocationFunc, CancellationToken cancellationToken)
        {
            return PerformWithRetryAsync(
                cancellationToken: cancellationToken,
                asyncFunc: (api) => asyncInnerInvocationFunc(api));
        }

        private readonly RetryingFirehose _firehose;

        public override IFirehose Firehose => _firehose;
    }

    internal class RetryingFirehose : IFirehose, IDisposable
    {
        private readonly RetryingFList2Api _owner;

        public RetryingFirehose(RetryingFList2Api owner)
        {
            _owner = owner;
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                lock (_lock)
                {
                    if (!_disposed)
                    {
                        _disposed = true;
                        this.FirehoseStatus = FirehoseStatus.Disconnected;
                        _firehoseChangeCTS.Cancel();
                    }
                }
            }
        }

        private object _lock = new object();
        private bool _disposed = false;
        private IFirehose? _innerFirehose;
        private IDisposable? _innerFirehoseStatusChangeHandlerRegistration;
        private CancellationTokenSource? _innerFirehoseReaderLoopCTS;

        private CancellationTokenSource _firehoseChangeCTS = new CancellationTokenSource();

        internal void SetInnerFirehose(IFirehose? innerFirehose)
        {
            lock (_lock)
            {
                if (_disposed)
                {
                    throw new ObjectDisposedException(GetType().Name);
                }

                _innerFirehoseStatusChangeHandlerRegistration?.Dispose();
                _innerFirehoseReaderLoopCTS?.Cancel();
                _innerFirehoseReaderLoopCTS?.Dispose();

                _innerFirehoseStatusChangeHandlerRegistration = null;
                _innerFirehose = innerFirehose;

                _firehoseChangeCTS.Cancel();
                _firehoseChangeCTS.Dispose();
                _firehoseChangeCTS = new CancellationTokenSource();

                if (_innerFirehose == null)
                {
                    this.FirehoseStatus = FirehoseStatus.Connecting;
                }
                else
                {
                    _innerFirehoseStatusChangeHandlerRegistration = _innerFirehose.AddFirehoseStatusChangedHandler(oldNew =>
                    {
                        this.FirehoseStatus = oldNew.NewValue;
                    });

                    _innerFirehoseReaderLoopCTS = new CancellationTokenSource();
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            using var innerReader = await _innerFirehose.CreateReader(_innerFirehoseReaderLoopCTS.Token);
                            await DistributeToFirehoseReaders(new FirehoseBrokenMessage(), _innerFirehoseReaderLoopCTS.Token);
                            while (true)
                            {
                                var msg = await innerReader.ReadAsync(_innerFirehoseReaderLoopCTS.Token);
                                if (msg is null) { break; }
                                await DistributeToFirehoseReaders(msg, _innerFirehoseReaderLoopCTS.Token);
                            }
                        }
                        catch when (_innerFirehoseReaderLoopCTS.IsCancellationRequested) { }
                    });

                    this.FirehoseStatus = _innerFirehose.FirehoseStatus;
                }
            }
        }

        private async Task DistributeToFirehoseReaders(IFirehoseIncomingMessage message, CancellationToken cancellationToken)
        {
            List<RetryingFirehoseReader> fhReaders;
            lock (_firehoseReaders)
            {
                fhReaders = _firehoseReaders.Values.ToList();
            }
            foreach (var reader in fhReaders)
            {
                try { await reader.EnqueueMessage(message, cancellationToken); }
                catch { }
            }
        }

        public FirehoseStatus FirehoseStatus
        {
            get => field;
            set
            {
                if (field != value)
                {
                    var oldValue = field;
                    field = value;
                    InvokeStatusChangeHandlers(oldValue, value);
                }
            }
        }

        private IImmutableDictionary<object, Action<OldNew<FirehoseStatus>>> _statusChangeHandlers
            = ImmutableDictionary<object, Action<OldNew<FirehoseStatus>>>.Empty;

        private void InvokeStatusChangeHandlers(FirehoseStatus oldValue, FirehoseStatus newValue)
        {
            var schDict = _statusChangeHandlers;
            foreach (var sch in schDict.Values)
            {
                try
                {
                    sch(new(oldValue, newValue));
                }
                catch { }
            }
        }

        public IDisposable AddFirehoseStatusChangedHandler(Action<OldNew<FirehoseStatus>> callback)
        {
            var myKey = new object();
            lock (_lock)
            {
                _statusChangeHandlers = _statusChangeHandlers.Add(myKey, callback);
            }
            return new ActionDisposable(() =>
            {
                lock (_lock)
                {
                    _statusChangeHandlers = _statusChangeHandlers.Remove(myKey);
                }
            });
        }

        private async Task<TResult> WithCurrentFirehoseAsync<TResult>(
            Func<IFirehose, bool, CancellationToken, Task<TResult>> asyncFunc,
            CancellationToken cancellationToken)
        {
            IFirehose? firehose;
            CancellationToken firehoseCancellation;

            var isFirstTry = true;
            while (true)
            {
                lock (_lock)
                {
                    if (_disposed)
                    {
                        throw new ObjectDisposedException(GetType().Name);
                    }
                    firehose = _innerFirehose;
                    firehoseCancellation = _firehoseChangeCTS.Token;
                }

                using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, firehoseCancellation);

                try
                {
                    if (firehose is not null)
                    {
                        var result = await asyncFunc(firehose, isFirstTry, combinedCTS.Token);
                        return result;
                    }
                    else
                    {
                        await Task.Delay(-1, combinedCTS.Token);
                    }
                }
                catch when (firehoseCancellation.IsCancellationRequested) 
                {
                    isFirstTry = false;
                }
            }
        }

        private class RetryingFirehoseReader : IFirehoseReader
        {
            private readonly Action _onDisposeFunc;
            private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();

            private readonly Channel<IFirehoseIncomingMessage> _messageBufferChannel = Channel.CreateUnbounded<IFirehoseIncomingMessage>();

            public RetryingFirehoseReader(Action onDisposeFunc)
            {
                _onDisposeFunc = onDisposeFunc;
            }

            public void Dispose()
            {
                if (!_disposeCTS.IsCancellationRequested)
                {
                    _disposeCTS.Cancel();
                    _onDisposeFunc();
                }
            }

            public async Task EnqueueMessage(IFirehoseIncomingMessage message, CancellationToken cancellationToken)
            {
                await _messageBufferChannel.Writer.WriteAsync(message, cancellationToken);
            }

            public async Task<IFirehoseIncomingMessage?> ReadAsync(CancellationToken cancellationToken)
            {
                using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
                var result = await _messageBufferChannel.Reader.ReadAsync(combinedCTS.Token);
                return result;
            }
        }

        private readonly Dictionary<object, RetryingFirehoseReader> _firehoseReaders
            = new Dictionary<object, RetryingFirehoseReader>();

        public async Task<IFirehoseReader> CreateReader(CancellationToken cancellationToken)
        {
            var myKey = new object();
            var result = new RetryingFirehoseReader(() =>
            {
                lock (_firehoseReaders)
                { 
                    _firehoseReaders.Remove(myKey);
                }
            });

            lock (_firehoseReaders)
            {
                _firehoseReaders.Add(myKey, result);
            }
            return result;
        }

        public async Task WriteAsync(IFirehoseOutgoingMessage message, CancellationToken cancellationToken)
        {
            await WithCurrentFirehoseAsync(
                cancellationToken: cancellationToken,
                asyncFunc: async (fh, isFirstTry, cancellationToken) =>
                {
                    await fh.WriteAsync(message, cancellationToken);
                    return 0;
                });
        }
    }
}
