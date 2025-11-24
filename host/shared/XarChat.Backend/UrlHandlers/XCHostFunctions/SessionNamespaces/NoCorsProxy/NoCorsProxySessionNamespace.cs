using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using XarChat.Backend.Network;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces.NoCorsProxy
{
    internal class NoCorsProxySessionNamespace : SessionNamespaceBase
    {
        private readonly HttpMessageInvoker _httpClient;

        public NoCorsProxySessionNamespace(
            IHttpClientProvider httpClientProvider,
            Func<string, string?, CancellationToken, Task> writeMessageFunc)
            : base(writeMessageFunc)
        {
            _httpClient = httpClientProvider.GetHttpClient(HttpClientType.None);

            this.RegisterTypedStreamCommandHandler<PerformRequestArgs>(
                "performRequest",
                PerformRequestAsync);
        }

        protected override JsonTypeInfo GetTypeInfo(Type type)
            => NoCorsProxySourceGenerationContext.Default.GetTypeInfo(type)!;

        private async Task PerformRequestAsync(StreamHandlerArgs<PerformRequestArgs> args)
        {
            var cancellationToken = args.CancellationToken;
            try
            {
                var req = new HttpRequestMessage(new HttpMethod(args.Data!.Method), args.Data.Url);
                foreach (var h in args.Data.Headers)
                {
                    var headerName = h.Key;
                    foreach (var v in h.Value)
                    {
                        req.Headers.Add(headerName, v);
                    }
                }
                if (args.Data.Body is not null)
                {
                    var baContent = new StringContent(args.Data.Body);
                    if (args.Data.ContentHeaders is not null)
                    {
                        foreach (var h in args.Data.ContentHeaders)
                        {
                            var headerName = h.Key;
                            foreach (var v in h.Value)
                            {
                                baContent.Headers.Add(headerName, v);
                            }
                        }
                    }
                    req.Content = baContent;
                }

                var resp = await _httpClient.SendAsync(req, cancellationToken);

                var responseHeaders = new Dictionary<string, List<string>>();
                foreach (var h in resp.Headers)
                {
                    var headerName = h.Key;
                    responseHeaders.Add(headerName, new List<string>(h.Value));
                }

                var contentHeaders = new Dictionary<string, List<string>>();
                foreach (var h in resp.Content.Headers)
                {
                    var headerName = h.Key;
                    contentHeaders.Add(headerName, new List<string>(h.Value));
                }

                await args.WriteMessageAsync("requestResponseStart",
                    new PerformRequestSuccessStartResponse()
                    {
                        StatusCode = (int)resp.StatusCode,
                        ResponseHeaders = responseHeaders,
                        ContentHeaders = contentHeaders
                    },
                    cancellationToken);

                var respString = await resp.Content.ReadAsStringAsync(cancellationToken);
                await args.WriteMessageAsync("requestResponseContinue",
                            new PerformRequestSuccessContinueResponse()
                            {
                                Data = respString,
                                IsComplete = true
                            },
                            cancellationToken);
            }
            catch (Exception ex)
            {
                await args.WriteMessageAsync("requestFailed",
                    new PerformRequestFailedResponse()
                    {
                        FailureReason = ex.Message
                    },
                    cancellationToken);
            }
        }
    }

    public class PerformRequestArgs : StreamCommandMessage
    {
        [JsonPropertyName("method")]
        public required string Method { get; set; }

        [JsonPropertyName("url")]
        public required string Url { get; set; }

        [JsonPropertyName("requestHeaders")]
        public required Dictionary<string, List<string>> Headers { get; set; }

        [JsonPropertyName("contentHeaders")]
        public required Dictionary<string, List<string>>? ContentHeaders { get; set; }

        [JsonPropertyName("body")]
        public string? Body { get; set; } = null;

        [JsonPropertyName("responseBufferSize")]
        public int ResponseBufferSize { get; set; } = 32768;
    }

    public class PerformRequestSuccessStartResponse : StreamCommandMessage
    {
        [JsonPropertyName("status")]
        public required int StatusCode { get; set; }

        [JsonPropertyName("responseHeaders")]
        public required Dictionary<string, List<string>> ResponseHeaders { get; set; }

        [JsonPropertyName("contentHeaders")]
        public required Dictionary<string, List<string>> ContentHeaders { get; set; }
    }

    public class PerformRequestSuccessContinueResponse : StreamCommandMessage
    {
        [JsonPropertyName("data")]
        public required string Data { get; set; }

        [JsonPropertyName("isComplete")]
        public required bool IsComplete { get; set; }
    }

    public class PerformRequestFailedResponse : StreamCommandMessage
    {
        [JsonPropertyName("reason")]
        public required string FailureReason { get; set; }
    }

    [JsonSerializable(typeof(PerformRequestArgs))]
    [JsonSerializable(typeof(PerformRequestSuccessStartResponse))]
    [JsonSerializable(typeof(PerformRequestSuccessContinueResponse))]
    [JsonSerializable(typeof(PerformRequestFailedResponse))]
    internal partial class NoCorsProxySourceGenerationContext: JsonSerializerContext
    {
    }
}
