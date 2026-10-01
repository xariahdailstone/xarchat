using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using XarChat.Backend.Features.AppFileServer;

namespace XarChat.Backend.UrlHandlers.AllComponentsScript
{
    public static class AllComponentsScriptExtensions
    {
        public static void UseAllComponentsScript(this WebApplication app)
        {
            app.MapGet("/app/build/all-components.js", GetAllComponentsScriptAsync);

            app.MapGet("/app/build/all-pattern.js", GetAllPatternedScriptsAsync);
        }

        private static async Task<IResult> GetAllPatternedScriptsAsync(
            [FromQuery] string pattern,
            [FromServices] IAppFileServer appFileServer,
            CancellationToken cancellationToken)
        {
            var sb = new StringBuilder();

            var re = FilenamePatternToRegex(pattern);
            foreach (var f in await appFileServer.ListFilesAsync(cancellationToken))
            {
                var fixedF = f.Replace("\\", "/");
                if (fixedF.StartsWith("build/"))
                {
                    fixedF = fixedF.Substring("build/".Length);
                }

                if (re.IsMatch(fixedF))
                {
                    sb.AppendLine($"await import(\"./{fixedF}\");");
                }
            }

            return Results.Content(
                content: sb.ToString(),
                contentType: "text/javascript",
                contentEncoding: Encoding.UTF8,
                statusCode: 200);
        }

        private static Regex FilenamePatternToRegex(string pattern)
        {
            var sb = new StringBuilder();
            foreach (var ch in pattern)
            {
                switch (ch)
                {
                    case '?':
                        sb.Append(".");
                        break;
                    case '*':
                        sb.Append(".*");
                        break;
                    default:
                        sb.Append(Regex.Escape(new string(ch, 1)));
                        break;
                }
            }
            return new Regex(sb.ToString());
        }

        private static async Task<IResult> GetAllComponentsScriptAsync(
            [FromServices] IAppFileServer appFileServer,
            CancellationToken cancellationToken)
        {
            return await GetAllPatternedScriptsAsync("components/*.js", appFileServer, cancellationToken);
        }
    }
}
