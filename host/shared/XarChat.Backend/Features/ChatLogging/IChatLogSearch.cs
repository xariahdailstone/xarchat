using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.ChatLogging
{
    public interface IChatLogSearch
    {
        Task<long> GetLogFileSizeAsync(CancellationToken cancellationToken);

        Task<int> GetSearchResultCountAsync(SearchCriteria criteria, CancellationToken cancellationToken);

        Task<IReadOnlyList<long>> GetSearchResultIdsAsync(
            SearchCriteria criteria, int skip, int take,
            CancellationToken cancellationToken);

        Task<IReadOnlyList<SearchResultItem>> GetSearchResultSubsetAsync(
            SearchCriteria criteria, int skip, int take, CancellationToken cancellationToken);

        Task<IReadOnlyList<SearchResultItem>> GetSearchResultsForIdsAsync(IReadOnlyList<long> ids, CancellationToken cancellationToken);

        Task<IReadOnlyList<LogCharacterInfo>> GetMyCharacterInfosAsync(CancellationToken cancellationToken);

        Task<IReadOnlyList<string>> GetChannelNamesAsync(CancellationToken cancellationToken);

        Task<IReadOnlyList<string>> GetChannelNamesAsync(string startsWith, CancellationToken cancellationToken);

        Task<IReadOnlyList<LogCharacterInfo>> GetInterlocutorInfosAsync(
            string? myCharacterName, CancellationToken cancellationToken);

        Task<bool> ValidateChannelInLogsAsync(string channelName, CancellationToken cancellationToken);

        Task<bool> ValidatePMConvoInLogsAsync(
            string myCharacterName, string interlocutorName, CancellationToken cancellationToken);

        Task<IList<RecentConversationInfo>> GetRecentConversationsAsync(
            string myCharacterName, int resultLimit, CancellationToken cancellationToken);

        Task<IList<ExplicitDate>> GetChannelMessageDatesAsync(
            string channelTitle, CancellationToken cancellationToken);

        Task<IList<ExplicitDate>> GetPMConversationDatesAsync(
            string myCharName, string interlocutorCharName, CancellationToken cancellationToken);

        Task<IList<LogSearchResultChannelMessage>> GetChannelMessagesAsync(
            string channelTitle, ExplicitDate fromDate, ExplicitDate toDate, CancellationToken cancellationToken);

        Task<IList<LogSearchResultPMConvoMessage>> GetPMConversationMessagesAsync(
            string myCharName, string interlocutorCharName, ExplicitDate fromDate, ExplicitDate toDate, CancellationToken cancellationToken);
    }

    public class ExplicitDate
    {
        [JsonPropertyName("y")]
        public int Year { get; set; }
        [JsonPropertyName("m")]
        public int Month { get; set; }
        [JsonPropertyName("d")]
        public int Day { get; set; }

        public DateTimeOffset ToLocalDateTimeOffset()
        {
            var myDT = new DateTime(this.Year, this.Month, this.Day, 0, 0, 0, DateTimeKind.Local);
            var utcDT = TimeZoneInfo.ConvertTime(myDT, TimeZoneInfo.Local, TimeZoneInfo.Utc);
            var utcDTO = new DateTimeOffset(utcDT, TimeSpan.Zero);
            var myDTO = TimeZoneInfo.ConvertTime(utcDTO, TimeZoneInfo.Local);
            return myDTO;
        }
    }

    public class LogSearchResult
    {
        [JsonPropertyName("gender")]
        public required int Gender { get; set; }
        [JsonPropertyName("messageText")]
        public required string MessageText { get; set; }
        [JsonPropertyName("messageType")]
        public required int MessageType { get; set; }
        [JsonPropertyName("speakerName")]
        public required string SpeakerName { get; set; }
        [JsonPropertyName("status")]
        public required int Status { get; set; }
        [JsonPropertyName("timestamp")]
        public required long Timestamp { get; set; }
    }
    public class LogSearchResultChannelMessage : LogSearchResult
    {
        [JsonPropertyName("channelName")]
        public required string ChannelName { get; set; }
        [JsonPropertyName("channelTitle")]
        public required string ChannelTitle { get; set; }
    }
    public class LogSearchResultPMConvoMessage : LogSearchResult
    {
        [JsonPropertyName("myCharacterName")]
        public required string MyCharacterName { get; set; }
        [JsonPropertyName("interlocutorName")]
        public required string InterlocutorName { get; set; }
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
        public required string CharacterName { get; set; }
    }

    public abstract class SearchStreamSpecCriterion : SearchCriterion { }

    public class SearchPrivateMessagesWithCriterion : SearchStreamSpecCriterion
    {
        public required string MyCharacterName { get; set; }

        public required string InterlocutorCharacterName { get; set; }
    }

    public class SearchInChannelCriterion : SearchStreamSpecCriterion
    {
        public required string ChannelTitle { get; set; }
    }

    public abstract class SearchTextSpecCriterion : SearchCriterion { }

    public class SearchContainsTextCriterion : SearchTextSpecCriterion
    {
        public required string SearchText { get; set; }
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
