using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ApiTicketBookmark
    {
        [JsonPropertyName("name")]
        public string Name { get; set; }
    }
}
