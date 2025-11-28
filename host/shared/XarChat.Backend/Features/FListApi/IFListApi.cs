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

        Task<PartnerSearchFieldsDefinitions> GetPartnerSearchFieldsDefinitionsAsync(CancellationToken cancellationToken);
    }


    [Serializable]
    public class FListApiErrorException : ApplicationException
    {
        public FListApiErrorException()
            : base("F-List API returned an unknown error.")
        {
            this.FListErrorMessage = "Unknown error.";
        }

        public FListApiErrorException(string message) 
            : base($"F-List API returned error: {message}") 
        { 
            this.FListErrorMessage = message;
        }

        public FListApiErrorException(string message, Exception inner) 
            : base($"F-List API returned error: {message}", inner) 
        {
            this.FListErrorMessage = message;
        }

        public string FListErrorMessage { get; }
    }
}
