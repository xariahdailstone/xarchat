using XarChat.FList2.Common;
using XarChat.FList2.FList2Api.Entities;

namespace XarChat.FList2.FList2Connection
{
    public interface IOpenPMConversation
    {
        IJoinedCharacterChat JoinedCharacterChat { get; }

        CharacterInfo Interlocutor { get; }

        IPMConversationMessageList Messages { get; }

        Task SendMessageAsync(string message, bool isEmote, CancellationToken cancellationToken);
    }
}
