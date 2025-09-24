using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.EIconFavoriteManager
{
    public interface IEIconFavoriteBlockManager
    {
        Task<IReadOnlySet<string>> GetFavoritesSetAsync(CancellationToken cancellationToken);
        Task<IReadOnlySet<string>> GetBlockedSetAsync(CancellationToken cancellationToken);

        Task<bool> IsFavoriteAsync(string eiconName, CancellationToken cancellationToken);
        Task<bool> IsBlockedAsync(string eiconName, CancellationToken cancellationToken);

        Task AddFavoriteAsync(string eiconName, CancellationToken cancellationToken);
        Task AddBlockedAsync(string eiconName, CancellationToken cancellationToken);

        Task RemoveFavoriteAsync(string eiconName, CancellationToken cancellationToken);
        Task RemoveBlockedAsync(string eiconName, CancellationToken cancellationToken);
    }
}
