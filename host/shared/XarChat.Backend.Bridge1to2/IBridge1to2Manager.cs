using System.Diagnostics.CodeAnalysis;
using System.Reflection.Metadata.Ecma335;

namespace XarChat.Backend.Bridge1to2
{
    public interface IBridge1to2Manager : IAsyncDisposable
    {
        Task<IBridgeConnection> CreateConnectionAsync(CancellationToken cancellationToken);
    }

    public interface IMessageCodeClassMap
    {
        bool TryGetMetadataByCode(string code, [NotNullWhen(true)] out FChatMessageDefinitionMetadata? metadata);

        bool TryGetMetadataByClass(Type messageClass, [NotNullWhen(true)] out FChatMessageDefinitionMetadata? metadata);
    }
}
