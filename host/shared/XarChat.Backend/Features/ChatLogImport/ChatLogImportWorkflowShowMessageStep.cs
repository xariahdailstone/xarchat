using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.ChatLogImport
{
    public sealed class ChatLogImportWorkflowShowMessageStep : ChatLogImportWorkflowStep<ChatLogImportWorkflowShowMessageStep.Response>
    {
        [JsonPropertyName("title")]
        public required string Title { get; init; }

        [JsonPropertyName("body")]
        public required string Body { get; init; }

        [JsonPropertyName("buttons")]
        public List<ChatLogImportWorkflowShowMessageButton> Buttons { get; } = [];

        public class Response
        {
            [JsonPropertyName("result")]
            public required string ResultCode { get; set; }
        }
    }
}
