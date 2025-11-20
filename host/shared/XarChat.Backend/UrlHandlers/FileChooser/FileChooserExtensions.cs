using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.FileChooser;
using XarChat.Backend.Network;
using static XarChat.Backend.UrlHandlers.AppSettings.AppSettingsExtensions;

namespace XarChat.Backend.UrlHandlers.FileChooser
{
    internal static class FileChooserExtensions
    {
        public static void UseFileChooserHandler(this WebApplication app, string urlBase)
        {
            app.MapPost(urlBase + "/choose", ChooseLocalFileAsync);
            app.MapGet(urlBase + "/getLocalFile", GetLocalFileAsync);
        }

        private static async Task<IResult> ChooseLocalFileAsync(
            HttpRequest request,
            [FromServices] IFileChooser fileChooser,
            CancellationToken cancellationToken)
        {
            using var bodyReader = new StreamReader(request.Body);
            var bodyJson = await bodyReader.ReadToEndAsync();

            var args = JsonUtilities.Deserialize<ChooseLocalFileArgs>(bodyJson, SourceGenerationContext.Default.ChooseLocalFileArgs)!;

            var result = await fileChooser.SelectLocalFileAsync(
                initialFile: args?.SelectedFile,
                filters: args?.SelectionFilters?.Select(x => new SelectLocalFileFilterEntry(x.Name, x.Extensions)).ToList(),
                dialogTitle: args?.DialogTitle,
                cancellationToken: cancellationToken);

            return CustomResults.NewtonsoftJsonResult(result,
                SourceGenerationContext.Default.String);
        }

        private static async Task<IResult> GetLocalFileAsync(
            [FromQuery] string fn,
            CancellationToken cancellationToken)
        {
            return Results.File(fn);
        }
    }

    public class ChooseLocalFileArgs
    {
        [JsonPropertyName("title")]
        public string? DialogTitle { get; set; }

        [JsonPropertyName("file")]
        public string? SelectedFile { get; set; }

        [JsonPropertyName("filters")]
        public List<ChooseLocalFileFilter>? SelectionFilters { get; set; }
    }

    public class ChooseLocalFileFilter
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("extensions")]
        public List<string> Extensions { get; set; } = [];
    }
}
