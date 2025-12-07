using System;
using System.Collections.Generic;
using System.Text;
using XarChat.Backend.Caching;
using XarChat.Backend.Features.FListApi.Impl;
using XarChat.FList2.FList2Api;

namespace XarChat.Backend.Features.FListApi.FList2Impl
{
    internal class FList2ApiImpl : IFListApi
    {
        private readonly FListApiImpl _fl1Api;
        private readonly IFList2ApiFactory _fList2ApiFactory;

        public FList2ApiImpl(
            FListApiImpl fl1Api,
            IFList2ApiFactory fList2ApiFactory)
        {
            _fl1Api = fl1Api;
            _fList2ApiFactory = fList2ApiFactory;
        }

        private readonly SemaphoreSlim _apisCacheSem = new SemaphoreSlim(1);
        private readonly Dictionary<string, AuthenticatedFList2ApiImpl> _apisCache = new Dictionary<string, AuthenticatedFList2ApiImpl>();

        public async Task<IAuthenticatedFListApi> GetAlreadyAuthenticatedFListApiAsync(string account, CancellationToken cancellationToken)
        {
            await _apisCacheSem.WaitAsync(cancellationToken);
            try
            {
                if (_apisCache.TryGetValue(account, out var api))
                {
                    return api;
                }
                else
                {
                    throw new ApplicationException($"No cached API for {account}");
                }
            }
            finally
            {
                _apisCacheSem.Release();
            }
        }

        public async Task<IAuthenticatedFListApi> GetAuthenticatedFListApiAsync(string account, string password, CancellationToken cancellationToken)
        {
            await _apisCacheSem.WaitAsync(cancellationToken);
            try
            {
                var api = new AuthenticatedFList2ApiImpl(account, password, _fList2ApiFactory);
                _apisCache[account] = api;
                return api;
            }
            finally
            {
                _apisCacheSem.Release();
            }
        }

        public Task<KinksList> GetKinksListAsync(CancellationToken cancellationToken)
            => _fl1Api.GetKinksListAsync(cancellationToken);

        public Task<MappingList> GetMappingListAsync(CancellationToken cancellationToken)
            => _fl1Api.GetMappingListAsync(cancellationToken);

        public Task<PartnerSearchFieldsDefinitions> GetPartnerSearchFieldsDefinitionsAsync(CancellationToken cancellationToken)
            => _fl1Api.GetPartnerSearchFieldsDefinitionsAsync(cancellationToken);

        public Task<ProfileFieldsInfoList> GetProfileFieldsInfoListAsync(CancellationToken cancellationToken)
            => _fl1Api.GetProfileFieldsInfoListAsync(cancellationToken);
    }

    internal class AuthenticatedFList2ApiImpl : IAuthenticatedFListApi
    {
        public AuthenticatedFList2ApiImpl(
            string account, 
            string password,
            IFList2ApiFactory fList2ApiFactory)
        {
            this.Account = account;
            this.Password = password;
            this.FList2ApiFactory = fList2ApiFactory;
        }

        public string Account { get; }

        private string Password { get; }

        private IFList2ApiFactory FList2ApiFactory { get; }

        public Task AddBookmarkAsync(string name, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public Task DebugBreakTicketAsync(CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public async Task<ValueWithCameFromCache<ApiTicket>> GetApiTicketAsync(CancellationToken cancellationToken)
        {
            await using var fl2Api = await FList2ApiFactory.CreateAsync(new()
            {
                BaseUri = new Uri("https://test.f-list.net/")
            }, new()
            {
                Username = Account,
                Password = Password
            }, cancellationToken);

            var userCharsResp = await fl2Api.GetUserCharacters(cancellationToken);
            //var chatEnabledCharsResp = await fl2Api.GetChatEnabledCharactersAsync(cancellationToken);


            var charsDict = userCharsResp.CharacterList
                .Select(cec => new { CharacterId = cec.Id.Value, CharacterName = cec.CharacterName.Value })
                .ToDictionary(x => x.CharacterName, x => x.CharacterId);
            var apiTicket = new ApiTicket()
            {
                Bookmarks = [],
                Characters = charsDict,
                DefaultCharacter = charsDict.Values.First(),
                Friends = [],
                Ticket = Password
            };

            return new ValueWithCameFromCache<ApiTicket>(apiTicket, false);
        }

        public Task<ProfileFriendsInfo> GetCharacterFriendsAsync(string name, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<GuestbookPageInfo> GetCharacterGuestbookPageAsync(string name, int page, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<ProfileInfo> GetCharacterProfileAsync(string name, bool bypassCache, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public async Task<FriendsList> GetFriendsListAsync(CancellationToken cancellationToken)
        {
            // TODO:
            return new FriendsList()
            {
                BookmarkList = [],
                FriendList = [],
                RequestList = [],
                RequestPending = []
            };
        }

        public Task<GetAllMemosResponseItem> GetMemoAsync(string name, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task InvalidateApiTicketAsync(string ticket, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public Task RemoveBookmarkAsync(string name, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public Task<SaveMemoResponse> SaveMemoAsync(string name, string memo, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<SubmitReportResponse> SubmitReportAsync(string reportSubmitCharacter, string reportText, string log, string channel, string? reportTargetCharacter, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }
    }
}
