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
    internal partial class LogSearchSourceGenerationContext : JsonSerializerContext
    {
    }
}