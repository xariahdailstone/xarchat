using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.AppFileServer
{
    public interface IAppFileServer
    {
        Task<IResult> HandleRequestAsync(string relPath, CancellationToken cancellationToken);

        Task<string> GetFileContentAsStringAsync(string relPath, CancellationToken cancellationToken);

        Task<IEnumerable<string>> ListFilesAsync(CancellationToken cancellationToken);
    }
}
