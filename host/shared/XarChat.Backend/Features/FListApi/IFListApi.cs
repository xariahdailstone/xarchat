using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.FListApi.Impl;

namespace XarChat.Backend.Features.FListApi
{
    public interface IFListApi
    {
        async Task<T> WithAuthenticatedFListApiAsync<T>(
            string account, string password,
            Func<IAuthenticatedFListApi, CancellationToken, Task<T>> callbackFunc,
            CancellationToken cancellationToken)
        {
            var aflapi = await this.GetAuthenticatedFListApiAsync(account, password, cancellationToken);
            var alreadyRetried = false;

            while (true)
            {
                var apiTicket = await aflapi.GetApiTicketAsync(false, cancellationToken);
                try
                {
                    var result = await callbackFunc(aflapi, cancellationToken);
                    return result;
                }
                catch (InvalidTicketException) when (apiTicket.CameFromCache && !alreadyRetried)
                {
                    alreadyRetried = true;
                    await aflapi.InvalidateApiTicketAsync(apiTicket.Value.Ticket, cancellationToken);
                }
            }
        }

        async Task WithAuthenticatedFListApiAsync(
            string account, string password,
            Func<IAuthenticatedFListApi, CancellationToken, Task> callbackFunc,
            CancellationToken cancellationToken)
        {
            var r = await WithAuthenticatedFListApiAsync<int>(
                account: account,
                password: password,
                cancellationToken: cancellationToken,
                callbackFunc: async (authApi, cancellationToken) =>
                {
                    await callbackFunc(authApi, cancellationToken);
                    return 0;
                });
        }

        async Task<T> WithAlreadyAuthenticatedFListApiAsync<T>(
            string account,
            Func<IAuthenticatedFListApi, CancellationToken, Task<T>> callbackFunc,
            CancellationToken cancellationToken)
        {
            var aflapi = await this.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);
            var alreadyRetried = false;

            while (true)
            {
                var apiTicket = await aflapi.GetApiTicketAsync(false, cancellationToken);
                try
                {
                    var result = await callbackFunc(aflapi, cancellationToken);
                    return result;
                }
                catch (InvalidTicketException) when (apiTicket.CameFromCache && !alreadyRetried)
                {
                    alreadyRetried = true;
                    await aflapi.InvalidateApiTicketAsync(apiTicket.Value.Ticket, cancellationToken);
                }
            }
        }

        async Task WithAlreadyAuthenticatedFListApiAsync(
            string account,
            Func<IAuthenticatedFListApi, CancellationToken, Task> callbackFunc,
            CancellationToken cancellationToken)
        {
            var r = await WithAlreadyAuthenticatedFListApiAsync<int>(
                account: account,
                cancellationToken: cancellationToken,
                callbackFunc: async (authApi, cancellationToken) =>
                {
                    await callbackFunc(authApi, cancellationToken);
                    return 0;
                });
        }

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
