using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.EIconUpdateSubmitter
{
    public interface IDataUpdateSubmitter
    {
        Task SubmitHardLoadedEIconInfoAsync(string eiconName, string etag, long contentLength, CancellationToken cancellationToken);

        Task SubmitHardLoadedProfileDataAsync(string characterName, string profileBodyJson, CancellationToken cancellationToken);
    }
}
