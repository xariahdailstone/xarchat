namespace XarChat.FList2.FList2Api.Entities
{
    public class GetChannelListArgs
    {
        public required ChannelListType ChannelListType { get; set; }
    }

    public enum ChannelListType
    {
        OfficialChannels,
        PrivateOpenChannels
    }

}