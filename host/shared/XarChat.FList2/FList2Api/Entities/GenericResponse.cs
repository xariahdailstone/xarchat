using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GenericResponse
    {
        [JsonPropertyName("message")]
        public required string Message { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }
    }
}