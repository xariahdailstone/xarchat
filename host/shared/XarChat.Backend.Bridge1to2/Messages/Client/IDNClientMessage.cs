using System.Runtime.Serialization;
using System.Text.Json.Serialization;
using XarChat.Backend.Bridge1to2.StrongTypes;
using XarChat.FList2.Common.StrongTypes;
using XarChat.FList2.FList2Api.Entities;

namespace XarChat.Backend.Bridge1to2.Messages.Client
{
    [MessageCode(Code = "IDN")]
    public class IDNClientMessage : FChatClientMessage
    {
        [JsonPropertyName("character")]
        public required CharacterName Character { get; set; }

        [JsonPropertyName("cversion")]
        public string? CVersion { get; set; }

        [JsonPropertyName("method")]
        public string? Method { get; set; }

        [JsonPropertyName("account")]
        public required string Account { get; set; }

        [JsonPropertyName("ticket")]
        public required string Ticket { get; set; }

        [JsonPropertyName("cname")]
        public string? CName { get; set; }
    }

    [MessageCode(Code = "MSG")]
    public class MSGClientMessage : FChatClientMessage
    {
        [JsonPropertyName("channel")]
        public required FL1ChannelName Channel { get; set; }

        [JsonPropertyName("message")]
        public required string Message { get; set; }
    }

    [MessageCode(Code = "TPN")]
    public class TPNClientMessage : FChatClientMessage
    {
        [JsonPropertyName("character")]
        public required CharacterName Character { get; set; }

        [JsonPropertyName("status")]
        [JsonConverter(typeof(JsonStringEnumConverter<CharacterTypingStatus>))]
        public required CharacterTypingStatus Status { get; set; }
    }

    public enum CharacterTypingStatus
    {
        [JsonStringEnumMemberName("clear")]
        Clear,

        [JsonStringEnumMemberName("typing")]
        Typing,

        [JsonStringEnumMemberName("paused")]
        Paused
    }

    [MessageCode(Code = "ORS", HasBody = false)]
    public class ORSClientMessage : FChatClientMessage
    {
    }

    [MessageCode(Code = "CHA", HasBody = false)]
    public class CHAClientMessage : FChatClientMessage
    {
    }

    [MessageCode(Code = "XSN")]
    public class XSNClientMessage : FChatClientMessage
    {
        [JsonPropertyName("tabid")]
        public required string TabIdentifier { get; set; }
    }

    [MessageCode(Code = "STA")]
    public class STAClientMessage : FChatClientMessage
    {
        [JsonPropertyName("status")]
        public required FL1CharacterStatus Status { get; set; }

        [JsonPropertyName("statusmsg")]
        public string? StatusMessage { get; set; }
    }

    [MessageCode(Code = "PRI")]
    public class PRIClientMessage : FChatClientMessage
    {
        [JsonPropertyName("recipient")]
        public required CharacterName Recipient { get; set; }

        [JsonPropertyName("message")]
        public required string Message { get; set; }
    }

    [MessageCode(Code = "JCH")]
    public class JCHClientMessage : FChatClientMessage
    {
        [JsonPropertyName("channel")]
        public required FL1ChannelName Channel { get; set; }
    }

    [MessageCode(Code = "LCH")]
    public class LCHClientMessage : FChatClientMessage
    {
        [JsonPropertyName("channel")]
        public required FL1ChannelName Channel { get; set; }
    }

    [MessageCode(Code = "XPM")]
    public class XPMClientMessage : FChatClientMessage
    {
        [JsonPropertyName("character")]
        public required CharacterName Character { get; set; }

        [JsonPropertyName("action")]
        [JsonConverter(typeof(JsonStringEnumConverter<PMConversationAction>))]
        public required PMConversationAction Action { get; set; }
    }

    public enum PMConversationAction
    {
        [JsonStringEnumMemberName("opened")]
        Opened,

        [JsonStringEnumMemberName("closed")]
        Closed
    }
}
