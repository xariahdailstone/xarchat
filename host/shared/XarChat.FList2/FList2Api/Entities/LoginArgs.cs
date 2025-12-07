using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class LoginArgs
    {
        [JsonPropertyName("username")]
        public required string Username { get; set; }

        [JsonPropertyName("password")]
        public required string Password { get; set; }
    }
}