using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Channels;

namespace XarChat.Backend.Common
{
    public class BatchingChannel<T>
    {
        private readonly SemaphoreSlim _sem = new SemaphoreSlim(1);

        private readonly Channel<List<T>> _innerChannel
            = Channel.CreateUnbounded<List<T>>();

        private List<T>? _currentList = null;

        public BatchingChannel()
        {
            this.Writer = new BatchingChannelWriter<T>(this);
            this.Reader = new BatchingChannelReader<T>(this);
        }

        public BatchingChannelWriter<T> Writer { get; }

        public BatchingChannelReader<T> Reader { get; }

        internal async Task AddItemAsync(T item, CancellationToken cancellationToken)
        {
            await _sem.WaitAsync(cancellationToken);
            try
            {
                if (_currentList is null)
                {
                    var newList = new List<T>();
                    await _innerChannel.Writer.WriteAsync(newList, cancellationToken);
                    _currentList = newList;
                }
                _currentList.Add(item);
            }
            finally
            {
                _sem.Release();
            }
        }

        internal async Task<IReadOnlyList<T>> GetBatchAsync(CancellationToken cancellationToken)
        {
            var xlist = await _innerChannel.Reader.ReadAsync(cancellationToken);

            await _sem.WaitAsync(CancellationToken.None);
            try
            {
                _currentList = null;
            }
            finally
            {
                _sem.Release();
            }

            return xlist;
        }
    }

    public class BatchingChannelWriter<T>(BatchingChannel<T> owner)
    {
        public async Task WriteAsync(T item, CancellationToken cancellationToken)
        {
            await owner.AddItemAsync(item, cancellationToken);
        }
    }

    public class BatchingChannelReader<T>(BatchingChannel<T> owner)
    {
        public async Task<IReadOnlyList<T>> ReadAsync(CancellationToken cancellationToken)
        {
            var res = await owner.GetBatchAsync(cancellationToken);
            return res;
        }

        public async IAsyncEnumerable<IReadOnlyList<T>> ReadAllAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            while (true)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    throw new OperationCanceledException(cancellationToken);
                }

                var res = await owner.GetBatchAsync(cancellationToken);
                yield return res;
            }
        }
    }
}
