using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.ChatLogging
{
    public interface IChatLogSearch
    {
        Task<int> GetSearchResultCountAsync(SearchCriteria criteria, CancellationToken cancellationToken);

        Task<IReadOnlyList<long>> GetSearchResultIdsAsync(
            SearchCriteria criteria, int skip, int take,
            CancellationToken cancellationToken);

        Task<IReadOnlyList<SearchResultItem>> GetSearchResultSubsetAsync(
            SearchCriteria criteria, int skip, int take, CancellationToken cancellationToken);

        Task<IReadOnlyList<SearchResultItem>> GetSearchResultsForIdsAsync(IReadOnlyList<long> ids, CancellationToken cancellationToken);

        Task<IReadOnlyList<LogCharacterInfo>> GetMyCharacterInfosAsync(CancellationToken cancellationToken);

        Task<IReadOnlyList<string>> GetChannelNamesAsync(CancellationToken cancellationToken);

        Task<IReadOnlyList<LogCharacterInfo>> GetInterlocutorInfosAsync(
            string? myCharacterName, CancellationToken cancellationToken);

        Task<bool> ValidateChannelInLogsAsync(string channelName, CancellationToken cancellationToken);

        Task<bool> ValidatePMConvoInLogsAsync(
            string myCharacterName, string interlocutorName, CancellationToken cancellationToken);

        Task<IList<RecentConversationInfo>> GetRecentConversationsAsync(
            string myCharacterName, int resultLimit, CancellationToken cancellationToken);
    }

    public class RecentConversationInfo
    {
        [JsonPropertyName("channelId")]
        public required long ChannelId { get; set; }

        [JsonPropertyName("interlocutorName")]
        public required string InterlocutorName { get; set; }

        [JsonPropertyName("lastMessageAt")]
        public required long LastMessageAt { get; set; }
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
        public long MessageId { get; set; }

        public string? ChannelName { get; set; }

        public string? ChannelTitle { get; set; }

        public string? MyCharacterName { get; set; }

        public string? InterlocutorCharacterName { get; set; }

        public string? SpeakingCharacterName { get; set; }

        public int MessageType { get; set; }

        public required string Text { get; set; }

        public int GenderId { get; set; }

        public int OnlineStatusId { get; set; }
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
        public string MyCharacterName { get; set; }

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

    public class LogCharacterInfo
    {
        public required string CharacterName { get; set; }

        public int CharacterGender { get; set; }
    }
}
