using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using XarChat.Backend.Features.EIconLoader;

namespace XarChat.Backend.Features.AppCustomProtocol.Impl
{
    internal class XarChatProtocolHandlerImpl : IXarChatProtocolHandler
    {
        private readonly IEIconLoader _eIconLoader;

        public XarChatProtocolHandlerImpl(
            IEIconLoader eIconLoader)
        {
            _eIconLoader = eIconLoader;
        }

        public async Task<XarChatProtocolResponse> HandleRequestAsync(XarChatProtocolRequest request, CancellationToken cancellationToken)
        {
            if (request.Uri.Authority != "local")
            {
                return new XarChatProtocolResponse(404, "Not Found");
            }
            else
            {
                if (request.Uri.PathAndQuery.StartsWith("/eicon/"))
                {
                    return await HandleEIconRequestAsync(request, cancellationToken);
                }
                else
                {
                    return new XarChatProtocolResponse(404, "Not Found");
                }
            }
        }

        private async Task<XarChatProtocolResponse> HandleEIconRequestAsync(XarChatProtocolRequest request, CancellationToken cancellationToken)
        {
            var fn = HttpUtility.UrlDecode(
                Path.GetFileNameWithoutExtension(request.Uri.AbsolutePath.Split("/").Last()));

            var resp = await _eIconLoader.GetEIconAsync(fn, DateTime.UtcNow, cancellationToken);
            return resp;
        }
    }
}
