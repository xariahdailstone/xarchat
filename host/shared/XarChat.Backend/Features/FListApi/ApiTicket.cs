using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ApiTicket
    {
        [JsonPropertyName("bookmarks")]
        public required List<ApiTicketBookmark> Bookmarks { get; set; }

        [JsonPropertyName("characters")]
        public required Dictionary<string, int> Characters { get; set; }

        [JsonPropertyName("default_character")]
        public int DefaultCharacter { get; set; }

        [JsonPropertyName("friends")]
        public required List<ApiTicketFriend> Friends { get; set; }

        [JsonPropertyName("ticket")]
        public required string Ticket { get; set; }
    }
}
