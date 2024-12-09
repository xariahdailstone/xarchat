using System.Text.Json.Serialization;

namespace XarChat.AutoUpdate.Impl
{
    [JsonSerializable(typeof(GetUpdateInfoResponse))]
    internal partial class SourceGenerationContext : JsonSerializerContext
    {
    }
}
