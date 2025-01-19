using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppConfiguration.Impl;
using XarChat.Backend.Features.AppSettings;
using XarChat.Backend.Features.ChatLogging;
using XarChat.Backend.Features.EIconUpdateSubmitter.Impl;
using XarChat.Backend.Features.FListApi;
using XarChat.Backend.UrlHandlers.AppSettings;
using XarChat.Backend.UrlHandlers.FileChooser;
using XarChat.Backend.UrlHandlers.FListApiProxy;
using XarChat.Backend.UrlHandlers.XCHostFunctions.SessionAdapters.OldNewAppSettings;
using static XarChat.Backend.UrlHandlers.AppSettings.AppSettingsExtensions;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.Common
{
    public static class JsonUtilities
    {
        private static JsonSerializerOptions DefaultJsonSerializerOptions { get; } = new JsonSerializerOptions()
        {
            WriteIndented = true
        };

        public static T Deserialize<T>(string json, JsonTypeInfo<T> jsonTypeInfo)
        {
            var result = System.Text.Json.JsonSerializer.Deserialize<T>(json, jsonTypeInfo)!;
            return result;
        }

        public static string Serialize<T>(T obj, JsonTypeInfo<T> jsonTypeInfo)
        {
            var result = System.Text.Json.JsonSerializer.Serialize(obj, jsonTypeInfo);
            return result;
        }

        public static void Serialize<T>(Utf8JsonWriter writer, T obj, JsonTypeInfo<T> jsonTypeInfo)
        {
            System.Text.Json.JsonSerializer.Serialize(writer, obj, jsonTypeInfo);
        }
    }

    [JsonSourceGenerationOptions(WriteIndented = true)]
    [JsonSerializable(typeof(AppConfigurationJson))]
    [JsonSerializable(typeof(AppSettingsData))]
    [JsonSerializable(typeof(JsonObject))]
    [JsonSerializable(typeof(JsonArray))]
    [JsonSerializable(typeof(JsonNode))]
    [JsonSerializable(typeof(KinksList))]
    [JsonSerializable(typeof(MappingList))]
    [JsonSerializable(typeof(FriendsList))]
    [JsonSerializable(typeof(ProfileInfo))]
    [JsonSerializable(typeof(ProfileFieldsInfoList))]
    [JsonSerializable(typeof(LogChannelMessageArgs))]
    [JsonSerializable(typeof(LogPMConvoMessageArgs))]
    [JsonSerializable(typeof(UpdateAppBadgeArgs))]
    [JsonSerializable(typeof(AddIdleMonitorRegistrationArgs))]
    [JsonSerializable(typeof(RemoveIdleMonitorRegistrationArgs))]
    [JsonSerializable(typeof(AddUpdateCheckerMonitorRegistrationArgs))]
    [JsonSerializable(typeof(RemoveUpdateCheckerMonitorRegistrationArgs))]
    [JsonSerializable(typeof(EIconSearchArgs))]
    [JsonSerializable(typeof(EIconSearchResult))]
    [JsonSerializable(typeof(GetCssDataArgs))]
    [JsonSerializable(typeof(GotCssDataResult))]
    [JsonSerializable(typeof(GetConfigDataArgs))]
    [JsonSerializable(typeof(GotConfigDataResult))]
    [JsonSerializable(typeof(ConfigKeyValue))]
    [JsonSerializable(typeof(GetAllCssArgs))]
    [JsonSerializable(typeof(GotAllCssResult))]
    [JsonSerializable(typeof(ApiTicket))]
    [JsonSerializable(typeof(SavedLoginJson))]
    [JsonSerializable(typeof(List<SavedLoginJson>))]
    [JsonSerializable(typeof(SaveMemoResponse))]
    [JsonSerializable(typeof(List<LoggedPMConvoMessageInfo>))]
    [JsonSerializable(typeof(List<LoggedChannelMessageInfo>))]
    [JsonSerializable(typeof(Dictionary<string, JsonNode>))]
    [JsonSerializable(typeof(IImmutableDictionary<string, JsonNode>))]
    [JsonSerializable(typeof(DataUpdateSubmitBody))]
    [JsonSerializable(typeof(FListApiErrorResponse))]
    [JsonSerializable(typeof(IReadOnlyList<long>))]
    [JsonSerializable(typeof(IReadOnlyList<string>))]
    [JsonSerializable(typeof(IReadOnlyList<SearchResultItem>))]
    [JsonSerializable(typeof(IReadOnlyList<LogCharacterInfo>))]
    [JsonSerializable(typeof(ChooseLocalFileArgs))]
    [JsonSerializable(typeof(ProfileFriendsInfo))]
    [JsonSerializable(typeof(GuestbookPageInfo))]
    [JsonSerializable(typeof(SubmitEIconMetadataArgs))]
    [JsonSerializable(typeof(PartnerSearchFieldsDefinitions))]
    internal partial class SourceGenerationContext : JsonSerializerContext
    {
    }

    [JsonSerializable(typeof(JsonObject))]
    public partial class PublicSourceGenerationContext : JsonSerializerContext
    {
    }

    [JsonSourceGenerationOptions(WriteIndented = false)]
    [JsonSerializable(typeof(JsonObject))]
    internal partial class SourceGenerationContextUnindented : JsonSerializerContext
    {
    }

    [JsonSourceGenerationOptions(WriteIndented = true)]
    [JsonSerializable(typeof(AppSettingsData))]
    internal partial class SourceGenerationContextProtected : JsonSerializerContext
    {
        public SourceGenerationContextProtected(IAppSettingsDataProtectionManager? dataProtectionManager)
            : base(CreateJsonSerializerOptions(dataProtectionManager))
        {
            
        }

        private static JsonSerializerOptions CreateJsonSerializerOptions(IAppSettingsDataProtectionManager? dataProtectionManager)
        {
            var jser = new JsonSerializerOptions();
            jser.WriteIndented = true;
            jser.SetProtectedStringEncoders(
                rawValue => dataProtectionManager != null ? dataProtectionManager.Encode(rawValue) : rawValue,
                encodedValue => dataProtectionManager != null ? dataProtectionManager.Decode(encodedValue) : encodedValue);
            return jser;
        }
    }
}
