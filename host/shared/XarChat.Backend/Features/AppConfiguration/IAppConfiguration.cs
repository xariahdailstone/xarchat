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

        Task SetArbitraryValueAsync(string key, JsonNode? value, CancellationToken cancellationToken);

        IDisposable OnValueChanged(Action<string, JsonNode?> callback);

        IDisposable OnValueChanged(string watchKey, Action<JsonNode?> callback, bool fireImmediately);
    }
}
