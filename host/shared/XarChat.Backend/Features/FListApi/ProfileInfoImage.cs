using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ProfileInfoImage
    {
        [JsonPropertyName("description")]
        public required string Description { get; set; }

        [JsonPropertyName("extension")]
        public required string Extension { get; set; }

        [JsonPropertyName("height")]
        public required string Height { get; set; }

        [JsonPropertyName("image_id")]
        public required string ImageId { get; set; }

        [JsonPropertyName("sort_order")]
        public required string SortOrder { get; set; }

        [JsonPropertyName("width")]
        public required string Width { get; set; }
    }
}
