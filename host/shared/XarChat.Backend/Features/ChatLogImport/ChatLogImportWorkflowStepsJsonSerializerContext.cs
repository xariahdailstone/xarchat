using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.ChatLogImport
{
    [JsonSerializable(typeof(ChatLogImportWorkflowShowMessageStep))]
    [JsonSerializable(typeof(ChatLogImportWorkflowShowMessageStep.Response))]
    [JsonSerializable(typeof(ChatLogImportWorkflowShowProgressStep))]
    [JsonSerializable(typeof(ChatLogImportWorkflowShowProgressStep.Response), TypeInfoPropertyName = "a")]
    [JsonSerializable(typeof(ChatLogImportWorkflowFileChooserStep))]
    [JsonSerializable(typeof(ChatLogImportWorkflowFileChooserStep.Response), TypeInfoPropertyName = "b")]
    [JsonSerializable(typeof(ChatLogImportWorkflowDirectoryChooserStep))]
    [JsonSerializable(typeof(ChatLogImportWorkflowDirectoryChooserStep.Response), TypeInfoPropertyName = "c")]
    [JsonSerializable(typeof(ChatLogImportWorkflowChooseWhatToImportStep))]
    [JsonSerializable(typeof(ChatLogImportWorkflowChooseWhatToImportStep.Response), TypeInfoPropertyName = "d")]
    internal partial class ChatLogImportWorkflowStepsJsonSerializerContext : JsonSerializerContext
    {
    }
}
