using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace XarChat.Backend.Features.ChatLogImport
{
    public abstract class ChatLogImportWorkflowStep 
    {
        private readonly SemaphoreSlim _sem = new SemaphoreSlim(0);

        public void Complete()
        {
            _sem.Release();
        }

        public async Task WaitForResultAsync(CancellationToken cancellationToken)
        {
            await _sem.WaitAsync(cancellationToken);
        }

        public virtual string GetJsonName() => this.GetType().Name;

        public virtual JsonNode GetJsonValue()
        {
            var result = JsonSerializer.SerializeToNode(this,
                ChatLogImportWorkflowStepsJsonSerializerContext.Default.GetTypeInfo(this.GetType())!)!;
            return result;
        }

        public abstract void HandleClientResponse(JsonElement clientData);
    }

    public abstract class ChatLogImportWorkflowStep<TClientResponse> : ChatLogImportWorkflowStep
    {
        [JsonIgnore]
        public TClientResponse? ClientResponse { get; set; } = default;


        public override void HandleClientResponse(JsonElement clientData)
        {
            var obj = JsonSerializer.Deserialize<TClientResponse>(clientData,
                (JsonTypeInfo<TClientResponse>)ChatLogImportWorkflowStepsJsonSerializerContext.Default.GetTypeInfo(typeof(TClientResponse))!)!;
            this.ClientResponse = obj;
        }
    }
}
