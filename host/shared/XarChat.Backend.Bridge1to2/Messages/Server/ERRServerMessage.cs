using System.Text.Json.Serialization;

namespace XarChat.Backend.Bridge1to2.Messages.Server
{
    [MessageCode(Code = "ERR")]
    public class ERRServerMessage : FChatServerMessage
    {
        [JsonPropertyName("code")]
        public required int Code { get; set; }

        [JsonPropertyName("message")]
        public string? Message { get; set; }
    }
}
