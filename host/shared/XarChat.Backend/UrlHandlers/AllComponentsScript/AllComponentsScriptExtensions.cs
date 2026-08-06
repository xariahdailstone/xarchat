using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Text;
using XarChat.Backend.Features.AppFileServer;

namespace XarChat.Backend.UrlHandlers.AllComponentsScript
{
    public static class AllComponentsScriptExtensions
    {
        public static void UseAllComponentsScript(this WebApplication app)
        {
            app.MapGet("/app/build/all-components.js", GetAllComponentsScriptAsync);
        }

        private static async Task<IResult> GetAllComponentsScriptAsync(
            [FromServices] IAppFileServer appFileServer,
            CancellationToken cancellationToken)
        {
            var sb = new StringBuilder();

            foreach (var f in await appFileServer.ListFilesAsync(cancellationToken))
            {
                var fixedF = f.Replace("\\", "/");
                if (fixedF.Contains("build/components/"))
                {
                    fixedF = fixedF.Replace("build/components/", "components/");
                    sb.AppendLine($"await import(\"./{fixedF}\");");
                }
            }

            return Results.Content(
                content: sb.ToString(), 
                contentType: "text/javascript", 
                contentEncoding: Encoding.UTF8, 
                statusCode: 200);
        }
    }
}
