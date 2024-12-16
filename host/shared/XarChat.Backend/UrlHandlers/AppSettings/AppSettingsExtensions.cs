using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using XarChat.Backend.Features.AppSettings;

namespace XarChat.Backend.UrlHandlers.AppSettings
{
    public static class AppSettingsExtensions
    {
        public static void UseAppSettings(this WebApplication app)
        {
            app.MapGet("/api/appSettings", GetAppSettingsAsync);
            app.MapPut("/api/appSettings", PutAppSettingsAsync);
        }

        private static async Task<IResult> GetAppSettingsAsync(
            [FromServices] IAppSettingsManager appSettingsManager,
            CancellationToken cancellationToken)
        {
            var settings = appSettingsManager.GetAppSettingsData();
            return CustomResults.NewtonsoftJsonResult(settings, SourceGenerationContext.Default.AppSettingsData);
        }

        private static async Task<IResult> PutAppSettingsAsync(
            [FromServices] IAppSettingsManager appSettingsManager,
            HttpRequest request,
            CancellationToken cancellationToken)
        {
            using var bodyReader = new StreamReader(request.Body);
            var bodyJson = await bodyReader.ReadToEndAsync();

            var newSettingsObj = JsonUtilities.Deserialize<AppSettingsData>(bodyJson, SourceGenerationContext.Default.AppSettingsData)!;
            await appSettingsManager.UpdateAppSettingsData(newSettingsObj, cancellationToken);

            return Results.Ok();
        }

        public class AppSettingsData
        {
            [JsonPropertyName("savedWindowLocations")]
            public List<SavedWindowLocation> SavedWindowLocations { get; set; } = new List<SavedWindowLocation>();

            [JsonPropertyName("savedAccountCredentials")]
            public List<SavedAccountCredentials> SavedAccountCredentials { get; set; } = new List<SavedAccountCredentials>();

            [JsonPropertyName("lastUsedSavedAccount")]
            public string? LastUsedSavedAccount { get; set; }

            [JsonPropertyName("savedLogins")]
            public List<SavedLogin> SavedLogins { get; set; } = new List<SavedLogin>();

            [JsonPropertyName("savedChatStates")]
            public List<SavedChatState> SavedChatStates { get; set; } = new List<SavedChatState>();

            [JsonPropertyName("autoIdleSec")]
            public int? AutoIdleSec { get; set; }
        }

        public class SavedLogin
        {
            [JsonPropertyName("account")]
            public string Account { get; set; }

            [JsonPropertyName("characterName")]
            public string CharacterName { get; set; }
        }

        public class SavedWindowLocation
        {
            [JsonPropertyName("desktopMetrics")]
            public string DesktopMetrics { get; set; }

            [JsonPropertyName("windowX")]
            public int WindowX { get; set; }

            [JsonPropertyName("windowY")]
            public int WindowY { get; set; }

            [JsonPropertyName("windowWidth")]
            public int WindowWidth { get; set; }

            [JsonPropertyName("windowHeight")]
            public int WindowHeight { get; set; }
        }

        public class SavedAccountCredentials
        {
            [JsonPropertyName("account")]
            public string Account { get; set; }

            [JsonPropertyName("password")]
            public ProtectedString Password { get; set; }
        }

        public class SavedChatState
        {
            [JsonPropertyName("characterName")]
            public string CharacterName { get; set; }

            [JsonPropertyName("lastLogin")]
            public long? LastLogin { get; set; }

            [JsonPropertyName("pingWords")]
            public List<string> PingWords { get; set; }

            [JsonPropertyName("joinedChannels")]
            public List<SavedJoinedChannel> JoinedChannels { get; set; } = new List<SavedJoinedChannel>();

            [JsonPropertyName("pinnedChannels")]
            public List<string> PinnedChannels { get; set; } = new List<string>();

            [JsonPropertyName("pmConvos")]
            public List<SavedPMConvo> SavedPMConvos { get; set; } = new List<SavedPMConvo>();

            [JsonPropertyName("statusMessage")]
            public string? StatusMessage { get; set; }

            [JsonPropertyName("pinnedChannelSectionCollapsed")]
            public bool PinnedChannelSectionCollapsed { get; set; }

            [JsonPropertyName("unpinnedChannelSectionCollapsed")]
            public bool UnpinnedChannelSectionCollapsed { get; set; }

            [JsonPropertyName("pmConvosSectionCollapsed")]
            public bool PMConvosSectionCollapsed { get; set; }

            [JsonPropertyName("selectedChannel")]
            public string? SelectedChannel { get; set; }
        }

        public class SavedJoinedChannel
        {
            [JsonPropertyName("name")]
            public string Name { get; set; }

            [JsonPropertyName("title")]
            public string Title { get; set; }
        }

        public class SavedPMConvo
        {
            [JsonPropertyName("character")]
            public string Character { get; set; }

