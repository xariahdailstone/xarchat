using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using System.Threading.Tasks;
using XarChat.Backend.Features.EIconLoader;
using XarChat.Backend.UrlHandlers.EIconLoader;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces.EIconData
{
    internal class EIconDataSessionNamespace : SessionNamespaceBase
    {
        private readonly IEIconLoader _eiconLoader;

        public EIconDataSessionNamespace(
            IEIconLoader eiconLoader,
            Func<string, string?, CancellationToken, Task> writeMessageFunc)
            : base(writeMessageFunc)
        {
            _eiconLoader = eiconLoader;

            this.RegisterTypedStreamCommandHandler<GetEIconDataArgs>(
                "getEIconData",
                GetEIconDataAsync);
        }

        protected override JsonTypeInfo GetTypeInfo(Type type)
            => EIconDataSessionSourceGenerationContext.Default.GetTypeInfo(type)!;

        private async Task GetEIconDataAsync(StreamHandlerArgs<GetEIconDataArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            var resp = await _eiconLoader.ProxyEIconLoadAsync(args.Data!.EIconName, args.CancellationToken);

            using var ms = new MemoryStream();
            await resp.Stream.CopyToAsync(ms, args.CancellationToken);
            var eiconData = ms.GetBuffer();
            resp.Stream.Dispose();

            await args.WriteMessageAsync("gotEIconData", 
                new GetEIconDataResult() 
                {  
                    EIconData = eiconData,
                    ContentType = resp.ContentType,
                    StatusCode = resp.StatusCode,
                    Headers = resp.Headers,
                },
                args.CancellationToken);
        }
    }

    public class GetEIconDataArgs : StreamCommandMessage
    {
        [JsonPropertyName("name")]
        public required string EIconName { get; set; }
    }

    public class GetEIconDataResult : StreamCommandMessage
    {
        [JsonPropertyName("data")]
        public required byte[] EIconData { get; set; }

        [JsonPropertyName("contentType")]
        public required string ContentType { get; set; }

        [JsonPropertyName("statusCode")]
        public int StatusCode { get; set; }

        [JsonPropertyName("headers")]
        public required List<KeyValuePair<string, string>> Headers { get; set; }
    }

    [JsonSerializable(typeof(GetEIconDataArgs))]
    [JsonSerializable(typeof(GetEIconDataResult))]
    internal partial class EIconDataSessionSourceGenerationContext : JsonSerializerContext
    {
    }
}
