using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Common;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers
{
    public abstract class XCHostCommandHandlerBase : IXCHostCommandHandler
    {
        private static readonly Dictionary<Type, AsyncWorkQueue<int>> _serialHandlerQueues
            = new Dictionary<Type, AsyncWorkQueue<int>>();

        protected async Task ExecuteMaybeInSerialAsync(Func<Task> func, CancellationToken cancellationToken)
        {
            if (this.RunInSerial)
            {
                AsyncWorkQueue<int>? queue;
                lock (_serialHandlerQueues)
                {
                    if (!_serialHandlerQueues.TryGetValue(this.GetType(), out queue))
                    {
                        queue = new AsyncWorkQueue<int>();
                    }
                }
                
                await queue.PerformWorkAsync(async () =>
                {
                    await func();
                    return 0;
                }, cancellationToken);
            }
            else
            {
                await func();
            }
        }

        public virtual bool RunAsynchronously => false;

        protected virtual bool RunInSerial => false;

        public async Task HandleCommandAsync(XCHostCommandContext context, CancellationToken cancellationToken)
        {
            this.CommandContext = context;
            await ExecuteMaybeInSerialAsync(async () =>
            {
                await HandleCommandAsync(cancellationToken);
            }, cancellationToken);
        }

        protected XCHostCommandContext CommandContext { get; private set; } = null!;

        protected abstract Task HandleCommandAsync(CancellationToken cancellationToken);
    }

    public abstract class AsyncXCHostCommandHandlerBase : XCHostCommandHandlerBase
    {
        public override bool RunAsynchronously => true;
    }

    public abstract class XCHostCommandHandlerBase<TArgs> : IXCHostCommandHandler
    {
        private static readonly Dictionary<Type, AsyncWorkQueue<int>> _serialHandlerQueues
            = new Dictionary<Type, AsyncWorkQueue<int>>();

        protected async Task ExecuteMaybeInSerialAsync(Func<Task> func, CancellationToken cancellationToken)
        {
            if (this.RunInSerial)
            {
                AsyncWorkQueue<int>? queue;
                lock (_serialHandlerQueues)
                {
                    if (!_serialHandlerQueues.TryGetValue(this.GetType(), out queue))
                    {
                        queue = new AsyncWorkQueue<int>();
                    }
                }

                await queue.PerformWorkAsync(async () =>
                {
                    await func();
                    return 0;
                }, cancellationToken);
            }
            else
            {
                await func();
            }
        }

        public virtual bool RunAsynchronously => false;

        protected virtual bool RunInSerial => false;

        public async Task HandleCommandAsync(XCHostCommandContext context, CancellationToken cancellationToken)
        {
            this.CommandContext = context;
            var jsonTypeInfo = SourceGenerationContext.Default.GetTypeInfo(typeof(TArgs))!;
            var args = (TArgs)JsonSerializer.Deserialize(context.Args, jsonTypeInfo)!;
            await ExecuteMaybeInSerialAsync(async () =>
            {
                await HandleCommandAsync(args, cancellationToken);
            }, cancellationToken);
        }

        protected XCHostCommandContext CommandContext { get; private set; } = null!;

        protected abstract Task HandleCommandAsync(TArgs args, CancellationToken cancellationToken);
    }

    public abstract class AsyncXCHostCommandHandlerBase<TArgs> : XCHostCommandHandlerBase<TArgs>
    {
        public override bool RunAsynchronously => true;
    }

    internal class AsyncWorkQueue<TResult>
    {
        private readonly object _lock = new object();
        private bool _backgroundRunLoopRunning = false;
        private Queue<QueuedTask> _queuedTasks = new Queue<QueuedTask>();

        private class QueuedTask 
        {
            private object _lock = new object();
            private bool _checkedOut = false;
            private bool _completed = false;

            private TaskCompletionSource<TResult> _resultTCS = new TaskCompletionSource<TResult>();

            public QueuedTask(Func<Task<TResult>> TaskFunc)
            {
                this.TaskFunc = TaskFunc;
            }

            public Func<Task<TResult>> TaskFunc { get; }

            public Task<TResult> ResultTask => _resultTCS.Task;

            public bool TryCancel(CancellationToken cancellationToken)
            {
                var shouldCancel = false;
                lock (_lock)
                {
                    if (!_checkedOut && !_completed)
                    {
                        _completed = true;
                        shouldCancel = true;
                    }
                }
                if (shouldCancel)
                {
                    return _resultTCS.TrySetCanceled(cancellationToken);
                }
                else
                {
                    return false;
                }
            }

            public bool TryCheckout()
            {
                var shouldCheckout = false;
                lock (_lock)
                {
                    if (!_checkedOut && !_completed)
                    {
                        _checkedOut = true;
                        shouldCheckout = true;
                    }
                }
                return shouldCheckout;
            }

            public bool TryComplete(TResult result)
            {
                var shouldComplete = false;
                lock (_lock)
                {
                    if (_checkedOut && !_completed)
                    {
                        _completed = true;
                        shouldComplete = true;
                    }
                }
                if (shouldComplete)
                {
                    return _resultTCS.TrySetResult(result);
                }
                else
                {
                    return false;
                }
            }

            public bool TryFail(Exception ex)
            {
                var shouldComplete = false;
                lock (_lock)
                {
                    if (_checkedOut && !_completed)
                    {
                        _completed = true;
                        shouldComplete = true;
                    }
                }
                if (shouldComplete)
                {
                    return _resultTCS.TrySetException(ex);
                }
                else
                {
                    return false;
                }
            }
        }

        public AsyncWorkQueue()
        {
        }

        public async Task<TResult> PerformWorkAsync(Func<Task<TResult>> func, CancellationToken cancellationToken)
        {
            var qt = new QueuedTask(func);

            lock (_lock)
            {
                _queuedTasks.Enqueue(qt);

                if (!_backgroundRunLoopRunning)
                {
                    _backgroundRunLoopRunning = true;
                    _ = Task.Run(BackgroundRunLoop);
                }
            }

            using var cancelReg = cancellationToken.Register(() => { qt.TryCancel(cancellationToken); });

            var result = await qt.ResultTask;
            return result;
        }

        private async Task BackgroundRunLoop()
        {
            try
            {
                QueuedTask? qt;
                do
                {
                    lock (_lock)
                    {
                        if (_queuedTasks.Count > 0)
                        {
                            qt = _queuedTasks.Dequeue();
                        }
                        else
                        {
                            qt = null;
                        }
                    }

                    if (qt is not null && qt.TryCheckout())
                    {
                        try
                        {
                            var tresult = await qt.TaskFunc();
                            qt.TryComplete(tresult);
                        }
                        catch (Exception ex)
                        {
                            qt.TryFail(ex);
                        }
                    }
                } while (qt is not null);
            }
            finally
            {
                lock (_lock)
                {
                    _backgroundRunLoopRunning = false;
                }
            }
        }
    }
}
