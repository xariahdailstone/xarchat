
using System.Text.Json.Serialization;

namespace XarChat.Backend.Bridge1to2.Messages.Client
{
    public class DefaultClientMessageCodeMap : DefaultMessageCodeMapBase
    {
        private static IReadOnlyList<FChatMessageDefinitionMetadata> Metadatas =
            [.. DefaultMessageCodeMapBase.EnumerateMetadataFromTypeList([
            
                typeof(CHAClientMessage),
            
                typeof(IDNClientMessage),
            
                typeof(JCHClientMessage),
            
                typeof(LCHClientMessage),
            
                typeof(MSGClientMessage),
            
                typeof(ORSClientMessage),
            
                typeof(PRIClientMessage),
            
                typeof(STAClientMessage),
            
                typeof(TPNClientMessage),
            
                typeof(XPMClientMessage),
            
                typeof(XSNClientMessage),
                  
            ])];

        public static DefaultClientMessageCodeMap Instance { get; } = new DefaultClientMessageCodeMap();

        public DefaultClientMessageCodeMap()
            : base(Metadatas)
        {
        }
    }

    [JsonSerializable(typeof(CHAClientMessage))]
    [JsonSerializable(typeof(IDNClientMessage))]
    [JsonSerializable(typeof(JCHClientMessage))]
    [JsonSerializable(typeof(LCHClientMessage))]
    [JsonSerializable(typeof(MSGClientMessage))]
    [JsonSerializable(typeof(ORSClientMessage))]
    [JsonSerializable(typeof(PRIClientMessage))]
    [JsonSerializable(typeof(STAClientMessage))]
    [JsonSerializable(typeof(TPNClientMessage))]
    [JsonSerializable(typeof(XPMClientMessage))]
    [JsonSerializable(typeof(XSNClientMessage))]
    public partial class ClientMessageJsonSerializerContext : JsonSerializerContext
    {
    }

    public class DefaultClientMessageDeserializer : FChatMessageDeserializer<FChatClientMessage>
    {
        public DefaultClientMessageDeserializer()
            : base(
                  DefaultClientMessageCodeMap.Instance, 
                  ClientMessageJsonSerializerContext.Default,
                  (code, body) => throw new InvalidOperationException($"Unknown message code: {code}"))
        {
        }
    }
}
