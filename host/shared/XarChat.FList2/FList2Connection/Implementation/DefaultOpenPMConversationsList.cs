using System.Diagnostics.CodeAnalysis;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultOpenPMConversationsList : ObservableList<DefaultOpenPMConversation>, IOpenPMConversationsList
    {
        IOpenPMConversation IReadOnlyList<IOpenPMConversation>.this[int index] => this[index];

        IDisposable IObservableList<IOpenPMConversation>.AddListUpdateHandler(Action<IListUpdateEventArgs<IOpenPMConversation>> args)
            => AddListUpdateHandler(args);

        IEnumerator<IOpenPMConversation> IEnumerable<IOpenPMConversation>.GetEnumerator() => GetEnumerator();

        public bool TryGetByInterlocutorId(CharacterId interlocutorCharacterId, [NotNullWhen(true)] out DefaultOpenPMConversation? convo)
        {
            foreach (var c in this)
            {
                if (c.Interlocutor.Id == interlocutorCharacterId)
                {
                    convo = c;
                    return true;
                }
            }
            convo = null;
            return false;
        }
    }
}
