using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ProfileFieldsInfoList
    {
        [JsonPropertyName("info")]
        public required ProfileFieldsInfoListInner Info { get; set; }
    }

    public class PartnerSearchFieldsDefinitions
    {
        [JsonPropertyName("kinks")]
        public required List<PartnerSearchKink> Kinks { get; set; }

        [JsonPropertyName("genders")]
        public required List<string> Genders { get; set; }

        [JsonPropertyName("roles")]
        public required List<string> Roles { get; set; }

        [JsonPropertyName("orientations")]
        public required List<string> Orientations { get; set; }

        [JsonPropertyName("positions")]
        public required List<string> Positions { get; set; }

        [JsonPropertyName("languages")]
        public required List<string> Languages { get; set; }

        [JsonPropertyName("furryprefs")]
        public required List<string> FurryPrefs { get; set; }
    }

    public class PartnerSearchKink
    {
        [JsonPropertyName("fetish_id")]
        public required string FetishId { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }
    }
}
