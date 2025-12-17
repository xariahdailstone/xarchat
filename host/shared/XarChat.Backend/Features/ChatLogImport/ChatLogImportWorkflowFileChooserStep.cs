using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.ChatLogImport
{
    public sealed class ChatLogImportWorkflowFileChooserStep : ChatLogImportWorkflowStep<ChatLogImportWorkflowFileChooserStep.Response>
    {
        [JsonPropertyName("title")]
        public required string Title { get; init; }

        [JsonPropertyName("body")]
        public required string Body { get; init; }

        [JsonPropertyName("extensions")]
        public required List<string> Extensions { get; init; }

        public class Response
        {
            [JsonPropertyName("selectedFilename")]
            public required string SelectedFilename { get; set; }
        }
    }
}
