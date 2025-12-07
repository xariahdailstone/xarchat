using System.Text.Json.Serialization;

namespace XarChat.Backend.Bridge1to2.Messages.Server
{
    public class DefaultServerMessageCodeMap : DefaultMessageCodeMapBase
    {
        private static readonly IReadOnlyList<FChatMessageDefinitionMetadata> Metadatas =
            [.. DefaultMessageCodeMapBase.EnumerateMetadataFromJsonSerializerContext(ServerMessageJsonSerializerContext.Default)];

        public static DefaultServerMessageCodeMap Instance { get; } = new DefaultServerMessageCodeMap();

        //    [
        //    new("ADL", typeof(ADLServerMessage), true),
        //    new("CON", typeof(CONServerMessage), true),
        //    new("FRL", typeof(FRLServerMessage), true),
        //    new("HLO", typeof(HLOServerMessage), true),
        //    new("IGN", typeof(IGNServerMessage), true),
        //    new("IDN", typeof(IDNServerMessage), true),
        //    new("XNN", typeof(XNNServerMessage), false)
        //];

        public DefaultServerMessageCodeMap()
            : base(Metadatas)
        {
        }
    }

    [JsonSerializable(typeof(ADLServerMessage))]
    [JsonSerializable(typeof(CDSServerMessage))]
    [JsonSerializable(typeof(CHAServerMessage))]
    [JsonSerializable(typeof(COLServerMessage))]
    [JsonSerializable(typeof(CONServerMessage))]
    [JsonSerializable(typeof(ERRServerMessage))]
    [JsonSerializable(typeof(FLNServerMessage))]
    [JsonSerializable(typeof(FRLServerMessage))]
    [JsonSerializable(typeof(HLOServerMessage))]
    [JsonSerializable(typeof(ICHServerMessage))]
    [JsonSerializable(typeof(IGNServerMessage))]
    [JsonSerializable(typeof(IDNServerMessage))]
    [JsonSerializable(typeof(JCHServerMessage))]
    [JsonSerializable(typeof(LCHServerMessage))]
    [JsonSerializable(typeof(LISServerMessage))]
    [JsonSerializable(typeof(MSGServerMessage))]
    [JsonSerializable(typeof(NLNServerMessage))]
    [JsonSerializable(typeof(ORSServerMessage))]
    [JsonSerializable(typeof(PRIServerMessage))]
    [JsonSerializable(typeof(STAServerMessage))]
    [JsonSerializable(typeof(SYSServerMessage))]
    [JsonSerializable(typeof(TPNServerMessage))]
    [JsonSerializable(typeof(XHMServerMessage))]
    [JsonSerializable(typeof(XICServerMessage))]
    [JsonSerializable(typeof(XNNServerMessage))]
    [JsonSerializable(typeof(XPMServerMessage))]
    [JsonSerializable(typeof(XPUServerMessage))]
    public partial class ServerMessageJsonSerializerContext : JsonSerializerContext
    {
    }

    public class DefaultServerMessageSerializer : FChatMessageDeserializer<FChatServerMessage>
    {
        public DefaultServerMessageSerializer()
            : base(
                  DefaultServerMessageCodeMap.Instance, 
                  ServerMessageJsonSerializerContext.Default,
                  (code, body) => throw new InvalidOperationException($"Unknown message code: {code}"))
        {
            
        }
    }
}
