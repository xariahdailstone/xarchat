using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class KinksList
    {
        [JsonPropertyName("kinks")]
        public required KinksListInner Kinks { get; set; }
    }

    public class SaveMemoResponse
    {
        [JsonPropertyName("note")]
        public required string Note { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }
    }

    public class SubmitReportResponse
    {
        [JsonPropertyName("log_id")]
        public string? LogId { get; set; }
    }

    public class GetAllMemosResponse
    {
        [JsonPropertyName("memos")]
        public required List<GetAllMemosResponseItem> Memos { get; set; }
    }

    public class GetAllMemosResponseItem
    {
        [JsonPropertyName("id")]
        public int? CharacterId { get; set; }

        [JsonPropertyName("name")]
        public string? CharacterName { get; set; }

        [JsonPropertyName("note")]
        public required string MemoText { get; set; }
    }
}
