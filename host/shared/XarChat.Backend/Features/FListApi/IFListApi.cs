using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.FListApi
{
    public interface IFListApi
    {
        Task<IAuthenticatedFListApi> GetAuthenticatedFListApiAsync(
            string account, string password, CancellationToken cancellationToken);

        Task<IAuthenticatedFListApi> GetAlreadyAuthenticatedFListApiAsync(
            string account, CancellationToken cancellationToken);

        Task<MappingList> GetMappingListAsync(CancellationToken cancellationToken);

        Task<ProfileFieldsInfoList> GetProfileFieldsInfoListAsync(CancellationToken cancellationToken);

        Task<KinksList> GetKinksListAsync(CancellationToken cancellationToken);
    }
}
