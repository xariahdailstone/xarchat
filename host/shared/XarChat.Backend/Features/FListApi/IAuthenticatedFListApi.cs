﻿using XarChat.Backend.Caching;

namespace XarChat.Backend.Features.FListApi
{
    public interface IAuthenticatedFListApi
    {
        string Account { get; }

        Task InvalidateApiTicketAsync(string ticket, CancellationToken cancellationToken);

#if DEBUG
        Task DebugBreakTicketAsync(CancellationToken cancellationToken);
#endif

        Task<ValueWithCameFromCache<ApiTicket>> GetApiTicketAsync(CancellationToken cancellationToken);

        Task<FriendsList> GetFriendsListAsync(CancellationToken cancellationToken);

        Task AddBookmarkAsync(string name, CancellationToken cancellationToken);

        Task RemoveBookmarkAsync(string name, CancellationToken cancellationToken);

        Task<SaveMemoResponse> SaveMemoAsync(string name, string memo, CancellationToken cancellationToken);

        Task<ProfileInfo> GetCharacterProfileAsync(string name, bool bypassCache, CancellationToken cancellationToken);
    }
}