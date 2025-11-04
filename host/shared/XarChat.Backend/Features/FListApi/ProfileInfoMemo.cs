using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ProfileInfoMemo
    {
        [JsonPropertyName("id")]
        public required long Id { get; set; }

        [JsonPropertyName("memo")]
        public required string Memo { get; set; }
    }
}
