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

    public class GetAllMemosResponse
    {
        [JsonPropertyName("memos")]
        public List<GetAllMemosResponseItem> Memos { get; set; }
    }

    public class GetAllMemosResponseItem
    {
        [JsonPropertyName("id")]
        public int? CharacterId { get; set; }

        [JsonPropertyName("name")]
        public string? CharacterName { get; set; }

        [JsonPropertyName("note")]
        public string MemoText { get; set; }
    }
}
