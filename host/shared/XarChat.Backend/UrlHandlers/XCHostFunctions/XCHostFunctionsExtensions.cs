using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.UrlHandlers.ChatSocket;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions
{
    internal static class XCHostFunctionsExtensions
    {
        public static void AddXCHostSession(this IServiceCollection services)
        {
            services.AddSingleton<XCHostSessionProvider>();
            services.AddSingleton<IXCHostSessionProvider>(sp => sp.GetRequiredService<XCHostSessionProvider>());

            services.AddTransient<IXCHostSession>(sp =>
            {
                var prov = sp.GetRequiredService<XCHostSessionProvider>();
                return prov.XCHostSession;
            });
        }

        public static void AddXCHostCommandHandler<T>(this IServiceCollection services, string cmd)
            where T : class, IXCHostCommandHandler
        {
            services.AddKeyedScoped<IXCHostCommandHandler, T>(cmd.ToLowerInvariant());
        }

        public static void UseXCHostFunctions(this WebApplication app, string urlBase)
        {
            app.Map(urlBase, XCHostRunAsync);
            //app.MapGet("/api/xchost/appReady", AppReadyAsync);
            //app.MapGet("/api/xchost/minimizeWindow", MinimizeWindowAsync);
            //app.MapGet("/api/xchost/maximizeWindow", MaximizeWindowAsync);
            //app.MapGet("/api/xchost/closeWindow", CloseWindowAsync);
            //app.MapGet("/api/xchost/showDevTools", ShowDevToolsAsync);
            //app.MapGet("/api/xchost/logChannelMessage", LogChannelMessageAsync);
            //app.MapGet("/api/xchost/registerIdleDetectionCallback", RegisterIdleDetectionCallbackAsync);
            //app.MapGet("/api/xchost/unregisterIdleDetectionCallback", UnregisterIdleDetectionCallbackAsync);
        }

        private static async Task<IResult> XCHostRunAsync(
            HttpContext context,
            [FromServices] IHostApplicationLifetime hostApplicationLifetime,
            CancellationToken cancellationToken)
        {
            using var ccts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken, hostApplicationLifetime.ApplicationStopping);
            
            cancellationToken = ccts.Token;

            try
            {
                if (context.WebSockets.IsWebSocketRequest)
                {
                    var sessProvider = context.RequestServices.GetRequiredService<IXCHostSessionProvider>();

                    var cws = await context.WebSockets.AcceptWebSocketAsync();
                    try
                    {
                        using var sess = new WebSocketXCHostSession(context.RequestServices, cws);
                        sessProvider.SetXCHostSession(sess);
                        await sess.RunAsync(cancellationToken);
                    }
                    catch
                    {
                    }

                    return EmptyHttpResult.Instance;
                }
                else
                {
                    return Results.BadRequest();
                }
            }
            catch
            {
                return Results.StatusCode(500);
            }
        }
    }
}
