using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using XarChat.Backend.Features.ChatLogging;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces.LogFileMaintenance
{
    internal class LogFileMaintenanceSessionNamespace : SessionNamespaceBase
    {
        private readonly IChatLogWriter _chatLogWriter;

        public LogFileMaintenanceSessionNamespace(
            IChatLogWriter chatLogWriter,
            Func<string, string?, CancellationToken, Task> writeMessageFunc)
            : base(writeMessageFunc)
        {
            _chatLogWriter = chatLogWriter;

            this.RegisterTypedStreamCommandHandler<VacuumDatabaseArgs>(
                "vacuumDatabase",
                VacuumDatabaseAsync);

            this.RegisterTypedStreamCommandHandler<ClearDatabaseArgs>(
                "clearDatabase",
                ClearDatabaseAsync);

            this.RegisterTypedStreamCommandHandler<GetLogFileSizeArgs>(
                "getLogFileSize",
                GetLogFileSizeAsync);
        }

        private async Task VacuumDatabaseAsync(StreamHandlerArgs<VacuumDatabaseArgs> args)
        {
            var cancellationToken = args.CancellationToken;
            try
            {
                await _chatLogWriter.VacuumAsync(cancellationToken);

                var resultingSize = await _chatLogWriter.GetLogFileSizeAsync(CancellationToken.None);

                await args.WriteMessageAsync("vacuumDatabaseComplete",
                    new VacuumDatabaseCompleteResponse() { DatabaseSize = resultingSize },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                var resultingSize = await _chatLogWriter.GetLogFileSizeAsync(CancellationToken.None);

                await args.WriteMessageAsync("vacuumDatabaseFailed",
                    new VacuumDatabaseFailedResponse() { DatabaseSize = resultingSize, ErrorMessage = ex.Message },
                    cancellationToken);
            }
        }

        private async Task ClearDatabaseAsync(StreamHandlerArgs<ClearDatabaseArgs> args)
        {
            var cancellationToken = args.CancellationToken;
            try
            {
                await _chatLogWriter.ClearDatabaseAsync(cancellationToken);

                var resultingSize = await _chatLogWriter.GetLogFileSizeAsync(CancellationToken.None);

                await args.WriteMessageAsync("clearDatabaseComplete",
                    new ClearDatabaseCompleteResponse() { DatabaseSize = resultingSize },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                var resultingSize = await _chatLogWriter.GetLogFileSizeAsync(CancellationToken.None);

                await args.WriteMessageAsync("clearDatabaseFailed",
                    new ClearDatabaseFailedResponse() { DatabaseSize = resultingSize, ErrorMessage = ex.Message },
                    cancellationToken);
            }
        }

        private async Task GetLogFileSizeAsync(StreamHandlerArgs<GetLogFileSizeArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            var result = await _chatLogWriter.GetLogFileSizeAsync(cancellationToken);
            await args.WriteMessageAsync("gotLogFileSize",
                new GetLogFileSizeResponse() { DatabaseSize = result },
                cancellationToken);
        }

        protected override JsonTypeInfo GetTypeInfo(Type type)
            => LogFileMaintenanceSourceGenerationContext.Default.GetTypeInfo(type)!;
    }

    public class VacuumDatabaseArgs : StreamCommandMessage
    {
    }

    public class VacuumDatabaseCompleteResponse : StreamCommandMessage
    {
        [JsonPropertyName("dbSize")]
        public required long DatabaseSize { get; set; }
    }

    public class ClearDatabaseArgs : StreamCommandMessage
    {
    }

    public class ClearDatabaseCompleteResponse : StreamCommandMessage
    {
        [JsonPropertyName("dbSize")]
        public required long DatabaseSize { get; set; }
    }

    public class ClearDatabaseFailedResponse : StreamCommandMessage
    {
        [JsonPropertyName("dbSize")]
        public required long DatabaseSize { get; set; }

        [JsonPropertyName("errorMessage")]
        public required string ErrorMessage { get; set; }
    }

    public class VacuumDatabaseFailedResponse : StreamCommandMessage
    {
        [JsonPropertyName("dbSize")]
        public required long DatabaseSize { get; set; }

        [JsonPropertyName("errorMessage")]
        public required string ErrorMessage { get; set; }
    }

    public class GetLogFileSizeArgs : StreamCommandMessage
    {
    }

    public class GetLogFileSizeResponse : StreamCommandMessage
    {
        [JsonPropertyName("dbSize")]
        public required long DatabaseSize { get; set; }
    }

    [JsonSerializable(typeof(VacuumDatabaseArgs))]
    [JsonSerializable(typeof(VacuumDatabaseCompleteResponse))]
    [JsonSerializable(typeof(VacuumDatabaseFailedResponse))]
    [JsonSerializable(typeof(GetLogFileSizeArgs))]
    [JsonSerializable(typeof(GetLogFileSizeResponse))]
    [JsonSerializable(typeof(ClearDatabaseArgs))]
    [JsonSerializable(typeof(ClearDatabaseCompleteResponse))]
    [JsonSerializable(typeof(ClearDatabaseFailedResponse))]
    internal partial class LogFileMaintenanceSourceGenerationContext : JsonSerializerContext
    {
    }
}
