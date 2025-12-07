namespace XarChat.FList2.FList2Api.Implementation.Firehose.Messages
{
    public interface IFirehoseOutgoingMessage
    {
        string MqDestination { get; }
    }
}
