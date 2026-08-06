using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Text;
using XarChat.Backend.Common;

namespace XarChat.Backend.Features.DebugLogCapture
{
    public sealed record RequestLogEntry(
        DateTimeOffset Timestamp,
        LogLevel Level,
        string Category,
        EventId EventId,
        string Message,
        Exception? Exception);

    public interface IRequestLogAccessor
    {
        IReadOnlyList<RequestLogEntry> Entries { get; }

        void StopCollecting();
    }

    internal sealed class RequestLogContext : IRequestLogAccessor
    {
        private static readonly AsyncLocal<List<RequestLogEntry>?> CurrentEntries = new();

        public IReadOnlyList<RequestLogEntry> Entries
            => CurrentEntries.Value ?? new List<RequestLogEntry>();

        internal static IDisposable BeginRequest()
        {
            var previous = CurrentEntries.Value;
            CurrentEntries.Value = new List<RequestLogEntry>();

            return new ActionDisposable(() =>
            {
                CurrentEntries.Value = previous;
            });
        }

        public void StopCollecting()
        {
            CurrentEntries.Value = null;
        }

        internal static void Add(RequestLogEntry entry)
        {
            if (CurrentEntries.Value is not null)
            {
                CurrentEntries.Value.Add(entry);
                while (CurrentEntries.Value.Count > 100)
                {
                    CurrentEntries.Value.RemoveAt(0);
                }
            }
        }
    }

    public sealed class RequestLogProvider : ILoggerProvider
    {
        public ILogger CreateLogger(string categoryName)
        {
            return new RequestLogger(categoryName);
        }

        public void Dispose()
        {
        }

        private sealed class RequestLogger : ILogger
        {
            private readonly string _category;

            public RequestLogger(string category)
            {
                _category = category;
            }

            public IDisposable? BeginScope<TState>(TState state) where TState : notnull
            {
                return NullScope.Instance;
            }

            public bool IsEnabled(LogLevel logLevel)
            {
                return logLevel != LogLevel.None;
            }

            public void Log<TState>(
                LogLevel logLevel,
                EventId eventId,
                TState state,
                Exception? exception,
                Func<TState, Exception?, string> formatter)
            {
                if (!IsEnabled(logLevel))
                    return;

                var message = formatter(state, exception);

                RequestLogContext.Add(new RequestLogEntry(
                    Timestamp: DateTimeOffset.UtcNow,
                    Level: logLevel,
                    Category: _category,
                    EventId: eventId,
                    Message: message,
                    Exception: exception));
            }
        }

        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();

            public void Dispose()
            {
            }
        }
    }

    public sealed class RequestLogMiddleware
    {
        private readonly RequestDelegate _next;

        public RequestLogMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            using (RequestLogContext.BeginRequest())
            {
                await _next(context);
            }
        }
    }

    public static class RequestLoggingExtensions
    {
        public static IServiceCollection AddRequestLogCapture(this IServiceCollection services)
        {
            services.TryAddSingleton<RequestLogContext>();
            services.TryAddSingleton<IRequestLogAccessor>(sp =>
                sp.GetRequiredService<RequestLogContext>());

            services.AddSingleton<ILoggerProvider, RequestLogProvider>();

            return services;
        }

        public static IApplicationBuilder UseRequestLogCapture(this IApplicationBuilder app)
        {
            return app.UseMiddleware<RequestLogMiddleware>();
        }
    }
}
