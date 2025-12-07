using XarChat.FList2.Common;
using System.Diagnostics.CodeAnalysis;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultJoinedCharacterChatList : ObservableList<DefaultJoinedCharacterChat>, IJoinedCharacterChatList
    {
        IJoinedCharacterChat IReadOnlyList<IJoinedCharacterChat>.this[int index] => this[index];

        public IDisposable AddListUpdateHandler(Action<IListUpdateEventArgs<IJoinedCharacterChat>> args)
            => this.AddListUpdateHandler(args);

        public bool TryGetById(CharacterId id, [NotNullWhen(true)] out DefaultJoinedCharacterChat? result)
        {
            var m = this.Where<DefaultJoinedCharacterChat>(cc => cc.CharacterId == id).FirstOrDefault();
            if (m is not null)
            {
                result = m;
                return true;
            }
            result = default;
            return false;
        }

        public bool TryGetByName(CharacterName characterName, [NotNullWhen(true)] out DefaultJoinedCharacterChat? result)
        {
            var m = this.Where<DefaultJoinedCharacterChat>(cc => cc.CharacterName == characterName).FirstOrDefault();
            if (m is not null)
            {
                result = m;
                return true;
            }
            result = default;
            return false;
        }

        IEnumerator<IJoinedCharacterChat> IEnumerable<IJoinedCharacterChat>.GetEnumerator() => GetEnumerator();
    }
}
