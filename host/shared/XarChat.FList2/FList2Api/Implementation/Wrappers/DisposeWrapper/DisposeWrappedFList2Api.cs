using System;
using System.Collections.Generic;
using System.Text;
using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Firehose;
using XarChat.FList2.FList2Api.Implementation.Wrappers;

namespace XarChat.FList2.FList2Api.Implementation.Wrappers.DisposeWrapper
{
    internal class DisposeWrappedFList2Api : FList2ApiWrapperBase
    {
        public DisposeWrappedFList2Api(IFList2Api inner) 
            : base(inner)
        {
        }

        private CancellationTokenSource _disposeCTS = new CancellationTokenSource();

        public override ValueTask DisposeAsync()
        {
            // DO NOT propogate disposal to inner api!

            if (!_disposeCTS.IsCancellationRequested)
            {
                _disposeCTS.Cancel();
                Disposed?.Invoke(this, EventArgs.Empty);
            }
            return ValueTask.CompletedTask;
        }

        public event EventHandler<EventArgs>? Disposed;

        private void ThrowIfDisposed()
        {
            if (_disposeCTS.IsCancellationRequested)
            {
                throw new ObjectDisposedException(GetType().Name);
            }
        }

        protected override Task InvokeInnerApiAsync(Func<IFList2Api, Task> asyncInnerInvocationFunc, CancellationToken cancellationToken)
        {
            ThrowIfDisposed();
            using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);

            return base.InvokeInnerApiAsync(asyncInnerInvocationFunc, combinedCTS.Token);
        }

        protected override Task<TResult> InvokeInnerApiAsync<TArg0, TResult>(TArg0 args, Func<IFList2Api, TArg0, Task<TResult>> asyncInnerInvocationFunc, CancellationToken cancellationToken)
        {
            ThrowIfDisposed();
            using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);

            return base.InvokeInnerApiAsync(args, asyncInnerInvocationFunc, combinedCTS.Token);
        }

        protected override Task InvokeInnerApiAsync<TArg0>(TArg0 args, Func<IFList2Api, TArg0, Task> asyncInnerInvocationFunc, CancellationToken cancellationToken)
        {
            ThrowIfDisposed();
            using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);

            return base.InvokeInnerApiAsync(args, asyncInnerInvocationFunc, combinedCTS.Token);
        }

        protected override Task<TResult> InvokeInnerApiAsync<TResult>(Func<IFList2Api, Task<TResult>> asyncInnerInvocationFunc, CancellationToken cancellationToken)
        {
            ThrowIfDisposed();
            using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);

            return base.InvokeInnerApiAsync(asyncInnerInvocationFunc, combinedCTS.Token);
        }
    }
}
