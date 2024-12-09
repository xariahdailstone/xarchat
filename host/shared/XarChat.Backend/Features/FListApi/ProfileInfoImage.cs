using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ProfileInfoImage
    {
        [JsonPropertyName("description")]
        public string Description { get; set; }

        [JsonPropertyName("extension")]
        public string Extension { get; set; }

        [JsonPropertyName("height")]
        public string Height { get; set; }

        [JsonPropertyName("image_id")]
        public string ImageId { get; set; }

        [JsonPropertyName("sort_order")]
        public string SortOrder { get; set; }

        [JsonPropertyName("width")]
        public string Width { get; set; }
    }
}
