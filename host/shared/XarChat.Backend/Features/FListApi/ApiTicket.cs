using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ApiTicket
    {
        [JsonPropertyName("bookmarks")]
        public List<ApiTicketBookmark> Bookmarks { get; set; }

        [JsonPropertyName("characters")]
        public Dictionary<string, int> Characters { get; set; }

        [JsonPropertyName("default_character")]
        public int DefaultCharacter { get; set; }

        [JsonPropertyName("friends")]
        public List<ApiTicketFriend> Friends { get; set; }

        [JsonPropertyName("ticket")]
        public string Ticket { get; set; }
    }
}
