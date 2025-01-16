using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using static XarChat.Backend.UrlHandlers.EIconLoader.EIconLoaderManager;

namespace XarChat.Backend.Features.EIconLoader
{
    internal interface IEIconLoader
    {
        Task<EIconLoadResponse> ProxyEIconLoadAsync(
            string name, 
            CancellationToken cancellationToken);
    }

    internal record EIconLoadResponse(
        int StatusCode,
        string ContentType,
        Stream Stream, 
        List<KeyValuePair<string, string>> Headers);
}
