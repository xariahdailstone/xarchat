using Nito.AsyncEx;
using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Bridge1to2.StrongTypes;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.Backend.Bridge1to2.Implementation
{
    internal class BridgedPMConvoInfoCollection
    {
        private List<BridgedPMConvoInfo> _pmConvoInfos = new List<BridgedPMConvoInfo>();
        private ReaderWriterLock _channelInfosRWLock = new ReaderWriterLock();

        public void Add(BridgedPMConvoInfo bci)
        {
            _channelInfosRWLock.AcquireWriterLock(-1);
            try
            {
                _pmConvoInfos.Add(bci);
            }
            finally
            {
                _channelInfosRWLock.ReleaseWriterLock();
            }
        }

        public bool TryGetBridgedPMConvoInfo(
            Func<BridgedPMConvoInfo, bool> predicate, [NotNullWhen(true)] out BridgedPMConvoInfo? bridgedPmConvoInfo)
        {
            _channelInfosRWLock.AcquireReaderLock(-1);
            try
            {
                foreach (var bci in _pmConvoInfos)
                {
                    if (predicate(bci))
                    {
                        bridgedPmConvoInfo = bci;
                        return true;
                    }
                }
                bridgedPmConvoInfo = null;
                return false;
            }
            finally
            {
                _channelInfosRWLock.ReleaseReaderLock();
            }
        }

        public bool TryGetBridgedPMConvoInfo(CharacterId characterId, [NotNullWhen(true)] out BridgedPMConvoInfo? bridgedPmConvoInfo)
            => TryGetBridgedPMConvoInfo(bci => bci.InterlocutorCharacterId == characterId, out bridgedPmConvoInfo);

        public bool TryGetBridgedPMConvoInfo(CharacterName characterName, [NotNullWhen(true)] out BridgedPMConvoInfo? bridgedPmConvoInfo)
            => TryGetBridgedPMConvoInfo(bci => bci.InterlocutorCharacterName == characterName, out bridgedPmConvoInfo);
    }

    internal class BridgedPMConvoInfo
    {
        public required CharacterId InterlocutorCharacterId { get; init; }
        public required CharacterName InterlocutorCharacterName { get; init; }

        private ReaderWriterLock _recentMessageIdsRWLock = new ReaderWriterLock();
        private HashSet<Guid> _recentMessageIds = new HashSet<Guid>();

        public void AbortClearTimers()
        {
            _recentMessageIdsRWLock.AcquireWriterLock(-1);
            try
            {
                _recentMessageIds = new HashSet<Guid>();
            }
            finally
            {
                _recentMessageIdsRWLock.ReleaseWriterLock();
            }
        }
        public bool HasRecentMessageId(Guid messageId)
        {
            _recentMessageIdsRWLock.AcquireReaderLock(-1);
            try
            {
                return _recentMessageIds.Contains(messageId);
            }
            finally
            {
                _recentMessageIdsRWLock.ReleaseReaderLock();
            }
        }
        public void AddRecentMessageId(Guid messageId)
        {
            _recentMessageIdsRWLock.AcquireWriterLock(-1);
            try
            {
                var rmids = _recentMessageIds;
                rmids.Add(messageId);
                _ = Task.Run(async () =>
                {
                    await Task.Delay(60_000);
                    _recentMessageIdsRWLock.AcquireWriterLock(-1);
                    try
                    {
                        if (_recentMessageIds == rmids)
                        {
                            rmids.Remove(messageId);
                        }
                    }
                    finally
                    {
                        _recentMessageIdsRWLock.ReleaseLock();
                    }
                });
            }
            finally
            {
                _recentMessageIdsRWLock.ReleaseWriterLock();
            }
        }
    }


    internal class BridgedChannelInfoCollection
    {
        private List<BridgedChannelInfo> _channelInfos = new List<BridgedChannelInfo>();
        private ReaderWriterLock _channelInfosRWLock = new ReaderWriterLock();

        public void Add(BridgedChannelInfo bci)
        {
            _channelInfosRWLock.AcquireWriterLock(-1);
            try
            {
                _channelInfos.Add(bci);
            }
            finally
            {
                _channelInfosRWLock.ReleaseWriterLock();
            }
        }

        public bool TryGetBridgedChannelInfo(
            Func<BridgedChannelInfo, bool> predicate, [NotNullWhen(true)] out BridgedChannelInfo? bridgedChannelInfo)
        {
            _channelInfosRWLock.AcquireReaderLock(-1);
            try
            {
                foreach (var bci in _channelInfos)
                {
                    if (predicate(bci))
                    {
                        bridgedChannelInfo = bci;
                        return true;
                    }
                }
                bridgedChannelInfo = null;
                return false;
            }
            finally
            {
                _channelInfosRWLock.ReleaseReaderLock();
            }
        }

        public bool TryGetBridgedChannelInfo(ChannelId fl2ChannelId, [NotNullWhen(true)] out BridgedChannelInfo? bridgedChannelInfo)
            => TryGetBridgedChannelInfo(bci => bci.FL2ChannelId == fl2ChannelId, out bridgedChannelInfo);

        public bool TryGetBridgedChannelInfo(FL1ChannelName fl1ChannelName, [NotNullWhen(true)] out BridgedChannelInfo? bridgedChannelInfo)
            => TryGetBridgedChannelInfo(bci => bci.FL1ChannelName == fl1ChannelName, out bridgedChannelInfo);
    }

    internal class BridgedChannelInfo
    {
        public required ChannelId FL2ChannelId { get; set; }

        public required ChannelName FL2ChannelName { get; set; }

        public required FL1ChannelName FL1ChannelName { get; set; }

        public required FL1ChannelTitle FL1ChannelTitle { get; set; }

        public required string Description { get; set; }

        public required bool WeAreInChannel { get; set; }


        public CharacterName? ChannelOwner { get; set; }

        public ISet<CharacterName> KnownChannelOps { get; } = new HashSet<CharacterName>();

        private ReaderWriterLock _recentMessageIdsRWLock = new ReaderWriterLock();
        private HashSet<Guid> _recentMessageIds = new HashSet<Guid>();
        
        public void AbortClearTimers()
        {
            _recentMessageIdsRWLock.AcquireWriterLock(-1);
            try
            {
                _recentMessageIds = new HashSet<Guid>();
            }
            finally
            {
                _recentMessageIdsRWLock.ReleaseWriterLock();
            }
        }
        public bool HasRecentMessageId(Guid messageId)
        {
            _recentMessageIdsRWLock.AcquireReaderLock(-1);
            try
            {
                return _recentMessageIds.Contains(messageId);
            }
            finally
            {
                _recentMessageIdsRWLock.ReleaseReaderLock();
            }
        }
        public void AddRecentMessageId(Guid messageId)
        {
            _recentMessageIdsRWLock.AcquireWriterLock(-1);
            try
            {
                var rmids = _recentMessageIds;
                rmids.Add(messageId);
                _ = Task.Run(async () =>
                {
                    await Task.Delay(60_000);
                    _recentMessageIdsRWLock.AcquireWriterLock(-1);
                    try
                    {
                        if (_recentMessageIds == rmids)
                        {
                            rmids.Remove(messageId);
                        }
                    }
                    finally
                    {
                        _recentMessageIdsRWLock.ReleaseLock();
                    }
                });
            }
            finally
            {
                _recentMessageIdsRWLock.ReleaseWriterLock();
            }
        }



    }
}
