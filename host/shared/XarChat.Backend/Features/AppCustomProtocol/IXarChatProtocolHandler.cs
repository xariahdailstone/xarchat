using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.AppCustomProtocol
{
    public interface IXarChatProtocolHandler
    {
        Task<XarChatProtocolResponse> HandleRequestAsync(XarChatProtocolRequest request, CancellationToken cancellationToken);
    }

    public record XarChatProtocolRequest(HttpMethod Method, Uri Uri, 
        IReadOnlyList<KeyValuePair<string, string>> Headers, Stream? Content);

    public record XarChatProtocolResponse(int StatusCode, string ReasonPhrase,
        IReadOnlyList<KeyValuePair<string, string>>? Headers = null, Stream? Content = null)
    {
        public static XarChatProtocolResponse NotFound => new(404, "Not Found");
    }
}
