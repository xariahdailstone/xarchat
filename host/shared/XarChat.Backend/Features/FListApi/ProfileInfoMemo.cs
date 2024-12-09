using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ProfileInfoMemo
    {
        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("memo")]
        public string Memo { get; set; }
    }
}
