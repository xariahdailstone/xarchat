using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.ChatLogging;

namespace XarChat.Backend.UrlHandlers.Logs
{
    internal static class LogsExtensions
    {
        public static void UseLogsHandler(this WebApplication app, string urlBase)
        {
            app.MapGet(urlBase + "/getRecentLoggedChannelMessages", GetRecentLoggedChannelMessagesAsync);
            app.MapGet(urlBase + "/getRecentLoggedPMConvoMessages", GetRecentLoggedPMConvoMessagesAsync);

            app.MapGet(urlBase + "/search/count", GetLogSearchCountAsync);
            app.MapGet(urlBase + "/search/ids", GetLogSearchIdsAsync);
            app.MapGet(urlBase + "/search/results", GetLogSearchResultsAsync);
            app.MapGet(urlBase + "/search/resultsbyids", GetLogSearchResultsByIdsAsync);

            app.MapGet(urlBase + "/search/getmycharacternames", GetLogSearchMyCharacterNamesAsync);
            app.MapGet(urlBase + "/search/getchannelnames", GetLogSearchGetChannelNamesAsync);
            app.MapGet(urlBase + "/search/getinterlocutors", GetLogSearchGetInterlocutorNamesAsync);
        }

        private static async Task<IResult> GetRecentLoggedChannelMessagesAsync(
            [FromQuery] string channelName,
            [FromQuery] int maxEntries,
            [FromServices] IChatLogWriter chatLogWriter,
            CancellationToken cancellationToken)
        {
            var recentConvoMessages = await chatLogWriter.GetChannelMessagesAsync(
                channelName, 
                DateAnchor.Before, DateTime.UtcNow + TimeSpan.FromSeconds(10),
                maxEntries, cancellationToken);
            return CustomResults.NewtonsoftJsonResult(recentConvoMessages, SourceGenerationContext.Default.ListLoggedChannelMessageInfo);
        }

        private static async Task<IResult> GetRecentLoggedPMConvoMessagesAsync(
            [FromQuery] string myCharacterName,
            [FromQuery] string interlocutor,
            [FromQuery] int maxEntries,
            [FromServices] IChatLogWriter chatLogWriter,
            CancellationToken cancellationToken)
        {
            var recentConvoMessages = await chatLogWriter.GetPMConvoMessagesAsync(
                myCharacterName, interlocutor,
                DateAnchor.Before, DateTime.UtcNow + TimeSpan.FromSeconds(10),
                maxEntries, cancellationToken);
            return CustomResults.NewtonsoftJsonResult(recentConvoMessages, SourceGenerationContext.Default.ListLoggedPMConvoMessageInfo);
        }

        private static async Task<IResult> GetLogSearchCountAsync(
            HttpContext httpContext,
            [FromServices] IChatLogSearch chatLogSearch,
            CancellationToken cancellationToken)
        {
            var sc = GetSearchCriteriaFromQuery(httpContext.Request);
            var result = await chatLogSearch.GetSearchResultCountAsync(sc, cancellationToken);
            return CustomResults.NewtonsoftJsonResult(result, SourceGenerationContext.Default.Int32);
        }

        private static async Task<IResult> GetLogSearchIdsAsync(
            HttpContext httpContext,
            [FromQuery] int skip,
            [FromQuery] int take,
            [FromServices] IChatLogSearch chatLogSearch,
            CancellationToken cancellationToken)
        {
            var sc = GetSearchCriteriaFromQuery(httpContext.Request);
            var result = await chatLogSearch.GetSearchResultIdsAsync(sc, skip, take, cancellationToken);
            return CustomResults.NewtonsoftJsonResult(result, SourceGenerationContext.Default.IReadOnlyListInt64);
        }

        private static async Task<IResult> GetLogSearchResultsAsync(
            HttpContext httpContext,
            [FromQuery] int skip,
            [FromQuery] int take,
            [FromServices] IChatLogSearch chatLogSearch,
            CancellationToken cancellationToken)
        {
            var sc = GetSearchCriteriaFromQuery(httpContext.Request);
            var result = await chatLogSearch.GetSearchResultSubsetAsync(sc, skip, take, cancellationToken);
            return CustomResults.NewtonsoftJsonResult(result, SourceGenerationContext.Default.IReadOnlyListSearchResultItem);
        }

