using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.EIconFavoriteManager;

namespace XarChat.Backend.Features.EIconFavoriteBlockManager.Impl
{
    internal class EIconFavoriteBlockManager : IEIconFavoriteBlockManager
    {
        private readonly IAppConfiguration _appConfiguration;

        public EIconFavoriteBlockManager(
            IAppConfiguration appConfiguration)
        {
            _appConfiguration = appConfiguration;
        }

        private const string BlockedConfigKey = "global.blockedEIcons";
        private const string FavoritesConfigKey = "global.favoriteEIcons";

        private async Task<HashSet<string>> GetSetInternalAsync(string configKey, CancellationToken cancellationToken)
        {
            var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            try
            {
                var blockedConfig = _appConfiguration.GetArbitraryValue(configKey) ?? new JsonArray();
                foreach (string? str in ((JsonArray)blockedConfig))
                {
                    if (!String.IsNullOrWhiteSpace(str))
                    {
                        result.Add(str);
                    }
                }
            }
            catch
            {
            }

            return result;
        }

        private async Task SetSetInternalAsync(string configKey, IEnumerable<string> values, CancellationToken cancellationToken)
        {
            var arrayNode = new JsonArray();
            foreach (var str in values)
            {
                arrayNode.Add(JsonValue.Create(str));
            }
            await _appConfiguration.SetArbitraryValueAsync(configKey, arrayNode, cancellationToken);
        }

        private async Task AddToArrayInternalAsync(string configKey, string eiconName, CancellationToken cancellationToken)
        {
            var existingItems = await GetSetInternalAsync(configKey, cancellationToken);
            if (existingItems.Add(eiconName))
            {
                await SetSetInternalAsync(configKey, existingItems, cancellationToken);
            }
        }

        private async Task RemoveFromArrayInternalAsync(string configKey, string eiconName, CancellationToken cancellationToken)
        {
            var existingItems = await GetSetInternalAsync(configKey, cancellationToken);
            if (existingItems.Remove(eiconName))
            {
                await SetSetInternalAsync(configKey, existingItems, cancellationToken);
            }
        }

        public async Task AddBlockedAsync(string eiconName, CancellationToken cancellationToken)
        {
            await AddToArrayInternalAsync(BlockedConfigKey, eiconName, cancellationToken);
        }

        public async Task AddFavoriteAsync(string eiconName, CancellationToken cancellationToken)
        {
            await AddToArrayInternalAsync(FavoritesConfigKey, eiconName, cancellationToken);
        }

        public async Task<IReadOnlySet<string>> GetBlockedSetAsync(CancellationToken cancellationToken)
        {
            var existingBlocked = await GetSetInternalAsync(BlockedConfigKey, cancellationToken);
            return existingBlocked;
        }

        public async Task<IReadOnlySet<string>> GetFavoritesSetAsync(CancellationToken cancellationToken)
        {
            var existingFavorites = await GetSetInternalAsync(FavoritesConfigKey, cancellationToken);
            return existingFavorites;
        }

        public async Task<bool> IsBlockedAsync(string eiconName, CancellationToken cancellationToken)
        {
            var existingBlocked = await GetSetInternalAsync(BlockedConfigKey, cancellationToken);
            return existingBlocked.Contains(eiconName);
        }

        public async Task<bool> IsFavoriteAsync(string eiconName, CancellationToken cancellationToken)
        {
            var existingFavorites = await GetSetInternalAsync(FavoritesConfigKey, cancellationToken);
            return existingFavorites.Contains(eiconName);
        }

        public async Task RemoveBlockedAsync(string eiconName, CancellationToken cancellationToken)
        {
            await RemoveFromArrayInternalAsync(BlockedConfigKey, eiconName, cancellationToken);
        }

        public async Task RemoveFavoriteAsync(string eiconName, CancellationToken cancellationToken)
        {
            await RemoveFromArrayInternalAsync(FavoritesConfigKey, eiconName, cancellationToken);
        }
    }
}
