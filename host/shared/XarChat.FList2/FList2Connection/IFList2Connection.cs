using XarChat.FList2.Common;
using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Firehose;
using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Text;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection
{
    public interface IFList2Connection : IAsyncDisposable
    {
        Task RefreshChatStateAsync(CancellationToken cancellationToken);

        ConnectionState ConnectionState { get; }

        IDisposable AddConnectionStateChangedHandler(Action<OldNew<ConnectionState>> handler);

        IJoinedCharacterChatList ConnectedCharacters { get; }

        //ICharacterPresenceSet CharacterPresenceSet { get; }
    }

    public interface ICharacterPresenceSet
    {
        IFList2Connection FList2Connection { get; }

        IEnumerable<ICharacterInfoWithPresence> EnumerateKnownCharacters();

        bool TryGetById(CharacterId id, [NotNullWhen(true)] out ICharacterInfoWithPresence? characterInfo);

        bool TryGetByName(CharacterName name, [NotNullWhen(true)] out ICharacterInfoWithPresence? characterInfo);

        IDisposable AddAnyCharacterPresenceChangedHandler(Action<OldNew<ICharacterInfoWithPresence?>> handler);
    }

    public interface ICharacterInfoWithPresence
    {
        CharacterId CharacterId { get; }

        CharacterName CharacterName { get; }

        string AvatarUrlPath { get; }

        CharacterStatus CharacterStatus { get; }

        string? StatusMessage { get; }

        IDisposable AddCharacterPresenceChangedHandler(Action<EventArgs> handler);
    }
}
