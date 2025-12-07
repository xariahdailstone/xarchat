using XarChat.FList2.Common;
using System.Diagnostics.CodeAnalysis;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection
{
    public static class ListExtensions
    {
        public static bool TryGetById(this IEnumerable<IJoinedCharacterChat> e, CharacterId id, [NotNullWhen(true)] out IJoinedCharacterChat? charChat)
            => e.TryGetWhere(cc => cc.CharacterId == id, out charChat);

        public static bool TryGetByName(this IEnumerable<IJoinedCharacterChat> e, CharacterName characterName, [NotNullWhen(true)] out IJoinedCharacterChat? charChat)
            => e.TryGetWhere(jcc => jcc.CharacterName == characterName, out charChat);

        public static bool TryGetById(this IEnumerable<IJoinedChannel> e, ChannelId id, [NotNullWhen(true)] out IJoinedChannel? joinedChannel)
            => e.TryGetWhere(jc => jc.ChannelId == id, out joinedChannel);

        public static bool TryGetByName(this IEnumerable<IJoinedChannel> e, ChannelName name, [NotNullWhen(true)] out IJoinedChannel? joinedChannel)
            => e.TryGetWhere(jc => jc.ChannelName == name, out joinedChannel);

        public static bool TryGetWhere<T>(this IEnumerable<T> e, Func<T, bool> predicate, [NotNullWhen(true)] out T? result)
            where T : class
        {
            foreach (var item in e)
            {
                if (predicate(item))
                {
                    result = item;
                    return true;
                }
            }
            result = default;
            return false;
        }

        public static IDisposable RegisterOnEveryItemLive<T>(this IObservableList<T> list, Func<T, IDisposable> registerFunc)
            where T : class
        {
            var hookedUpItems = new Dictionary<T, IDisposable>();

            var hookup = (T item) =>
            {
                if (!hookedUpItems.ContainsKey(item))
                {
                    var disposable = registerFunc(item);
                    hookedUpItems.Add(item, disposable);
                }
            };
            var unhook = (T item) =>
            {
                if (hookedUpItems.TryGetValue(item, out var unhookDisposable))
                {
                    hookedUpItems.Remove(item);
                    unhookDisposable.Dispose();
                }
            };

            var updateReg = list.AddListUpdateHandler(args =>
            {
                switch (args.Action)
                {
                    case ListUpdateAction.Added:
                        hookup(args.Item);
                        break;
                    case ListUpdateAction.Removed:
                        unhook(args.Item);
                        break;
                }
            });

            foreach (var item in list)
            {
                hookup(item);
            }

            return new ActionDisposable(onDispose: () =>
            {
                updateReg.Dispose();
                foreach (var v in hookedUpItems.Values)
                {
                    v.Dispose();
                }
                hookedUpItems.Clear();
            });
        }
    }
}
