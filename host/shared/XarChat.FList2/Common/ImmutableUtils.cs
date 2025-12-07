using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Text;

namespace XarChat.FList2.Common
{
    internal static class ImmutableUtils
    {
        public static IImmutableSet<T> SetAdd<T>(ref IImmutableSet<T> setRef, T item)
        {
            while (true)
            {
                var origValue = setRef;
                var newValue = origValue.Add(item);
                if (origValue == newValue) { return origValue; }
                if (Interlocked.CompareExchange(ref setRef, newValue, origValue) == origValue) { return newValue; }
            }
        }

        public static IImmutableSet<T> SetRemove<T>(ref IImmutableSet<T> setRef, T item)
        {
            while (true)
            {
                var origValue = setRef;
                var newValue = origValue.Remove(item);
                if (origValue == newValue) { return origValue; }
                if (Interlocked.CompareExchange(ref setRef, newValue, origValue) == origValue) { return newValue; }
            }
        }

    }
}
