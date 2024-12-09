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
    }
}
