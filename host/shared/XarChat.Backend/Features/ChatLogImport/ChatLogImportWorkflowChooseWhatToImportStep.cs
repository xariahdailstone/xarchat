using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.ChatLogImport
{
    public sealed class ChatLogImportWorkflowChooseWhatToImportStep : ChatLogImportWorkflowStep<ChatLogImportWorkflowChooseWhatToImportStep.Response>
    {
        [JsonPropertyName("availChannels")]
        public List<ChannelIdentifier> AvailableChannels { get; init; } = [];

        [JsonPropertyName("availPMConvos")]
        public List<PMConversationIdentifier> AvailablePMConversations { get; init; } = [];

        public class Response
        {
            [JsonPropertyName("selectedChannels")]
            public required List<ChannelIdentifier> SelectedChannels { get; set; }

            [JsonPropertyName("selectedPMConvos")]
            public required List<PMConversationIdentifier> SelectedPMConversations { get; set; }
        }
    }
}
