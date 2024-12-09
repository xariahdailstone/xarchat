using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Network.Impl
{
    internal class HttpClientProvider : IHttpClientProvider
    {
        public HttpMessageInvoker GetHttpClient(HttpClientType httpClientType)
        {
            switch (httpClientType)
            {
                case HttpClientType.InlineImageLoad:
                    {
                        var hc = new HttpClient();
                        hc.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0");
                        hc.DefaultRequestHeaders.Add("Sec-Fetch-Dest", "image");
                        hc.DefaultRequestHeaders.Add("Sec-Fetch-Mode", "no-cors");
                        hc.DefaultRequestHeaders.Add("Sec-Fetch-Site", "same-origin");
                        hc.DefaultRequestHeaders.Add("Sec-Ch-Ua-Platform", "\"Windows\"");
                        hc.DefaultRequestHeaders.Add("Sec-Ch-Ua-Mobile", "?0");
                        hc.DefaultRequestHeaders.Add("Sec-Ch-Ua", "\"Microsoft Edge\";v=\"119\", \"Chromium\";v=\"119\", \"Not?A_Brand\";v=\"24\"");
                        hc.DefaultRequestHeaders.Add("Accept", "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");
                        hc.DefaultRequestHeaders.Add("Accept-Encoding", "gzip, deflate, br");
                        return hc;
                    }
                default:
                    return new HttpClient();
            }
        }
    }
}
