using XarChat.Backend.Bridge1to2.Messages.Client;
using XarChat.Backend.Bridge1to2.Messages.Server;

namespace XarChat.Backend.Bridge1to2
{
    public interface IBridgeConnection : IAsyncDisposable
    {
        Task IngestIncomingMessageAsync(FChatClientMessage clientMessage, CancellationToken cancellationToken);

        Task RunOutgoingMessageLoopAsync(Func<FChatServerMessage, CancellationToken, Task> serverMessageEmittedFunc, CancellationToken cancellationToken);
    }
}
