using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class KinksList
    {
        [JsonPropertyName("kinks")]
        public KinksListInner Kinks { get; set; }
    }

    public class SaveMemoResponse
    {
        [JsonPropertyName("note")]
        public string Note { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }
    }
}
