using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.TimingSet
{
    public interface ITimingSetFactory
    {
        ITimingSet CreateTimingSet();
    }

    public interface ITimingSet
    {
        IDisposable BeginTimingOperation(string name);

        TimedOperationInfo[] GetTimedOperations();
    }

    public record struct TimedOperationInfo(string Name, DateTime StartedAt, TimeSpan Elapsed);

    public static class TimingSetExtensions
    {
        public static async Task TimeOperationAsync(
            this ITimingSet timingSet,
            string name, Func<Task> action)
        {
            await timingSet.TimeOperationAsync(name, async () =>
            {
                await action();
                return 0;
            });
        }

        public static async Task<T> TimeOperationAsync<T>(
            this ITimingSet timingSet,
            string name, Func<Task<T>> action)
        {
            T result;
            using (var to = timingSet.BeginTimingOperation(name))
            {
                result = await action();
            }
            return result;
        }
    }
}
