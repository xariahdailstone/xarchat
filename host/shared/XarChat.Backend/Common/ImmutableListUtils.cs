using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Common
{
    internal static class ImmutableListUtils
    {
        public static void BusyLoopAdd<T>(ref IImmutableList<T> list, T valueToAdd)
        {
            IImmutableList<T> origList;
            IImmutableList<T> modifiedList;
            do
            {
                origList = list;
                modifiedList = list.Add(valueToAdd);
            } while (Interlocked.CompareExchange(ref list, modifiedList, origList) != origList);
        }
    }
}
