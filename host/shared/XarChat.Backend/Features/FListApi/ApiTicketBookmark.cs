using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ApiTicketBookmark
    {
        [JsonPropertyName("name")]
        public required string Name { get; set; }
    }
}
