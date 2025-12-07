namespace XarChat.FList2.FList2Api.Implementation.Firehose.Messages
{
    public interface IFirehoseIncomingMessage
    {
    }

    [AttributeUsage(AttributeTargets.Class, AllowMultiple = false)]
    public class IncomingMessageAttribute : Attribute
    {
        public IncomingMessageAttribute()
        {
        }

        public required string Type { get; set; }

        public required string Target { get; set; }
    }
}
