using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.ChatLogImport
{
    public sealed class ChatLogImportWorkflowShowMessageButton
    {
        [JsonPropertyName("title")]
        public required string Title { get; init; }

        [JsonPropertyName("result")]
        public required string ActionCode { get; init; }
    }
}
