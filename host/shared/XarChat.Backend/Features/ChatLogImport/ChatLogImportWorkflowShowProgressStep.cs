using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.ChatLogImport
{
    public sealed class ChatLogImportWorkflowShowProgressStep : ChatLogImportWorkflowStep<ChatLogImportWorkflowShowProgressStep.Response>
    {
        [JsonPropertyName("title")]
        public required string Title { get; init; }

        [JsonPropertyName("body")]
        public required string Body { get; init; }

        [JsonPropertyName("pct")]
        public required int CurrentPercentage { get; init; }


        public class Response { }
    }
}
