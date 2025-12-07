using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class CsrfTokenResponse
    {
        [JsonPropertyName("token")]
        public required string Token { get; set; }

        [JsonPropertyName("headerName")]
        public required string HeaderName { get; set; }
    }
}