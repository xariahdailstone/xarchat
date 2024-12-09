using System.Text.Json.Serialization;

namespace XarChat.AutoUpdate.Impl
{
    internal class GetUpdateInfoResponse
    {
        [JsonPropertyName("latestVersion")]
        public string? LatestVersion { get; set; }

        [JsonPropertyName("latestVersionDownloadUrl")]
        public string? LatestVersionDownloadUrl { get; set; }

        [JsonPropertyName("mustUpdate")]
        public bool? MustUpdate { get; set; }
    }
}
