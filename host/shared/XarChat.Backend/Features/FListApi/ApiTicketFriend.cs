using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ApiTicketFriend
    {
        [JsonPropertyName("dest_name")]
        public required string DestName { get; set; }

        [JsonPropertyName("source_name")]
        public required string SourceName { get; set; }
    }
}
