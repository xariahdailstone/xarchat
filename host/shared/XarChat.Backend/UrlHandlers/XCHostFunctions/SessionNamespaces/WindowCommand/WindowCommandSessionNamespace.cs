using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using System.Threading.Tasks;
using XarChat.Backend.Features.CommandableWindows;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.SessionNamespaces.WindowCommand
{
    internal class WindowCommandSessionNamespace : SessionNamespaceBase
    {
        private readonly ICommandableWindowRegistry _commandableWindowRegistry;

        public WindowCommandSessionNamespace(
            ICommandableWindowRegistry commandableWindowRegistry,
            Func<string, string?, CancellationToken, Task> writeMessageFunc)
            : base(writeMessageFunc)
        {
            _commandableWindowRegistry = commandableWindowRegistry;

            this.RegisterTypedStreamCommandHandler<ExecuteWindowCommandArgs>(
                "executeWindowCommand",
                ExecuteWindowCommandAsync);
        }

        protected override JsonTypeInfo GetTypeInfo(Type type)
            => WindowCommandSourceGenerationContext.Default.GetTypeInfo(type)!;

        private async Task ExecuteWindowCommandAsync(StreamHandlerArgs<ExecuteWindowCommandArgs> args)
        {
            var cancellationToken = args.CancellationToken;

            ExecuteWindowCommandResponse response;

            if (args.Data is null)
            {
                response = new ExecuteWindowCommandResponse()
                {
                    ErrorMessage = "No data supplied"
                };
            }
            else if (_commandableWindowRegistry.TryGetWindowById(args.Data.WindowId, out var cwindow))
            {
                try
                {
                    var res = await cwindow.ExecuteCommandAsync(args.Data.CommandArguments, cancellationToken);
                    response = new ExecuteWindowCommandResponse()
                    {
                        CommandResult = res
                    };
                }
                catch (Exception ex)
                {
                    response = new ExecuteWindowCommandResponse()
                    {
                        ErrorMessage = $"Command failed: {ex.Message}"
                    };
                }
            }
            else
            {
                response = new ExecuteWindowCommandResponse()
                {
                    ErrorMessage = $"Unknown window id: {args.Data.WindowId}"
                };
            }

            await args.WriteMessageAsync("executedWindowCommand", response, cancellationToken);
        }
    }

    public class ExecuteWindowCommandArgs : StreamCommandMessage
    {
        [JsonPropertyName("windowId")]
        public int WindowId { get; set; }

        [JsonPropertyName("args")]
        public required JsonObject CommandArguments { get; set; }
    }

    public class ExecuteWindowCommandResponse : StreamCommandMessage
    {
        [JsonPropertyName("errorMessage")]
        public string? ErrorMessage { get; set; }

        [JsonPropertyName("result")]
        public JsonObject? CommandResult { get; set; }
    }

    [JsonSerializable(typeof(ExecuteWindowCommandArgs))]
    [JsonSerializable(typeof(ExecuteWindowCommandResponse))]
    internal partial class WindowCommandSourceGenerationContext : JsonSerializerContext
    {
    }
}
