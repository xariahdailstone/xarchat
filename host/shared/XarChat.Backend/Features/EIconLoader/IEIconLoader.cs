using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppCustomProtocol;

namespace XarChat.Backend.Features.EIconLoader
{
    public interface IEIconLoader
    {
        Task<XarChatProtocolResponse> GetEIconAsync(
            string name, 
            DateTimeOffset requestStartedAt,
            CancellationToken cancellationToken);
    }
}
