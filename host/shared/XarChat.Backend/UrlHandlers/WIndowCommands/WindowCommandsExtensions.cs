using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.CommandableWindows;

namespace XarChat.Backend.UrlHandlers.WIndowCommands
{
	internal static class WindowCommandsExtensions
	{
		public static void UseWindowCommands(this WebApplication app)
		{
			app.MapMethods("/api/windowcommand/{id}", ["OPTIONS"], async (HttpContext context) =>
			{
				context.Response.Headers.Append("Access-Control-Allow-Methods", "POST, OPTIONS");
				context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
				context.Response.Headers.Append("Access-Control-Max-Age", "86400");
				context.Response.StatusCode = 204;
				await context.Response.CompleteAsync();
				return Results.Empty;
			});
			app.MapPost("/api/windowcommand/{id}", PerformWindowCommandAsync);
		}

		private static async Task<IResult> PerformWindowCommandAsync(
			HttpContext httpContext,
			[FromRoute] int id,
			[FromServices] ICommandableWindowRegistry cwr,
			CancellationToken cancellationToken)
		{
			if (cwr.TryGetWindowById(id, out var window))
			{
				JsonObject reqObj;
				try
				{
					using var streamReader = new StreamReader(httpContext.Request.Body);
					var bodyString = await streamReader.ReadToEndAsync();
					reqObj = JsonSerializer.Deserialize<JsonObject>(
						bodyString, SourceGenerationContext.Default.JsonObject)!;
				}
				catch
				{
					return Results.StatusCode(400);
				}

				JsonObject respObj;
				try
				{ 
					respObj = await window.ExecuteCommandAsync(reqObj, cancellationToken);
				}
				catch
				{
					return Results.StatusCode(500);
				}

				return CustomResults.NewtonsoftJsonResult(respObj, SourceGenerationContext.Default.JsonObject);
			}
			else
			{
				return Results.NotFound();
			}
		}
	}
}
