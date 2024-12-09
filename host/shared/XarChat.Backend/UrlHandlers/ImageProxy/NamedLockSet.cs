using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common;

namespace XarChat.Backend.UrlHandlers.ImageProxy
{
    internal class NamedLockSet
    {
        private Dictionary<string, Queue<TaskCompletionSource>> _locks
            = new Dictionary<string, Queue<TaskCompletionSource>>();

        public async Task<IDisposable> AcquireLockAsync(string name, CancellationToken cancellationToken)
        {
            TaskCompletionSource? tcs = null;

            lock (_locks)
            {
                if (_locks.TryGetValue(name, out var waiters))
                {
                    tcs = new TaskCompletionSource();
                    waiters.Enqueue(tcs);
                }
                else
                {
                    _locks.Add(name, new Queue<TaskCompletionSource>());
                }
            }

            if (tcs != null)
            {
                using var cancelReg = cancellationToken.Register(() => { tcs.TrySetCanceled(); });
                await tcs.Task;
            }

            return new ActionDisposable(() =>
            {
                while (true)
                {
                    TaskCompletionSource? tcs = null;
                    lock (_locks)
                    {
                        if (_locks.TryGetValue(name, out var waiters))
                        {
                            if (waiters.Count == 0)
                            {
                                _locks.Remove(name);
                                tcs = null;
                            }
                            else
                            {
								tcs = waiters.Dequeue();
                            }
                        }
                        else
                        {
                            tcs = null;
                        }
                    }
                    if (tcs != null && tcs.TrySetResult())
                    {
                        return;
                    }
                    else if (tcs == null)
                    {
                        return;
                    }
                }
            });
        }
    }
}