        private static async Task<IResult> GetLogSearchResultsByIdsAsync(
            HttpContext httpContext,
            [FromQuery] string idsString,
            [FromServices] IChatLogSearch chatLogSearch,
            CancellationToken cancellationToken)
        {
            var ids = idsString.Split(',').Select(x => Convert.ToInt64(x)).ToList();

            var sc = GetSearchCriteriaFromQuery(httpContext.Request);
            var result = await chatLogSearch.GetSearchResultsForIdsAsync(ids, cancellationToken);
            return CustomResults.NewtonsoftJsonResult(result, SourceGenerationContext.Default.IReadOnlyListSearchResultItem);
        }

        private static SearchCriteria GetSearchCriteriaFromQuery(HttpRequest request)
        {
            var sc = new SearchCriteria();

            if (request.Query.TryGetValue("who", out var whoStrs))
            {
                sc.WhoSpec = new SearchLogsForCharacterCriterion() { CharacterName = whoStrs.First()!.Trim() };
            }

            if (request.Query.TryGetValue("chan", out var chanStrs))
            {
                sc.StreamSpec = new SearchInChannelCriterion() { ChannelTitle = chanStrs.First()!.Trim() };
            }
            else if (request.Query.TryGetValue("pm", out var pmStrs))
            {
                // TODO: support mycharactername!
                //sc.StreamSpec = new SearchPrivateMessagesWithCriterion() { InterlocutorCharacterName = pmStrs.First()!.Trim() };
            }

            if (request.Query.TryGetValue("text", out var txtStrs))
            {
                sc.TextSpec = new SearchContainsTextCriterion() { SearchText = txtStrs.First()!.Trim() };
            }

            if (request.Query.TryGetValue("after", out var afterStrs) &&
                request.Query.TryGetValue("before", out var beforeStrs))
            {
                sc.TimeSpec = new SearchTimeSpecCriterion()
                {
                    After = DateTimeOffset.FromUnixTimeMilliseconds(Convert.ToInt64(afterStrs.First())).UtcDateTime,
                    Before = DateTimeOffset.FromUnixTimeMilliseconds(Convert.ToInt64(beforeStrs.First())).UtcDateTime,
                };
            }
            else if (request.Query.TryGetValue("after", out afterStrs))
            {
                sc.TimeSpec = new SearchTimeSpecCriterion()
                {
                    After = DateTimeOffset.FromUnixTimeMilliseconds(Convert.ToInt64(afterStrs.First())).UtcDateTime
                };
            }
            else if (request.Query.TryGetValue("before", out beforeStrs))
            {
                sc.TimeSpec = new SearchTimeSpecCriterion()
                {
                    Before = DateTimeOffset.FromUnixTimeMilliseconds(Convert.ToInt64(beforeStrs.First())).UtcDateTime
                };
            }

            return sc;
        }

        private static async Task<IResult> GetLogSearchMyCharacterNamesAsync(
            [FromServices] IChatLogSearch chatLogSearch,
            CancellationToken cancellationToken)
        {
            var result = await chatLogSearch.GetMyCharacterInfosAsync(cancellationToken);
            return CustomResults.NewtonsoftJsonResult(result, SourceGenerationContext.Default.IReadOnlyListLogCharacterInfo);
        }

        private static async Task<IResult> GetLogSearchGetChannelNamesAsync(
            [FromServices] IChatLogSearch chatLogSearch,
            CancellationToken cancellationToken)
        {
            var result = await chatLogSearch.GetChannelNamesAsync(cancellationToken);
            return CustomResults.NewtonsoftJsonResult(result, SourceGenerationContext.Default.IReadOnlyListString);
        }

        private static async Task<IResult> GetLogSearchGetInterlocutorNamesAsync(
            [FromQuery] string? who,
            [FromServices] IChatLogSearch chatLogSearch,
            CancellationToken cancellationToken)
        {
            var result = await chatLogSearch.GetInterlocutorInfosAsync(who, cancellationToken);
            return CustomResults.NewtonsoftJsonResult(result, SourceGenerationContext.Default.IReadOnlyListLogCharacterInfo);
        }
    }
}
