using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using System.Threading.Tasks;
using XarChat.Backend.Features.ChatLogImport;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces.ChatLogImport
{
    internal class ChatLogImportSessionNamespace : SessionNamespaceBase
    {
        private readonly IChatLogImporterFactory _chatLogImporterFactory;

        private class ActiveImportSession
        {
            public required IAsyncEnumerator<ChatLogImportWorkflowStep> AsyncEnumerator { get; init; }
        }

        public ChatLogImportSessionNamespace(
            IChatLogImporterFactory chatLogImporterFactory,
            Func<string, string?, CancellationToken, Task> writeMessageFunc)
            : base(writeMessageFunc)
        {
            _chatLogImporterFactory = chatLogImporterFactory;

            this.RegisterTypedStreamCommandHandler(
                "getImportOptions",
                ErrorWrappedFunc<GetImportOptionsArgs>(GetImportOptionsAsync));

            this.RegisterTypedStreamCommandHandler(
                "beginImportSession",
                ErrorWrappedFunc<BeginImportSessionArgs>(BeginImportSessionAsync));
        }

        private Func<StreamHandlerArgs<T>, Task> ErrorWrappedFunc<T>(Func<StreamHandlerArgs<T>, Task> func)
        {
            Func<StreamHandlerArgs<T>, Task> x = async (StreamHandlerArgs<T> args) =>
            {
                try
                {
                    await func(args);
                }
                catch (Exception ex)
                {
                    await args.WriteMessageAsync("error", new ErrorResponse() { Message = ex.Message }, args.CancellationToken);
                }
            };
            return x;
        }

        private async Task GetImportOptionsAsync(StreamHandlerArgs<GetImportOptionsArgs> args)
        {
            var importers = _chatLogImporterFactory.GetAllImporters();

            await args.WriteMessageAsync("gotImportOptions", new GetImportOptionsResponse()
            {
                ImporterNames = importers.Select(i => i.ImportSourceName).ToList()
            }, args.CancellationToken);
        }

        private async Task BeginImportSessionAsync(StreamHandlerArgs<BeginImportSessionArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            var importer = _chatLogImporterFactory.GetAllImporters().Where(i => i.ImportSourceName == args.Data!.ImporterName).First();

            await foreach (var curStep in importer.BeginImportWorkflowAsync(cancellationToken))
            {
                await args.WriteMessageAsync("gotImportStep", new ImportSessionStepResponse()
                { 
                    StepType = curStep.GetJsonName(),
                    StepValue = curStep.GetJsonValue()
                }, cancellationToken);

                var readResp = await args.ReadMessageAsync(cancellationToken);
                switch (readResp.Command)
                {
                    case "submitStep":
                        var hargs = JsonSerializer.Deserialize<ImportSessionStepHandleArgs>(readResp.Data!,
                            ChatLogImportSourceGenerationContext.Default.ImportSessionStepHandleArgs)!;
                        curStep.HandleClientResponse(hargs.HandleData);
                        curStep.Complete();
                        break;
                    case "cancel":
                        return;
                }
            }
        }

        protected override JsonTypeInfo GetTypeInfo(Type type)
            => ChatLogImportSourceGenerationContext.Default.GetTypeInfo(type)!;
    }

    public class GetImportOptionsArgs : StreamCommandMessage
    {
    }

    public class GetImportOptionsResponse : StreamCommandMessage
    {
        [JsonPropertyName("names")]
        public required List<string> ImporterNames { get; set; }
    }

    public class BeginImportSessionArgs : StreamCommandMessage
    {
        [JsonPropertyName("name")]
        public required string ImporterName { get; set; }
    }

    public class ImportSessionStepResponse : StreamCommandMessage
    {
        [JsonPropertyName("stepType")]
        public required string StepType { get; set; }

        [JsonPropertyName("stepValue")]
        public required JsonNode StepValue { get; set; }
    }

    public class ImportSessionStepHandleArgs : StreamCommandMessage
    {
        [JsonPropertyName("handleData")]
        public required JsonElement HandleData { get; set; }
    }

    public class ErrorResponse : StreamCommandMessage
    {
        [JsonPropertyName("message")]
        public required string Message { get; set; }
    }

    [JsonSerializable(typeof(GetImportOptionsArgs))]
    [JsonSerializable(typeof(GetImportOptionsResponse))]
    [JsonSerializable(typeof(BeginImportSessionArgs))]
    [JsonSerializable(typeof(ImportSessionStepResponse))]
    [JsonSerializable(typeof(ImportSessionStepHandleArgs))]
    [JsonSerializable(typeof(ErrorResponse))]
    internal partial class ChatLogImportSourceGenerationContext : JsonSerializerContext
    {
    }
}
