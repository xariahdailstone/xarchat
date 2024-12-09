using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ProfileInfo
    {
        [JsonPropertyName("badges")]
        public List<string> Badges { get; set; }

        [JsonPropertyName("character_list")]
        public List<ProfileInfoCharacterListItem> CharacterList { get; set; }

        [JsonPropertyName("created_at")]
        public long CreatedAt { get; set; }

        [JsonPropertyName("custom_kinks")]
        public System.Text.Json.Nodes.JsonNode CustomKinks { get; set; }

        [JsonPropertyName("custom_title")]
        public string? CustomTitle { get; set; }

        [JsonPropertyName("customs_first")]
        public bool CustomsFirst { get; set; }

        [JsonPropertyName("description")]
        public string Description { get; set; }

        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("images")]
        public List<ProfileInfoImage> Images { get; set; }

        [JsonPropertyName("infotags")]
        public System.Text.Json.Nodes.JsonNode Infotags { get; set; }

        [JsonPropertyName("inlines")]
        public System.Text.Json.Nodes.JsonNode Inlines { get; set; }

        [JsonPropertyName("is_self")]
        public bool IsSelf { get; set; }

        [JsonPropertyName("kinks")]
        public System.Text.Json.Nodes.JsonNode Kinks { get; set; }

        [JsonPropertyName("memo")]
        public ProfileInfoMemo? Memo { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("settings")]
        public ProfileInfoDisplaySettings Settings { get; set; }

        [JsonPropertyName("updated_at")]
        public long UpdatedAt { get; set; }

        [JsonPropertyName("views")]
        public long Views { get; set; }
    }
}
