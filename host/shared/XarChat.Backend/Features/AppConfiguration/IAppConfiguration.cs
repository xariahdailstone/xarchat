using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.AppConfiguration
{
    public interface IAppConfiguration
    {
        string WebSocketPath { get; }

        string UrlLaunchExecutable { get; }

        bool LaunchImagesInternally { get; }
        
        string ContentDirectory { get; }

        bool EnableDevTools { get; }

		bool EnableIndexDataCollection { get; }

		IEnumerable<KeyValuePair<string, JsonNode>> GetAllArbitraryValues();

        string? GetArbitraryValueString(string key);

        JsonNode GetArbitraryValue(string key);

        Task SetArbitraryValueAsync(string key, JsonNode? value, CancellationToken cancellationToken)
        {
            return SetArbitraryValueAsync(key, value, null, cancellationToken);
        }

        Task SetArbitraryValueAsync(string key, JsonNode? value, Dictionary<string, object?>? changeMetadata, CancellationToken cancellationToken);

        IDisposable OnValueChanged(Action<string, JsonNode?, Dictionary<string, object?>?> callback);

        IDisposable OnValueChanged(string watchKey, Action<JsonNode?, Dictionary<string, object?>?> callback, bool fireImmediately);
    }
}
