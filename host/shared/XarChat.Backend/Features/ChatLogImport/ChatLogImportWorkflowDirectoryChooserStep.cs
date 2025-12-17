using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.ChatLogImport
{
    public sealed class ChatLogImportWorkflowDirectoryChooserStep : ChatLogImportWorkflowStep<ChatLogImportWorkflowDirectoryChooserStep.Response>
    {
        [JsonPropertyName("title")]
        public required string Title { get; init; }

        [JsonPropertyName("body")]
        public required string Body { get; init; }

        [JsonIgnore]
        public string? SelectedDirectory { get; set; } = null;

        public class Response 
        {
            [JsonPropertyName("selectedDirectory")]
            public required string SelectedDirectory { get; set; }
        }
    }
}
