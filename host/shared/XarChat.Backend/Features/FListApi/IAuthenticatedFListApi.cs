using XarChat.Backend.Caching;

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

        Task<GetAllMemosResponseItem> GetMemoAsync(string name, CancellationToken cancellationToken);

        Task<SaveMemoResponse> SaveMemoAsync(string name, string memo, CancellationToken cancellationToken);

        Task<SubmitReportResponse> SubmitReportAsync(
            string reportSubmitCharacter,
            string reportText,
            string log,
            string channel,
            string? reportTargetCharacter,
            CancellationToken cancellationToken);

        Task<ProfileInfo> GetCharacterProfileAsync(string name, bool bypassCache, CancellationToken cancellationToken);

        Task<ProfileFriendsInfo> GetCharacterFriendsAsync(string name, CancellationToken cancellationToken);

        Task<GuestbookPageInfo> GetCharacterGuestbookPageAsync(string name, int page, CancellationToken cancellationToken);
    }
}
