using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class LoginResponse
    {
        [JsonPropertyName("message")]
        public string? Message { get; set; }
    }
}