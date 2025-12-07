using XarChat.FList2.FList2Api.Implementation.Firehose.Messages;

namespace XarChat.FList2.FList2Api.Implementation.Firehose
{
    public interface IFirehose
    {
        Task WriteAsync(IFirehoseOutgoingMessage message, CancellationToken cancellationToken);

        Task<IFirehoseIncomingMessage?> ReadAsync(CancellationToken cancellationToken);

        FirehoseStatus FirehoseStatus { get; }

        IDisposable AddFirehoseStatusChangedHandler(Action<OldNew<FirehoseStatus>> callback);
    }

    public record struct OldNew<T>(T PreviousValue, T NewValue);
}
