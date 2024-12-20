namespace XarChat.Backend.Features.ChatLogging
{
    public interface IChatLogSearch
    {
        Task<int> GetSearchResultCountAsync(SearchCriteria criteria, CancellationToken cancellationToken);

        Task<int[]> GetSearchResultIdsAsync(SearchCriteria criteria, CancellationToken cancellationToken);

        Task<SearchResultItem[]> GetSearchResultsAsync(SearchCriteria criteria, CancellationToken cancellationToken);

        Task<SearchResultItem[]> GetSearchResultsForIdsAsync(IReadOnlyList<int> ids, CancellationToken cancellationToken);
    }

    public class SearchCriteria
    {
        public SearchWhoSpecCriterion? WhoSpec { get; set; } = null;

        public SearchStreamSpecCriterion? StreamSpec { get; set; } = null;

        public SearchTextSpecCriterion? TextSpec { get; set; } = null;

        public SearchTimeSpecCriterion? TimeSpec { get; set; } = null;
    }

    public class SearchResultItem
    {

    }

    public abstract class SearchCriterion { }

    public abstract class SearchWhoSpecCriterion : SearchCriterion { }

    public class SearchLogsForCharacterCriterion : SearchWhoSpecCriterion
    { 
        public string CharacterName { get; set; }
    }

    public abstract class SearchStreamSpecCriterion : SearchCriterion { }

    public class SearchPrivateMessagesWithCriterion : SearchStreamSpecCriterion
    {
        public string InterlocutorCharacterName { get; set; }
    }

    public class SearchInChannelCriterion : SearchStreamSpecCriterion
    {
        public string ChannelTitle { get; set; }
    }

    public abstract class SearchTextSpecCriterion : SearchCriterion { }

    public class SearchContainsTextCriterion : SearchTextSpecCriterion
    {
        public string SearchText { get; set; }
    }

    public class SearchTimeSpecCriterion : SearchCriterion
    {
        public DateTime? Before { get; set; }

        public DateTime? After { get; set; }
    }
}
