using XarChat.Backend.Common;
using XarChat.Backend.Features.LocalDataCache;

namespace XarChat.Backend.Features.FListApi.CachingImpl
{
    public class CachingFListApiImpl : IFListApi
    {
        private readonly IFListApi _inner;
        private readonly ILocalDataCache _localDataCache;

        public CachingFListApiImpl(IFListApi inner, ILocalDataCache localDataCache)
        {
            _inner = inner;
            _localDataCache = localDataCache;
        }

        public Task<IAuthenticatedFListApi> GetAlreadyAuthenticatedFListApiAsync(string account, CancellationToken cancellationToken)
            => _inner.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);

        public Task<IAuthenticatedFListApi> GetAuthenticatedFListApiAsync(string account, string password, CancellationToken cancellationToken)
            => _inner.GetAuthenticatedFListApiAsync(account, password, cancellationToken);

        public async Task<KinksList> GetKinksListAsync(CancellationToken cancellationToken)
        {
            var cacheDuration = TimeSpan.FromHours(12);
            var cacheKey = "FListApi/KinksList";
            var result = await _localDataCache.GetOrCreateAsync(
                cacheKey: cacheKey,
                cancellationToken: cancellationToken,
                maxAge: cacheDuration,
                jsonTypeInfo: SourceGenerationContext.Default.KinksList,
                asyncCreationFunc: async (ct) =>
                {
                    var result = await _inner.GetKinksListAsync(ct);
                    return result;
                });
            return result;
        }

        public async Task<PartnerSearchFieldsDefinitions> GetPartnerSearchFieldsDefinitionsAsync(CancellationToken cancellationToken)
        {
            var cacheDuration = TimeSpan.FromHours(12);
            var cacheKey = "FListApi/PartnerSearchFieldsDefinitions";
            var result = await _localDataCache.GetOrCreateAsync(
                cacheKey: cacheKey,
                cancellationToken: cancellationToken,
                maxAge: cacheDuration,
                jsonTypeInfo: SourceGenerationContext.Default.PartnerSearchFieldsDefinitions,
                asyncCreationFunc: async (ct) =>
                {
                    var result = await _inner.GetPartnerSearchFieldsDefinitionsAsync(ct);
                    return result;
                });
            return result;
        }

        public async Task<MappingList> GetMappingListAsync(CancellationToken cancellationToken)
        {
            var cacheDuration = TimeSpan.FromHours(12);
            var cacheKey = "FListApi/MappingList";
            var result = await _localDataCache.GetOrCreateAsync(
                cacheKey: cacheKey,
                cancellationToken: cancellationToken,
                maxAge: cacheDuration,
                jsonTypeInfo: SourceGenerationContext.Default.MappingList,
                asyncCreationFunc: async (ct) =>
                {
                    var result = await _inner.GetMappingListAsync(ct);
                    return result;
                });
            return result;
        }

        public async Task<ProfileFieldsInfoList> GetProfileFieldsInfoListAsync(CancellationToken cancellationToken)
        {
            var cacheDuration = TimeSpan.FromHours(12);
            var cacheKey = "FListApi/ProfileFieldsInfoList";
            var result = await _localDataCache.GetOrCreateAsync(
                cacheKey: cacheKey,
                cancellationToken: cancellationToken,
                maxAge: cacheDuration,
                jsonTypeInfo: SourceGenerationContext.Default.ProfileFieldsInfoList,
                asyncCreationFunc: async (ct) =>
                {
                    var result = await _inner.GetProfileFieldsInfoListAsync(ct);
                    return result;
                });
            return result;
        }
    }
}
