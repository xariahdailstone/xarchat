using System.Runtime.Serialization;
using System.Text.Json;
using System.Text.Json.Serialization;
using XarChat.Backend.Bridge1to2.StrongTypes;
using XarChat.FList2.Common.StrongTypes;
using XarChat.FList2.FList2Api.Entities;

namespace XarChat.Backend.Bridge1to2.Messages.Server
{
    [MessageCode(Code = "IDN")]
    public class IDNServerMessage : FChatServerMessage
    {
        [JsonPropertyName("character")]
        public required CharacterName Character { get; set; }
    }

    [MessageCode(Code = "XNN", HasBody = false)]
    public class XNNServerMessage : FChatServerMessage
    {
    }

    [MessageCode(Code = "HLO")]
    public class HLOServerMessage : FChatServerMessage
    {
        [JsonPropertyName("message")]
        public required string Message { get; set; }
    }

    [MessageCode(Code = "CON")]
    public class CONServerMessage : FChatServerMessage
    {
        [JsonPropertyName("count")]
        public required int Count { get; set; }
    }

    [MessageCode(Code = "FRL")]
    public class FRLServerMessage : FChatServerMessage
    {
        [JsonPropertyName("characters")]
        public required List<CharacterName> Characters { get; set; }
    }

    [MessageCode(Code = "IGN")]
    public class IGNServerMessage : FChatServerMessage
    {
        [JsonPropertyName("action")]
        public required IgnoreListAction Action { get; set; }

        [JsonPropertyName("characters")]
        public List<CharacterName> Characters { get; set; }
    }

    public enum IgnoreListAction
    {
        [JsonStringEnumMemberName("init")]
        Init,

        [JsonStringEnumMemberName("add")]
        Add,

        [JsonStringEnumMemberName("delete")]
        Delete
    }

    [MessageCode(Code = "ADL")]
    public class ADLServerMessage : FChatServerMessage
    {
        [JsonPropertyName("ops")]
        public required List<CharacterName> Ops { get; set; }
    }

    [MessageCode(Code = "LIS")]
    public class LISServerMessage : FChatServerMessage
    {
        [JsonPropertyName("characters")]
        public required List<ServerLISitem> Characters { get; set; }
    }

    [JsonConverter(typeof(ServerLISitem.JsonConverter))]
    public class ServerLISitem
    {
        public required CharacterName Character { get; set; }
        public required CharacterGender Gender { get; set; }
        public required FL1CharacterStatus Status { get; set; }
        public required string StatusMessage { get; set; }

        public class JsonConverter : JsonConverter<ServerLISitem>
        {
            public override ServerLISitem? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            {
                var strArray = JsonSerializer.Deserialize<string[]?>(ref reader, options);
                if (strArray is not null)
                {
                    var result = new ServerLISitem()
                    {
                        Character = CharacterName.Create(strArray[0]),
                        Gender = CharacterGender.Parse(strArray[1]),
                        Status = CharacterStatus.Parse(strArray[2]).ToFL1CharacterStatus(),
                        StatusMessage = strArray[3] ?? ""
                    };
                    return result;
                }
                else
                {
                    return null;
                }
            }

            public override void Write(Utf8JsonWriter writer, ServerLISitem value, JsonSerializerOptions options)
            {
                if (value is not null)
                {
                    writer.WriteStartArray();
                    writer.WriteStringValue(value.Character.Value);
                    writer.WriteStringValue(value.Gender.CodeValue);
                    writer.WriteStringValue(value.Status.ToString().ToLower());  // TODO: use attribs
                    writer.WriteStringValue(value.StatusMessage);
                    writer.WriteEndArray();
                }
                else
                {
                    writer.WriteNullValue();
                }
            }
        }
    }

    [MessageCode(Code = "NLN")]
    public class NLNServerMessage : FChatServerMessage
    {
        [JsonPropertyName("gender")]
        public required CharacterGender Gender { get; set; }

        [JsonPropertyName("status")]
        public required FL1CharacterStatus Status { get; set; }

        [JsonPropertyName("identity")]
        public required CharacterName Identity { get; set; }
    }

    [MessageCode(Code = "JCH")]
    public class JCHServerMessage : FChatServerMessage
    {
        [JsonPropertyName("channel")]
        public FL1ChannelName Channel { get; set; }

        [JsonPropertyName("title")]
        public required FL1ChannelTitle Title { get; set; }

        [JsonPropertyName("character")]
        public required CharacterIdentity Character { get; set; }
    }

    public class CharacterIdentity
    {
        [JsonPropertyName("identity")]
        public required CharacterName Identity { get; set; }
    }

    [MessageCode(Code = "COL")]
    public class COLServerMessage : FChatServerMessage
    {
        [JsonPropertyName("channel")]
        public required FL1ChannelName Channel { get; set; }

        [JsonPropertyName("oplist")]
        public required List<CharacterName> OpList { get; set; }
    }

    [MessageCode(Code = "ICH")]
    public class ICHServerMessage : FChatServerMessage
    {
        [JsonPropertyName("channel")]
        public required FL1ChannelName Channel { get; set; }

        [JsonPropertyName("users")]
        public required List<CharacterIdentity> Users { get; set; }

        [JsonPropertyName("mode")]
        [JsonConverter(typeof(JsonStringEnumConverter<ChannelMode>))]
        public required ChannelMode Mode { get; set; }
    }

    [JsonConverter(typeof(JsonStringEnumConverter<ChannelMode>))]
    public enum ChannelMode
    {
        [JsonStringEnumMemberName("chat")]
        Chat,