            [JsonPropertyName("lastInteraction")]
            public long LastInteractionAt { get; set; }
        }
    }

    [JsonConverter(typeof(ProtectedStringConverter))]
    public class ProtectedString
    {
        public ProtectedString(string value)
        {
            this.Value = value;
        }

        public string Value { get; set; }

        public static implicit operator string(ProtectedString protectedString) => protectedString.Value;

        public static implicit operator ProtectedString(string value) => new ProtectedString(value);

        public class ProtectedStringConverter : JsonConverter<ProtectedString>
        {
            public override ProtectedString? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            {
                string? jsonValue;
                switch (reader.TokenType)
                {
                    case JsonTokenType.Null:
                        reader.Read();
                        jsonValue = null;
                        break;
                    case JsonTokenType.String:
                        jsonValue = reader.GetString();
                        break;
                    default:
                        throw new ApplicationException("Expected string or null");
                }

                var psi = options.GetProtectedStringEncoders();
                var rawValue = psi.DecodeFromJsonFunc(jsonValue);
                if (rawValue == null)
                {
                    return null;
                }
                else
                {
                    return new ProtectedString(rawValue!);
                }
            }

            //public override ProtectedString? ReadJson(JsonReader reader, Type objectType, ProtectedString? existingValue, bool hasExistingValue, JsonSerializer serializer)
            //{
            //    string? jsonValue;
            //    switch (reader.TokenType)
            //    {
            //        case JsonToken.Null:
            //            jsonValue = null;
            //            break;
            //        case JsonToken.String:
            //            jsonValue = (string)reader.Value!;
            //            break;
            //        default:
            //            throw new JsonSerializationException("Expected string or null");
            //    }

            //    var psi = serializer.GetProtectedStringEncoders();
            //    var rawValue = psi.DecodeFromJsonFunc(jsonValue);
            //    if (rawValue == null)
            //    {
            //        return null;
            //    }
            //    else
            //    {
            //        return new ProtectedString(rawValue!);
            //    }
            //}

            public override void Write(Utf8JsonWriter writer, ProtectedString value, JsonSerializerOptions options)
            {
                var psi = options.GetProtectedStringEncoders();
                var jsonToWrite = psi.EncodeToJsonFunc(value?.Value);
                if (jsonToWrite == null)
                {
                    writer.WriteNullValue();
                }
                else
                {
                    writer.WriteStringValue(jsonToWrite);
                }
            }

            //public override void WriteJson(JsonWriter writer, ProtectedString? value, JsonSerializer serializer)
            //{
            //    var psi = serializer.GetProtectedStringEncoders();
            //    var jsonToWrite = psi.EncodeToJsonFunc(value?.Value);
            //    if (jsonToWrite == null)
            //    {
            //        writer.WriteNull();
            //    }
            //    else
            //    {
            //        writer.WriteValue(jsonToWrite);
            //    }
            //}
        }
    }


    public static class ProtectedStringJsonSerializerExtensions
    {
        public static void SetProtectedStringEncoders(
            this JsonSerializerOptions jser, Func<string?, string?> encodeToJsonFunc, Func<string?, string?> decodeFromJsonFunc)
        {
            var ci = new ProtectedStringConfigInfo(encodeToJsonFunc, decodeFromJsonFunc);
            jser.Converters.Add(ci);
        }

        public static IProtectedStringConfigInfo GetProtectedStringEncoders(this JsonSerializerOptions jser)
        {
            foreach (var cvt in jser.Converters)
            {
                if (cvt is ProtectedStringConfigInfo psci)
                {
                    return psci;
                }
            }
            return new ProtectedStringConfigInfo(a => a, b => b);
        }

        public interface IProtectedStringConfigInfo
        {
            Func<string?, string?> EncodeToJsonFunc { get; }

            Func<string?, string?> DecodeFromJsonFunc { get; }
        }

        internal class ProtectedStringConfigInfo : JsonConverter<ProtectedStringConfigInfo>, IProtectedStringConfigInfo
        {
            public ProtectedStringConfigInfo(Func<string?, string?> encodeToJsonFunc, Func<string?, string?> decodeFromJsonFunc)
            {
                this.EncodeToJsonFunc = encodeToJsonFunc;
                this.DecodeFromJsonFunc = decodeFromJsonFunc;
            }

            public Func<string?, string?> EncodeToJsonFunc { get; }

            public Func<string?, string?> DecodeFromJsonFunc { get; }

            public override bool CanConvert(Type objectType) => false;

            public override ProtectedStringConfigInfo Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            {
                throw new NotImplementedException();
            }

            public override void Write(Utf8JsonWriter writer, ProtectedStringConfigInfo value, JsonSerializerOptions options)
            {
                throw new NotImplementedException();
            }
        }
    }

}
