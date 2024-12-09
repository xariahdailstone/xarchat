using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using System.Threading.Tasks;
using XarChat.Backend.Common;

namespace XarChat.Backend
{
    public static class CustomResults
    {
        public static IResult NewtonsoftJsonResult<T>(T obj, JsonTypeInfo<T> jsonTypeInfo,
            int statusCode = 200)
        {
            var resultJson = JsonUtilities.Serialize(obj, jsonTypeInfo);
            var ms = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(resultJson));
            if (statusCode == 200)
            {
                return Results.Stream(ms, "application/json");
            }
            else
            {
				return new StreamStatusResult(ms, "application/json", statusCode);
            }
        }
    }


	class StreamStatusResult : IResult
	{
		public StreamStatusResult(
			Stream stream,
			string contentType = "application/json",
			int statusCode = 200)
		{
			this.Stream = stream;
			this.ContentType = contentType;
			this.StatusCode = statusCode;
		}

		public Stream Stream { get; }

		public string ContentType { get; }

		public int StatusCode { get; }

		public async Task ExecuteAsync(HttpContext httpContext)
		{
			httpContext.Response.StatusCode = this.StatusCode;
			httpContext.Response.ContentType = this.ContentType;
			await this.Stream.CopyToAsync(httpContext.Response.Body, httpContext.RequestAborted);
		}
	}
}
