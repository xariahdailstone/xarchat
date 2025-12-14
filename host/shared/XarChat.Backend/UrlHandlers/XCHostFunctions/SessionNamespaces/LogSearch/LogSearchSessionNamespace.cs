using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using System.Threading.Tasks;
using XarChat.Backend.Features.ChatLogging;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces.LogSearch;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces.LogSearch
{
    internal class LogSearchSessionNamespace : SessionNamespaceBase
    {
        private readonly IChatLogWriter _chatLogWriter;
        private readonly IChatLogSearch _chatLogSearch;

        public LogSearchSessionNamespace(
            IChatLogWriter chatLogWriter,
            IChatLogSearch chatLogSearch,
            Func<string, string?, CancellationToken, Task> writeMessageFunc) 
            : base(writeMessageFunc)
        {
            _chatLogWriter = chatLogWriter;
            _chatLogSearch = chatLogSearch;

            this.RegisterTypedStreamCommandHandler<GetHintsFromTermArgs>(
                "getHintsFromTerm",
                GetHintsFromTermAsync);

            this.RegisterTypedStreamCommandHandler<ValidateSearchTextArgs>(
                "validateSearchText",
                ValidateSearchTextAsync);

            this.RegisterTypedStreamCommandHandler<PerformChannelSearchArgs>(
                "performChannelSearch",
                PerformChannelSearchAsync);

            this.RegisterTypedStreamCommandHandler<PerformPMConvoSearchArgs>(
                "performPMConvoSearch",
                PerformPMConvoSearchAsync);

            this.RegisterTypedStreamCommandHandler<PerformRecentConversationsSearchArgs>(
                "getRecentConversations",
                PerformRecentConversationsSearchAsync);


            this.RegisterTypedStreamCommandHandler<GetHintsForChannelTitleArgs>(
                "getHintsForChannelTitle",
                GetHintsForChannelTitleAsync);

            this.RegisterTypedStreamCommandHandler<GetHintsForMyCharacterNameArgs>(
                "getHintsForMyCharacterName",
                GetHintsForMyCharacterNameAsync);

            this.RegisterTypedStreamCommandHandler<GetHintsForInterlocutorCharacterNameArgs>(
                "getHintsForInterlocutorCharacterName",
                GetHintsForInterlocutorCharacterNameAsync);

            this.RegisterTypedStreamCommandHandler<SearchChannelMessageDatesArgs>(
                "searchChannelMessageDates",
                SearchChannelMessageDatesAsync);

            this.RegisterTypedStreamCommandHandler<SearchPMConversationDatesArgs>(
                "searchPMConversationDates",
                SearchPMConversationDatesAsync);

            this.RegisterTypedStreamCommandHandler<GetChannelMessagesArgs>(
                "getChannelMessages",
                GetChannelMessagesAsync);

            this.RegisterTypedStreamCommandHandler<GetPMConversationMessagesArgs>(
                "getPMConversationMessages",
                GetPMConversationMessagesAsync);
        }

        protected override JsonTypeInfo GetTypeInfo(Type type)
            => LogSearchSourceGenerationContext.Default.GetTypeInfo(type)!;

        private async Task GetHintsFromTermAsync(StreamHandlerArgs<GetHintsFromTermArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            List<string> results;
            switch (args.Data!.Kind)
            {
                case "pmconvo":
                    results = await _chatLogWriter.GetPMConvoHintsFromPartialNameAsync(
                        args.Data.LogsFor,
                        args.Data.Term,
                        cancellationToken);
                    break;
                case "channel":
                    results = await _chatLogWriter.GetChannelHintsFromPartialNameAsync(
                        args.Data.Term,
                        cancellationToken);
                    break;
                default:
                    results = new List<string>();
                    break;
            }

            await args.WriteMessageAsync("gotHintsFromTerm", 
                new GotHintsFromTermResponse() { Hints = results },
                cancellationToken);
        }

        private async Task ValidateSearchTextAsync(StreamHandlerArgs<ValidateSearchTextArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            bool result;
            switch (args.Data!.Kind)
            {
                case "pmconvo":
                    {
                        result = await _chatLogSearch.ValidatePMConvoInLogsAsync(
                            args.Data.LogsFor,
                            args.Data.SearchText,
                            cancellationToken);
                        break;
                    }
                case "channel":
                    {
                        result = await _chatLogSearch.ValidateChannelInLogsAsync(
                            args.Data.SearchText,
                            cancellationToken);
                        break;
                    }
                default:
                    result = false;
                    break;
            }

            await args.WriteMessageAsync("validatedSearchText",
                new ValidatedSearchTextResponse() { IsValid = result },
                cancellationToken);
        }

        private async Task PerformChannelSearchAsync(StreamHandlerArgs<PerformChannelSearchArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            var results = await _chatLogWriter.GetChannelMessagesAsync(
                    args.Data!.SearchText,
                    args.Data.DateAnchor == "after"
                        ? DateAnchor.After
                        : DateAnchor.Before,
                    DateTimeOffset.FromUnixTimeMilliseconds(args.Data.Date).UtcDateTime,
                    args.Data.MaxEntries, cancellationToken);

            await args.WriteMessageAsync("performedChannelSearch",
                new PerformedChannelSearchResponse() { Results = results },
                cancellationToken);
        }

        private async Task PerformPMConvoSearchAsync(StreamHandlerArgs<PerformPMConvoSearchArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            var results = await _chatLogWriter.GetPMConvoMessagesAsync(
                    args.Data!.LogsFor,
                    args.Data.SearchText,
                    args.Data.DateAnchor == "after"
                        ? DateAnchor.After
                        : DateAnchor.Before,
                    DateTimeOffset.FromUnixTimeMilliseconds(args.Data.Date).UtcDateTime,
                    args.Data.MaxEntries, cancellationToken);

            await args.WriteMessageAsync("performedPMConvoSearch",
                new PerformedPMConvoSearchResponse() { Results = results },
                cancellationToken);
        }

        private async Task PerformRecentConversationsSearchAsync(StreamHandlerArgs<PerformRecentConversationsSearchArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            var results = await _chatLogSearch.GetRecentConversationsAsync(
                args.Data!.LogsFor,
                args.Data.ResultLimit,
                cancellationToken);

            await args.WriteMessageAsync("gotRecentConversations",
                new PerformRecentConversationsSearchResponse() { Results = new List<RecentConversationInfo>(results) },
                cancellationToken);
        }

        private async Task GetHintsForChannelTitleAsync(StreamHandlerArgs<GetHintsForChannelTitleArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            try
            {
                var results = await _chatLogSearch.GetChannelNamesAsync(args.Data!.Title, cancellationToken);

                await args.WriteMessageAsync("gotHintsForChannelTitle",
                    new TypedResponse<List<string>> { Result = results.ToList() },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                await args.WriteMessageAsync("gotHintsForChannelTitleError", 
                    new ErrorResponse { ErrorMessage = ex.Message }, 
                    cancellationToken);
            }
        }

        private async Task GetHintsForMyCharacterNameAsync(StreamHandlerArgs<GetHintsForMyCharacterNameArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            try
            {
                var matches = new List<string>();

                var results = await _chatLogSearch.GetMyCharacterInfosAsync(cancellationToken);
                foreach (var item in results)
                {
                    if (item.CharacterName.StartsWith(args.Data!.MyName, StringComparison.OrdinalIgnoreCase))
                    {
                        matches.Add(item.CharacterName);
                    }
                }

                await args.WriteMessageAsync("gotHintsForMyCharacterName",
                    new TypedResponse<List<string>> { Result = matches.OrderBy(x => x, StringComparer.OrdinalIgnoreCase).ToList() },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                await args.WriteMessageAsync("gotHintsForMyCharacterNameError",
                    new ErrorResponse { ErrorMessage = ex.Message },
                    cancellationToken);
            }
        }

        private async Task GetHintsForInterlocutorCharacterNameAsync(StreamHandlerArgs<GetHintsForInterlocutorCharacterNameArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            try
            {
                var matches = new List<string>();

                var results = await _chatLogSearch.GetInterlocutorInfosAsync(args.Data!.MyName, cancellationToken);
                foreach (var item in results)
                {
                    matches.Add(item.CharacterName);
                }

                await args.WriteMessageAsync("gotHintsForInterlocutorCharacterName",
                    new TypedResponse<List<string>> { Result = matches.OrderBy(x => x, StringComparer.OrdinalIgnoreCase).ToList() },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                await args.WriteMessageAsync("gotHintsForInterlocutorCharacterNameError",
                    new ErrorResponse { ErrorMessage = ex.Message },
                    cancellationToken);
            }
        }

        private async Task SearchChannelMessageDatesAsync(StreamHandlerArgs<SearchChannelMessageDatesArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            try
            {
                var results = await _chatLogSearch.GetChannelMessageDatesAsync(args.Data!.Title, cancellationToken);
                
                await args.WriteMessageAsync("searchedChannelMessageDates",
                    new TypedResponse<List<ExplicitDate>> { Result = new(results) },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                await args.WriteMessageAsync("searchedChannelMessageDatesError",
                    new ErrorResponse { ErrorMessage = ex.Message },
                    cancellationToken);
            }
        }

        private async Task SearchPMConversationDatesAsync(StreamHandlerArgs<SearchPMConversationDatesArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            try
            {
                var results = await _chatLogSearch.GetPMConversationDatesAsync(
                    args.Data!.MyCharName, args.Data!.InterlocutorCharName, cancellationToken);

                await args.WriteMessageAsync("searchedPMConversationDates",
                    new TypedResponse<List<ExplicitDate>> { Result = new(results) },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                await args.WriteMessageAsync("searchedPMConversationDatesError",
                    new ErrorResponse { ErrorMessage = ex.Message },
                    cancellationToken);
            }
        }

        private async Task GetChannelMessagesAsync(StreamHandlerArgs<GetChannelMessagesArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            try
            {
                var results = await _chatLogSearch.GetChannelMessagesAsync(
                    args.Data!.Title, args.Data.FromDate, args.Data.ToDate, cancellationToken);

                await args.WriteMessageAsync("gotChannelMessages",
                    new TypedResponse<List<LogSearchResultChannelMessage>> { Result = new(results) },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                await args.WriteMessageAsync("gotChannelMessagesError",
                    new ErrorResponse { ErrorMessage = ex.Message },
                    cancellationToken);
            }
        }

        private async Task GetPMConversationMessagesAsync(StreamHandlerArgs<GetPMConversationMessagesArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            try
            {
                var results = await _chatLogSearch.GetPMConversationMessagesAsync(
                    args.Data!.MyCharName, args.Data.InterlocutorCharName, args.Data.FromDate, args.Data.ToDate, cancellationToken);

                await args.WriteMessageAsync("gotPMConversationMessages",
                    new TypedResponse<List<LogSearchResultPMConvoMessage>> { Result = new(results) },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                await args.WriteMessageAsync("gotPMConversationMessagesError",
                    new ErrorResponse { ErrorMessage = ex.Message },
                    cancellationToken);
            }
        }
    }

    public class GetHintsFromTermArgs : StreamCommandMessage
    {
        [JsonPropertyName("logsFor")]
        public string LogsFor { get; set; } = "";

        [JsonPropertyName("kind")]
        public string Kind { get; set; } = "";

        [JsonPropertyName("term")]
        public string Term { get; set; } = "";
    }

    public class GotHintsFromTermResponse : StreamCommandMessage
    {
        [JsonPropertyName("hints")]
        public List<string> Hints { get; set; } = new List<string>();
    }

    public class ValidateSearchTextArgs : StreamCommandMessage
    {
        [JsonPropertyName("logsFor")]
        public string LogsFor { get; set; } = "";

        [JsonPropertyName("kind")]
        public string Kind { get; set; } = "";

        [JsonPropertyName("searchText")]
        public string SearchText { get; set; } = "";
    }

    public class ValidatedSearchTextResponse: StreamCommandMessage
    {
        [JsonPropertyName("isValid")]
        public bool IsValid { get; set; }
    }

    public class PerformChannelSearchArgs : StreamCommandMessage
    {
        [JsonPropertyName("searchText")]
        public string SearchText { get; set; } = "";

        [JsonPropertyName("dateAnchor")]
        public string DateAnchor { get; set; } = "";

        [JsonPropertyName("date")]
        public long Date { get; set; }

        [JsonPropertyName("maxEntries")]
        public int MaxEntries { get; set; } = 200;
    }

    public class PerformedChannelSearchResponse : StreamCommandMessage
    {
        [JsonPropertyName("results")]
        public List<LoggedChannelMessageInfo> Results { get; set; } = new List<LoggedChannelMessageInfo>();
    }

    public class PerformPMConvoSearchArgs : StreamCommandMessage
    {
        [JsonPropertyName("logsFor")]
        public string LogsFor { get; set; } = "";

        [JsonPropertyName("searchText")]
        public string SearchText { get; set; } = "";

        [JsonPropertyName("dateAnchor")]
        public string DateAnchor { get; set; } = "";

        [JsonPropertyName("date")]
        public long Date { get; set; }

        [JsonPropertyName("maxEntries")]
        public int MaxEntries { get; set; } = 200;
    }

    public class PerformedPMConvoSearchResponse : StreamCommandMessage
    {
        [JsonPropertyName("results")]
        public List<LoggedPMConvoMessageInfo> Results { get; set; } = new List<LoggedPMConvoMessageInfo>();
    }

    public class PerformRecentConversationsSearchArgs : StreamCommandMessage
    {
        [JsonPropertyName("logsFor")]
        public string LogsFor { get; set; } = "";

        [JsonPropertyName("resultLimit")]
        public int ResultLimit { get; set; } = 100;
    }

    public class PerformRecentConversationsSearchResponse : StreamCommandMessage
    {
        [JsonPropertyName("results")]
        public List<RecentConversationInfo> Results { get; set; } = new List<RecentConversationInfo>();
    }

    public class GetHintsForChannelTitleArgs : StreamCommandMessage
    {
        [JsonPropertyName("title")]
        public required string Title { get; set; }
    }

    public class GetHintsForMyCharacterNameArgs : StreamCommandMessage
    {
        [JsonPropertyName("myName")]
        public required string MyName { get; set; }
    }

    public class GetHintsForInterlocutorCharacterNameArgs : StreamCommandMessage
    {
        [JsonPropertyName("myName")]
        public required string MyName { get; set; }

        [JsonPropertyName("interlocutorName")]
        public required string InterlocutorName { get; set; }
    }

    public class SearchChannelMessageDatesArgs : StreamCommandMessage
    {
        [JsonPropertyName("title")]
        public required string Title { get; set; }
    }

    public class SearchPMConversationDatesArgs : StreamCommandMessage
    {
        [JsonPropertyName("myCharName")]
        public required string MyCharName { get; set; }

        [JsonPropertyName("interlocutorCharName")]
        public required string InterlocutorCharName { get; set; }
    }

    public class GetChannelMessagesArgs : StreamCommandMessage
    {
        [JsonPropertyName("title")]
        public required string Title { get; set; }

        [JsonPropertyName("fromDate")]
        public required ExplicitDate FromDate { get; set; }

        [JsonPropertyName("toDate")]
        public required ExplicitDate ToDate { get; set; }
    }

    public class GetPMConversationMessagesArgs : StreamCommandMessage
    {
        [JsonPropertyName("myCharName")]
        public required string MyCharName { get; set; }

        [JsonPropertyName("interlocutorCharName")]
        public required string InterlocutorCharName { get; set; }

        [JsonPropertyName("fromDate")]
        public required ExplicitDate FromDate { get; set; }

        [JsonPropertyName("toDate")]
        public required ExplicitDate ToDate { get; set; }
    }

    public class TypedResponse<T> : StreamCommandMessage
    {
        [JsonPropertyName("result")]
        public required T Result { get; set; }
    }

    public class ErrorResponse : StreamCommandMessage
    {
        [JsonPropertyName("message")]
        public required string ErrorMessage { get; set; }
    }




    [JsonSerializable(typeof(GetHintsFromTermArgs))]
    [JsonSerializable(typeof(GotHintsFromTermResponse))]
    [JsonSerializable(typeof(ValidateSearchTextArgs))]
    [JsonSerializable(typeof(ValidatedSearchTextResponse))]
    [JsonSerializable(typeof(PerformChannelSearchArgs))]
    [JsonSerializable(typeof(PerformedChannelSearchResponse))]
    [JsonSerializable(typeof(PerformPMConvoSearchArgs))]
    [JsonSerializable(typeof(PerformedPMConvoSearchResponse))]
    [JsonSerializable(typeof(PerformRecentConversationsSearchArgs))]
    [JsonSerializable(typeof(PerformRecentConversationsSearchResponse))]
    [JsonSerializable(typeof(GetHintsForChannelTitleArgs))]
    [JsonSerializable(typeof(GetHintsForMyCharacterNameArgs))]
    [JsonSerializable(typeof(GetHintsForInterlocutorCharacterNameArgs))]
    [JsonSerializable(typeof(SearchChannelMessageDatesArgs))]
    [JsonSerializable(typeof(SearchPMConversationDatesArgs))]
    [JsonSerializable(typeof(GetChannelMessagesArgs))]
    [JsonSerializable(typeof(GetPMConversationMessagesArgs))]
    [JsonSerializable(typeof(TypedResponse<List<string>>))]
    [JsonSerializable(typeof(TypedResponse<List<ExplicitDate>>))]
    [JsonSerializable(typeof(TypedResponse<List<LogSearchResultChannelMessage>>))]
    [JsonSerializable(typeof(TypedResponse<List<LogSearchResultPMConvoMessage>>))]
    [JsonSerializable(typeof(ErrorResponse))]
    internal partial class LogSearchSourceGenerationContext : JsonSerializerContext
    {
    }
}