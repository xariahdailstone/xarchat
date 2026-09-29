using System;
using System.Collections.Generic;
using System.Text;

namespace XarChat.Backend.Common
{
    public static class TaskUtil
    {
        public static Task<Task> WhenAnyWithCancellation(
            CancellationToken cancellationToken, params Task[] tasks)
            => WhenAnyWithCancellation(tasks, cancellationToken);

        public static async Task<Task> WhenAnyWithCancellation(
            IEnumerable<Task> tasks, CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            var allTasksWithCancelTask = new List<Task>(tasks)
            {
                Task.Delay(-1, cts.Token)
            };

            var completedTask = await Task.WhenAny(allTasksWithCancelTask);
            if (cancellationToken.IsCancellationRequested)
            {
                throw new OperationCanceledException(cancellationToken);
            }
            return completedTask;
        }

        public static Task WhenAllWithCancellation(
            CancellationToken cancellationToken, params Task[] tasks)
            => WhenAllWithCancellation(tasks, cancellationToken);

        public static async Task WhenAllWithCancellation(
            IEnumerable<Task> tasks, CancellationToken cancellationToken)
        {
            var walltask = Task.WhenAll(tasks);
            await TaskUtil.WhenAnyWithCancellation(new List<Task>() { walltask }, cancellationToken);
        }
    }
}
