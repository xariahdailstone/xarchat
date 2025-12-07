using XarChat.FList2.Common;
using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Connection.Implementation
{
    internal class DefaultCharacterInfoWithPresence : ICharacterInfoWithPresence
    {
        public DefaultCharacterInfoWithPresence(DefaultCharacterInfoWithPresenceData initData)
        {
            this.CharacterId = initData.CharacterId;
            this.CharacterName = initData.CharacterName;
            this.AvatarUrlPath = initData.AvatarUrlPath;
            this.CharacterStatus = initData.CharacterStatus;
            this.StatusMessage = initData.StatusMessage;
        }

        public CharacterId CharacterId { get; }

        public CharacterName CharacterName { get; }

        public string AvatarUrlPath { get; }

        public CharacterStatus CharacterStatus { get; set; }

        public string? StatusMessage { get; set; }

        public IDisposable AddCharacterPresenceChangedHandler(Action<EventArgs> handler)
        {
            throw new NotImplementedException();
        }
    }
}
