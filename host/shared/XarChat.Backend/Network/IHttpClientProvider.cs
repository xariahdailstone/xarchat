using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Network
{
    internal interface IHttpClientProvider
    {
        HttpMessageInvoker GetHttpClient(HttpClientType httpClientType);
    }

    internal enum HttpClientType
    {
        None = 0,
        InlineImageLoad = 1
    }
}
