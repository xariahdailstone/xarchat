using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ProfileInfoDisplaySettings
    {
        [JsonPropertyName("customs_first")]
        public bool CustomsFirst { get; set; }

        [JsonPropertyName("guestbook")]
        public bool Guestbook { get; set; }

        [JsonPropertyName("prevent_bookmarks")]
        public bool PreventBookmarks { get; set; }

        [JsonPropertyName("public")]
        public bool Public { get; set; }

        [JsonPropertyName("show_friends")]
        public bool ShowFriends { get; set; }
    }
}
