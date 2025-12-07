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
    }
}
