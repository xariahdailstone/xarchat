using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.NewAppSettings;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.SessionAdapters.OldNewAppSettings
{
    internal class SessionNewAppSettingsAdapter : SessionAdapter
    {
        private readonly INewAppSettings _newAppSettings;

        public SessionNewAppSettingsAdapter(INewAppSettings newAppSettings)
        {
            _newAppSettings = newAppSettings;

            this.RegisterTypedCommand(
                "SavedLogins.get",
                SourceGenerationContext.Default.JsonNode,
                SourceGenerationContext.Default.ListSavedLoginJson,
                GetSavedLoginsAsync);
            this.RegisterTypedCommand(
                "SavedLogins.add",
                SourceGenerationContext.Default.SavedLoginJson,
                SourceGenerationContext.Default.ListSavedLoginJson,
                AddSavedLoginAsync);
            this.RegisterTypedCommand(
                "SavedLogins.remove",
                SourceGenerationContext.Default.SavedLoginJson,
                SourceGenerationContext.Default.ListSavedLoginJson,
                RemoveSavedLoginAsync);
        }

        const string SETTINGNAME_SavedLogins = "SavedLogins";

        private async Task<List<SavedLoginJson>> GetSavedLoginsAsync(string cmd, JsonNode data, CancellationToken cancellationToken)
        {
            var result = await _newAppSettings.GetValueSnapshotAsync<List<SavedLoginJson>>(
                SETTINGNAME_SavedLogins,
                SourceGenerationContext.Default.ListSavedLoginJson,
                () => new List<SavedLoginJson>(),
                cancellationToken);
            return result;
        }

        private async Task<List<SavedLoginJson>> AddSavedLoginAsync(string cmd, SavedLoginJson data, CancellationToken cancellationToken)
        {
            await using var vsnapshot = await _newAppSettings.CheckoutValueAsync<List<SavedLoginJson>>(
                SETTINGNAME_SavedLogins,
                SourceGenerationContext.Default.ListSavedLoginJson,
                () => new List<SavedLoginJson>(),
                cancellationToken);
            var savedLogins = vsnapshot.Value;

            savedLogins.Add(data);

            vsnapshot.Value = savedLogins;
            await vsnapshot.SaveChangeAsync(cancellationToken);

            return savedLogins;
        }

        private async Task<List<SavedLoginJson>> RemoveSavedLoginAsync(string cmd, SavedLoginJson data, CancellationToken cancellationToken)
        {
            await using var vsnapshot = await _newAppSettings.CheckoutValueAsync<List<SavedLoginJson>>(
                SETTINGNAME_SavedLogins,
                SourceGenerationContext.Default.ListSavedLoginJson,
                () => new List<SavedLoginJson>(),
                cancellationToken);
            var savedLogins = vsnapshot.Value;

            foreach (var sl in savedLogins.ToArray())
            {
                if ((data.AccountName == null || string.Equals(data.AccountName, sl.AccountName, StringComparison.OrdinalIgnoreCase)) &&
                    (data.CharacterName == null || string.Equals(data.CharacterName, sl.CharacterName, StringComparison.OrdinalIgnoreCase)))
                {
                    savedLogins.Remove(sl);
                }
            }

            vsnapshot.Value = savedLogins;
            await vsnapshot.SaveChangeAsync(cancellationToken);

            return savedLogins;
        }
    }

    internal class SavedLoginJson
    {
        [JsonPropertyName("accountName")]
        public string? AccountName { get; set; }

        [JsonPropertyName("characterName")]
        public string? CharacterName { get; set; }
    }
}
