using XarChat.FList2.Common;
using XarChat.FList2.FList2Api.Implementation.Firehose;
using System.Collections.Immutable;
using System.Diagnostics.CodeAnalysis;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultCharacterPresenceSet : ICharacterPresenceSet
    {
        public DefaultCharacterPresenceSet(DefaultFList2Connection connection)
        {
            this.FList2Connection = connection;
        }

        internal DefaultFList2Connection FList2Connection { get; }

        private class ReferencedCharacterInfo
        {
            public ReferencedCharacterInfo(DefaultCharacterInfoWithPresence ciwp, ICharacterInfoWithPresenceSource initialReference)
            {
                this.DefaultCharacterInfoWithPresence = ciwp;
                this._referenceSet.Add(initialReference);
            }

            private IImmutableSet<ICharacterInfoWithPresenceSource> _referenceSet = ImmutableHashSet<ICharacterInfoWithPresenceSource>.Empty;

            public DefaultCharacterInfoWithPresence DefaultCharacterInfoWithPresence { get; }

            public int ReferenceCount => this._referenceSet.Count;

            public void AddReference(ICharacterInfoWithPresenceSource source)
            {
                ImmutableUtils.SetAdd(ref this._referenceSet, source);
            }

            public bool RemoveReference(ICharacterInfoWithPresenceSource source)
            {
                var resultingSet = ImmutableUtils.SetRemove(ref this._referenceSet, source);
                return resultingSet.Count == 0;
            }
        }

        private readonly object _mutateLock = new object();
        private ImmutableDictionary<CharacterId, ReferencedCharacterInfo> _charInfoById
            = ImmutableDictionary<CharacterId, ReferencedCharacterInfo>.Empty;
        private ImmutableDictionary<CharacterName, ReferencedCharacterInfo> _charInfoByName
            = ImmutableDictionary<CharacterName, ReferencedCharacterInfo>.Empty;

        private readonly CallbackSet<OldNew<ICharacterInfoWithPresence?>> _anyCharPresenceChangeHandlers = new();

        IFList2Connection ICharacterPresenceSet.FList2Connection => this.FList2Connection;

        public IDisposable AddAnyCharacterPresenceChangedHandler(Action<OldNew<ICharacterInfoWithPresence?>> handler)
            => _anyCharPresenceChangeHandlers.Add(handler);

        IEnumerable<ICharacterInfoWithPresence> ICharacterPresenceSet.EnumerateKnownCharacters()
            => this.EnumerateKnownCharacters();

        public IEnumerable<DefaultCharacterInfoWithPresence> EnumerateKnownCharacters()
            => _charInfoById.Values.Select(v => v.DefaultCharacterInfoWithPresence);

        bool ICharacterPresenceSet.TryGetById(CharacterId id, [NotNullWhen(true)] out ICharacterInfoWithPresence? characterInfo)
        {
            if (this.TryGetById(id, out var dciwp))
            {
                characterInfo = dciwp;
                return true;
            }
            else
            {
                characterInfo = default;
                return false;
            }
        }

        public bool TryGetById(CharacterId id, [NotNullWhen(true)] out DefaultCharacterInfoWithPresence? characterInfo)
        {
            if (_charInfoById.TryGetValue(id, out var cref))
            {
                characterInfo = cref.DefaultCharacterInfoWithPresence;
                return true;
            }
            else
            {
                characterInfo = default;
                return false;
            }
        }

        bool ICharacterPresenceSet.TryGetByName(CharacterName name, [NotNullWhen(true)] out ICharacterInfoWithPresence? characterInfo)
        {
            if (this.TryGetByName(name, out var dciwp))
            {
                characterInfo = dciwp;
                return true;
            }
            else
            {
                characterInfo = default;
                return false;
            }
        }

        public bool TryGetByName(CharacterName name, [NotNullWhen(true)] out DefaultCharacterInfoWithPresence? characterInfo)
        {
            if (_charInfoByName.TryGetValue(name, out var cref))
            {
                characterInfo = cref.DefaultCharacterInfoWithPresence;
                return true;
            }
            else
            {
                characterInfo = default;
                return false;
            }
        }

        internal IDisposable AddReferencedCharacter(ICharacterInfoWithPresenceSource source, DefaultCharacterInfoWithPresenceData pd)
        {
            var characterId = pd.CharacterId;
            var characterName = pd.CharacterName;

            lock (_mutateLock)
            {
                if (!_charInfoById.TryGetValue(characterId, out var refInfo))
                {
                    throw new NotImplementedException();
                    //refInfo = new ReferencedCharacterInfo(
                    //    new DefaultCharacterInfoWithPresence(), source);
                    //this._charInfoById = this._charInfoById.Add(characterId, refInfo);
                    //this._charInfoByName = this._charInfoByName.Add(characterName, refInfo);
                }
                else
                {
                    refInfo.AddReference(source);
                }
            }
            return new ActionDisposable(() =>
            {
                lock (_mutateLock)
                {
                    if (_charInfoById.TryGetValue(characterId, out var refInfo))
                    {
                        if (refInfo.RemoveReference(source))
                        {
                            _charInfoById = _charInfoById.Remove(characterId);
                            _charInfoByName = _charInfoByName.Remove(characterName);
                        }
                    }
                }
            });
        }
    }
}
