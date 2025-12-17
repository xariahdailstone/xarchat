namespace XarChat.Backend.Features.ChatLogImport
{
    public interface IChatLogImporter
    {
        // e.g. "F-Chat Horizon" or "F-Chat 3.0 Standalone Client"
        string ImportSourceName { get; }

        IAsyncEnumerable<ChatLogImportWorkflowStep> BeginImportWorkflowAsync(CancellationToken cancellationToken);
    }
}
