using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Mime;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.FListApi;
using XarChat.Backend.Features.FListApi.Impl;

namespace XarChat.Backend.UrlHandlers.FListApiProxy
{
    internal static class WebApplicationExtensions
    {
        public static void UseFListApiProxy(this WebApplication app, string urlBase)
        {
            var flistApi = app.Services.GetRequiredService<IFListApi>();

            if (!urlBase.EndsWith("/")) urlBase = urlBase + "/";

            // Unauthenticated API
            app.MapGet(urlBase + "mappingList", async (
                HttpContext context,
                CancellationToken cancellationToken) =>
            {
                var result = await flistApi.GetMappingListAsync(cancellationToken);
                return CustomResults.NewtonsoftJsonResult(result, SourceGenerationContext.Default.MappingList);
            });
            app.MapGet(urlBase + "kinkList", async (
                CancellationToken cancellationToken) =>
            {
                var result = await flistApi.GetKinksListAsync(cancellationToken);
                return CustomResults.NewtonsoftJsonResult(result, SourceGenerationContext.Default.KinksList);
            });
            app.MapGet(urlBase + "profileFieldInfoList", async (
                CancellationToken cancellationToken) =>
            {
                var result = await flistApi.GetProfileFieldsInfoListAsync(cancellationToken);
                return CustomResults.NewtonsoftJsonResult(result, SourceGenerationContext.Default.ProfileFieldsInfoList);
            });
            app.MapPost(urlBase + "authenticate", async (
                HttpRequest request,
                CancellationToken cancellationToken) =>
            {
                var account = request.Form["account"].First()!.ToString();
                var password = request.Form["password"].First()!.ToString();

                await flistApi.GetAuthenticatedFListApiAsync(account, password, cancellationToken);
                return CustomResults.NewtonsoftJsonResult(new JsonObject(), SourceGenerationContext.Default.JsonObject);
            });

            // Authenticated API
            app.MapPost(urlBase + "{account}/addBookmark", async (
                HttpRequest request,
                [FromRoute] string account,
                CancellationToken cancellationToken) =>
            {
                var name = request.Form["name"].First()!.ToString();

                var authApi = await flistApi.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);
                await authApi.AddBookmarkAsync(name, cancellationToken);
                return CustomResults.NewtonsoftJsonResult(new JsonObject(), SourceGenerationContext.Default.JsonObject);
            });
            app.MapPost(urlBase + "{account}/removeBookmark", async (
                HttpRequest request,
                [FromRoute] string account,
                CancellationToken cancellationToken) =>
            {
                var name = request.Form["name"].First()!.ToString();

                var authApi = await flistApi.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);
                await authApi.RemoveBookmarkAsync(name, cancellationToken);
                return CustomResults.NewtonsoftJsonResult(new JsonObject(), SourceGenerationContext.Default.JsonObject);
            });
            app.MapPost(urlBase + "{account}/saveMemo", async (
                HttpRequest request,
                [FromRoute] string account,
                CancellationToken cancellationToken) =>
            {
                var name = request.Form["target_name"].First()!.ToString();
                var memo = request.Form["note"].First()!.ToString();

                var authApi = await flistApi.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);
                var response = await authApi.SaveMemoAsync(name, memo, cancellationToken);
                return CustomResults.NewtonsoftJsonResult(response, SourceGenerationContext.Default.SaveMemoResponse);
            });
            app.MapGet(urlBase + "{account}/friendsList", async (
                [FromRoute] string account,
                CancellationToken cancellationToken) =>
            {
                var authApi = await flistApi.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);
                var result = await authApi.GetFriendsListAsync(cancellationToken);
                return CustomResults.NewtonsoftJsonResult(result, SourceGenerationContext.Default.FriendsList);
            });
            app.MapGet(urlBase + "{account}/profile/{name}", async (
                [FromRoute] string account,
                [FromRoute] string name,
                [FromQuery] bool? bypassCache,
                CancellationToken cancellationToken) =>
            {
                var authApi = await flistApi.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);
                try
                {
                    var result = await authApi.GetCharacterProfileAsync(name, bypassCache ?? false, cancellationToken);
                    return CustomResults.NewtonsoftJsonResult(result, SourceGenerationContext.Default.ProfileInfo);
                }
                catch (FListApiException ex)
                {
					return CustomResults.NewtonsoftJsonResult(new FListApiErrorResponse() 
                    { 
                        Error = ex.Message,
                    }, SourceGenerationContext.Default.FListApiErrorResponse, 500);
				}
            });
            app.MapGet(urlBase + "{account}/ticket", async (
                [FromRoute] string account,
                CancellationToken cancellationToken) =>
            {
                var authApi = await flistApi.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);
                var resultWFC = await authApi.GetApiTicketAsync(cancellationToken);
                return CustomResults.NewtonsoftJsonResult(resultWFC.Value, SourceGenerationContext.Default.ApiTicket);
            });
            app.MapPost(urlBase + "{account}/invalidateTicket", async (
                HttpRequest request,
                [FromRoute] string account,
                CancellationToken cancellationToken) =>
            {
                var ticket = request.Form["ticket"].First()!.ToString();

                var authApi = await flistApi.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);
                await authApi.InvalidateApiTicketAsync(ticket, cancellationToken);
                var resultWFC = await authApi.GetApiTicketAsync(cancellationToken);
                return CustomResults.NewtonsoftJsonResult(resultWFC.Value, SourceGenerationContext.Default.ApiTicket);
            });
#if DEBUG
            app.MapGet(urlBase + "{account}/breakTicket", async (
                [FromRoute] string account,
                CancellationToken cancellationToken) =>
            {
                var authApi = await flistApi.GetAlreadyAuthenticatedFListApiAsync(account, cancellationToken);

                await authApi.DebugBreakTicketAsync(cancellationToken);
                return CustomResults.NewtonsoftJsonResult(new JsonObject(), SourceGenerationContext.Default.JsonObject);
            });
#endif
        }
    }

}
