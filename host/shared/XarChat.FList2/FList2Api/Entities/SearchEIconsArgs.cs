using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class SearchEIconsArgs
    {
        public required string SearchTerm { get; set; }

        public required int Page { get; set; } // zero-based
    }

    public class SearchEIconsResponse
    {
        [JsonPropertyName("icons")]
        public required List<SearchEIconsItem> Icons { get; set; }

        [JsonPropertyName("total")]
        public required int Total { get; set; }

        [JsonPropertyName("page")]
        public required int Page { get; set; }

        [JsonPropertyName("size")]
        public required int Size { get; set; }
    }

    public class SearchEIconsItem
    {
        [JsonPropertyName("name")]
        public required string Name { get; set; }

        [JsonPropertyName("path")]
        public required string Path { get; set; }
    }

    public class GetInlineImagesResponseItem
    {
        [JsonPropertyName("inlineImageId")]
        public int InlineImageId { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("path")]
        public string Path { get; set; }

        [JsonPropertyName("nsfw")]
        public bool Nsfw { get; set; }

        [JsonPropertyName("characterInlineImages")]
        public List<GetInlineImageResponseCharInfo> CharacterInlineImages { get; set; }
    }

    public class GetInlineImageResponseCharInfo
    {
        [JsonPropertyName("id")]
        public required int Id { get; set; }

        [JsonPropertyName("characterId")]
        public required int CharacterId { get; set; }

        [JsonPropertyName("characterName")]
        public required string CharacterName { get; set; }
    }

    public class UploadInlineImageArgs
    {
        public required NamedStream InlineImageData { get; set; }

        public required string Name { get; set; }

        public required bool Nsfw { get; set; }
    }

    public class DeleteInlineImageArgs
    {
        public required int InlineImageId { get; set; }
    }
}