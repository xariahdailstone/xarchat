using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization.Metadata;
using System.Threading.Tasks;
using XarChat.Backend.Common;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.SessionAdapters
{
    internal interface ISessionAdapter
    {
        Task<JsonNode> HandleCommand(string cmd, JsonNode data, CancellationToken cancellationToken);
    }

    internal abstract class SessionAdapter : ISessionAdapter
    {
        private readonly Dictionary<string, Func<string, JsonNode, CancellationToken, Task<JsonNode>>> _commands
            = new Dictionary<string, Func<string, JsonNode, CancellationToken, Task<JsonNode>>>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, Func<string, JsonNode, CancellationToken, Task<JsonNode>>> _partialCommands
            = new Dictionary<string, Func<string, JsonNode, CancellationToken, Task<JsonNode>>>(StringComparer.OrdinalIgnoreCase);

        protected void RegisterCommand(string cmd, Func<string, JsonNode, CancellationToken, Task<JsonNode>> func)
        {
            if (cmd.EndsWith("."))
            {
                _partialCommands.Add(cmd, func);
            }
            else
            {
                _commands.Add(cmd, func);
            }
        }

        protected void RegisterTypedCommand<TArgument, TResult>(string cmd, 
            JsonTypeInfo<TArgument> argTypeInfo,
            JsonTypeInfo<TResult> resultTypeInfo,
            Func<string, TArgument, CancellationToken, Task<TResult>> tfunc)
        {
            Func<string, JsonNode, CancellationToken, Task<JsonNode>> func = 
                async(string cmd, JsonNode argJson, CancellationToken cancellationToken) =>
                {
                    TArgument arg = JsonSerializer.Deserialize(argJson, argTypeInfo)!;
                    var resObj = await tfunc(cmd, arg, cancellationToken);
                    var resJson = JsonSerializer.Serialize(resObj, resultTypeInfo);
                    var resJObj = JsonSerializer.Deserialize(resJson, SourceGenerationContext.Default.JsonNode)!;
                    return resJObj;
                };

            if (cmd.EndsWith("."))
            {
                _partialCommands.Add(cmd, func);
            }
            else
            {
                _commands.Add(cmd, func);
            }
        }

        public async Task<JsonNode> HandleCommand(string cmd, JsonNode data, CancellationToken cancellationToken)
        {
            int stripLen = -1;
            if (!_commands.TryGetValue(cmd, out var func))
            {
                foreach (var kvp in _partialCommands)
                {
                    if (cmd.StartsWith(kvp.Key, StringComparison.OrdinalIgnoreCase))
                    {
                        func = kvp.Value;
                        stripLen = kvp.Key.Length;
                        break;
                    }
                }
            }
            else
            {
                stripLen = -1;
            }

            if (func != null)
            {
                var result = await func(stripLen > 0 ? cmd.Substring(stripLen) : "", data, cancellationToken);
                return result;
            }
            else
            {
                throw new NotImplementedException();
            }
        }
    }
}