        [JsonStringEnumMemberName("ads")]
        Ads,

        [JsonStringEnumMemberName("both")]
        Both
    }

    [MessageCode(Code = "CDS")]
    public class CDSServerMessage : FChatServerMessage
    {
        [JsonPropertyName("channel")]
        public required FL1ChannelName Channel { get; set; }

        [JsonPropertyName("description")]
        public required string Description { get; set; }
    }

    [MessageCode(Code = "XHM")]
    public class XHMServerMessage : FChatServerMessage
    {
        [JsonPropertyName("channel")]
        public required string Channel { get; set; } // ch:, pm:, console

        [JsonPropertyName("character")]
        public CharacterName? Character { get; set; }

        [JsonPropertyName("characterGender")]
        public CharacterGender CharacterGender { get; set; }

        [JsonPropertyName("characterStatus")]
        public FL1CharacterStatus CharacterStatus { get; set; }

        [JsonPropertyName("seen")]
        public bool? Seen { get; set; }

        [JsonPropertyName("asof")]
        public long? AsOf { get; set; }

        [JsonPropertyName("messagetype")]
        public required string MessageType { get; set; }

        [JsonPropertyName("message")]
        public string? Message { get; set; }

        [JsonPropertyName("target")]
        public CharacterName? Target { get; set; }

        [JsonPropertyName("rolls")]
        public List<string>? Rolls { get; set; }

        [JsonPropertyName("results")]
        public List<int>? Results { get; set; }

        [JsonPropertyName("endresult")]
        public int? EndResult { get; set; }
    }

    [MessageCode(Code = "XPM")]
    public class XPMServerMessage : FChatServerMessage
    {
        [JsonPropertyName("character")]
        public required CharacterName Character { get; set; }
    }

    // Chat state reconstruction complete
    [MessageCode(Code = "XIC", HasBody = false)]
    public class XICServerMessage : FChatServerMessage
    {
    }

    [MessageCode(Code = "MSG")]
    public class MSGServerMessage : FChatServerMessage
    {
        [JsonPropertyName("character")]
        public required CharacterName Character { get; set; }

        [JsonPropertyName("channel")]
        public required FL1ChannelName Channel { get; set; }

        [JsonPropertyName("message")]
        public required string Message { get; set; }
    }

    [MessageCode(Code = "PRI")]
    public class PRIServerMessage : FChatServerMessage
    {
        [JsonPropertyName("character")]
        public required CharacterName Character { get; set; }

        [JsonPropertyName("message")]
        public required string Message { get; set; }

        [JsonPropertyName("recipient")]
        public required CharacterName Recipient { get; set; }
    }

    [MessageCode(Code = "SYS")]
    public class SYSServerMessage : FChatServerMessage
    {
        [JsonPropertyName("channel")]
        public FL1ChannelName? Channel { get; set; }

        [JsonPropertyName("message")]
        public required string Message { get; set; }
    }

    [MessageCode(Code = "TPN")]
    public class TPNServerMessage : FChatServerMessage
    {

        [JsonPropertyName("character")]
        public required CharacterName Character { get; set; }

        [JsonPropertyName("status")]
        [JsonConverter(typeof(JsonStringEnumConverter<Client.CharacterTypingStatus>))]
        public required Client.CharacterTypingStatus Status { get; set; }
    }

    [MessageCode(Code = "ORS")]
    public class ORSServerMessage : FChatServerMessage
    {
        [JsonPropertyName("channels")]
        public required List<ORSPrivateChannelItem> Channels { get; set; }
    }

    public class ORSPrivateChannelItem
    {
        [JsonPropertyName("name")]
        public required FL1ChannelName Name { get; set; }

        [JsonPropertyName("title")]
        public required FL1ChannelTitle Title { get; set; }

        [JsonPropertyName("characters")]
        public required int Characters { get; set; }
    }

    [MessageCode(Code = "CHA")]
    public class CHAServerMessage : FChatServerMessage
    {
        [JsonPropertyName("channels")]
        public required List<CHAOfficialChannelItem> Channels { get; set; }
    }

    public class CHAOfficialChannelItem
    {
        [JsonPropertyName("name")]
        public required FL1ChannelName Name { get; set; }

        [JsonPropertyName("mode")]
        public required ChannelMode Mode { get; set; }

        [JsonPropertyName("characters")]
        public required int Characters { get; set; }
    }

    [MessageCode(Code = "STA")]
    public class STAServerMessage : FChatServerMessage
    {
        [JsonPropertyName("character")]
        public required CharacterName Character { get; set; }

        [JsonPropertyName("status")]
        public required FL1CharacterStatus Status { get; set; }

        [JsonPropertyName("statusmsg")]
        public required string StatusMessage { get; set; }
    }

    [MessageCode(Code = "FLN")]
    public class FLNServerMessage : FChatServerMessage
    {
        [JsonPropertyName("character")]
        public required CharacterName Character { get; set; }
    }

    [MessageCode(Code = "LCH")]
    public class LCHServerMessage : FChatServerMessage
    {
        [JsonPropertyName("channel")]
        public required FL1ChannelName Channel { get; set; }

        [JsonPropertyName("character")]
        public required CharacterName Character { get; set; }
    }

    [MessageCode(Code = "XPU")]
    public class XPUServerMessage : FChatServerMessage
    {
        [JsonPropertyName("recipient")]
        public required CharacterName Recipient { get; set; }

        [JsonPropertyName("hasUnread")]
        public required bool HasUnread { get; set; }
    }
}
