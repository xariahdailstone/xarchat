using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common;

namespace XarChat.Backend.Features.TimingSet.Impl
{
    internal class TimingSetFactoryImpl : ITimingSetFactory
    {
        public ITimingSet CreateTimingSet() => new TimingSetImpl();
    }

    internal class TimingSetImpl : ITimingSet
    {
        private IImmutableList<TimedOperationEntry> _timedOperations
            = ImmutableList<TimedOperationEntry>.Empty;

        public IDisposable BeginTimingOperation(string name)
        {
            var sw = new Stopwatch();
            var toe = new TimedOperationEntry(name, DateTime.UtcNow, sw);
            ImmutableListUtils.BusyLoopAdd(ref _timedOperations, toe);

            sw.Start();
            return new ActionDisposable(() =>
            {
                sw.Stop();
            });
        }

        public TimedOperationInfo[] GetTimedOperations()
        {
            var list = _timedOperations;
            var result = new TimedOperationInfo[list.Count];
            for (var i = 0; i < list.Count; i++)
            {
                var toe = list[i];
                result[i] = new TimedOperationInfo(toe.Name, toe.StartedAt, toe.Stopwatch.Elapsed);
            }
            return result;
        }
    }

    internal record struct TimedOperationEntry(string Name, DateTime StartedAt, Stopwatch Stopwatch)
    {
    }
}
