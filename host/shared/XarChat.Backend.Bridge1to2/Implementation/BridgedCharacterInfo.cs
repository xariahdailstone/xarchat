using System.Diagnostics.CodeAnalysis;
using XarChat.Backend.Bridge1to2.Messages.Server;
using XarChat.Backend.Bridge1to2.StrongTypes;
using XarChat.FList2.Common.StrongTypes;
using XarChat.FList2.FList2Api.Entities;

namespace XarChat.Backend.Bridge1to2.Implementation
{
    internal class BridgedCharacterInfoCollection
    {
        private List<BridgedCharacterInfo> _charInfos = new List<BridgedCharacterInfo>();
        private ReaderWriterLock _charInfosRWLock = new ReaderWriterLock();

        public async Task AddAsync(BridgedCharacterInfo bci, CancellationToken cancellationToken)
        {
            _charInfosRWLock.AcquireWriterLock(-1);
            try
            {
                _charInfos.Add(bci);
                bci.Owner = this;
                await MaybeSendUpdateAsync(bci, cancellationToken);
            }
            finally
            {
                _charInfosRWLock.ReleaseWriterLock();
            }
        }

        private ClientMessageProcessingArgs? _cargs = null;

        public async Task SetClientMessageProcessingArgs(ClientMessageProcessingArgs cargs)
        {
            _cargs = cargs;
            foreach (var bci in _charInfos)
            {
                await MaybeSendUpdateAsync(bci, cargs.CancellationToken);
            }
        }

        internal async Task MaybeSendUpdateAsync(BridgedCharacterInfo bci, CancellationToken cancellationToken)
        {
            if (this._cargs is not null)
            {
                if (bci.LastSentCharacterStatus != bci.CharacterStatus ||
                    bci.LastSentStatusMessage != bci.StatusMessage)
                {
                    if (bci.LastSentCharacterStatus == CharacterStatus.OFFLINE &&
                        bci.CharacterStatus != CharacterStatus.OFFLINE)
                    {
                        bci.LastSentStatusMessage = "";
                        bci.LastSentCharacterStatus = CharacterStatus.ONLINE;

                        // Send NLN
                        await this._cargs.WriteMessageFunc(
                            new NLNServerMessage()
                            {
                                Identity = bci.CharacterName,
                                Gender = CharacterGender.Parse(bci.GenderColor ?? CharacterGender.UnknownGenderColor),
                                Status = CharacterStatus.ONLINE.ToFL1CharacterStatus()
                            }, cancellationToken);
                    }
                    else if (bci.LastSentCharacterStatus != CharacterStatus.OFFLINE &&
                        bci.CharacterStatus == CharacterStatus.OFFLINE)
                    {
                        bci.LastSentStatusMessage = "";
                        bci.LastSentCharacterStatus = CharacterStatus.OFFLINE;

                        // Send FLN
                        await this._cargs.WriteMessageFunc(
                            new FLNServerMessage()
                            {
                                Character = bci.CharacterName
                            }, cancellationToken);
                    }

                    if (bci.CharacterStatus != CharacterStatus.OFFLINE)
                    {
                        if (bci.LastSentCharacterStatus != bci.CharacterStatus ||
                            (bci.LastSentStatusMessage ?? "") != (bci.StatusMessage ?? ""))
                        {
                            bci.LastSentCharacterStatus = bci.CharacterStatus;
                            bci.LastSentStatusMessage = bci.StatusMessage ?? "";

                            // Send STA
                            await this._cargs.WriteMessageFunc(
                                new STAServerMessage()
                                {
                                    Character = bci.CharacterName,
                                    Status = bci.CharacterStatus.ToFL1CharacterStatus(),
                                    StatusMessage = bci.StatusMessage ?? ""
                                },
                                cancellationToken);
                        }
                    }
                }
            }
        }

        public bool TryGetBridgedCharacterInfo(
            Func<BridgedCharacterInfo, bool> predicate, [NotNullWhen(true)] out BridgedCharacterInfo? bridgedCharacterInfo)
        {
            _charInfosRWLock.AcquireReaderLock(-1);
            try
            {
                foreach (var bci in _charInfos)
                {
                    if (predicate(bci))
                    {
                        bridgedCharacterInfo = bci;
                        return true;
                    }
                }
                bridgedCharacterInfo = null;
                return false;
            }
            finally
            {
                _charInfosRWLock.ReleaseReaderLock();
            }
        }

        public bool TryGetBridgedCharacterInfo(CharacterId fl2CharacterId, [NotNullWhen(true)] out BridgedCharacterInfo? bridgedCharacterInfo)
            => TryGetBridgedCharacterInfo(bci => bci.CharacterId == fl2CharacterId, out bridgedCharacterInfo);

        public bool TryGetBridgedCharacterInfo(CharacterName characterName, [NotNullWhen(true)] out BridgedCharacterInfo? bridgedCharacterInfo)
            => TryGetBridgedCharacterInfo(bci => bci.CharacterName == characterName, out bridgedCharacterInfo);
    }

    internal class BridgedCharacterInfo
    {
        public BridgedCharacterInfo(
            CharacterId characterId,
            CharacterName characterName,
            string? avatarUrlPath = null,
            string? genderColor = null,
            CharacterStatus? characterStatus = null,
            string? statusMessage = null)
        {
            this.CharacterId = characterId;
            this.CharacterName = characterName;
            this.AvatarUrlPath = avatarUrlPath;
            this.GenderColor = genderColor;
            this.CharacterStatus = characterStatus ?? CharacterStatus.OFFLINE;
            this.StatusMessage = statusMessage;
        }

        public CharacterId CharacterId { get; private set; }

        public CharacterName CharacterName { get; private set; }

        public string? AvatarUrlPath { get; private set; }

        public string? GenderColor { get; private set; }

        public CharacterStatus CharacterStatus { get; private set; } = CharacterStatus.OFFLINE;

        public string? StatusMessage { get; private set; }


        public bool HasOpenPMConversation { get; set; }


        public BridgedCharacterInfoCollection? Owner { get; set; }

        public CharacterStatus LastSentCharacterStatus { get; set; } = CharacterStatus.OFFLINE;

        public string? LastSentStatusMessage { get; set; }

        public async Task UpdateDataAsync(
            CharacterName? characterName = null,
            string? avatarUrlPath = null,
            string? genderColor = null,
            CharacterStatus? characterStatus = null,
            string? statusMessage = null,
            CancellationToken cancellationToken = default)
        {
            this.CharacterName = characterName ?? this.CharacterName;
            this.AvatarUrlPath = avatarUrlPath ?? this.AvatarUrlPath;
            this.GenderColor = genderColor ?? this.GenderColor;
            this.CharacterStatus = characterStatus ?? this.CharacterStatus;
            this.StatusMessage = statusMessage ?? this.StatusMessage;
            if (this.Owner is not null)
            {
                await this.Owner.MaybeSendUpdateAsync(this, cancellationToken);
            }
        }

    }
}
