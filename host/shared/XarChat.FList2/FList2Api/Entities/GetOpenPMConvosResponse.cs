using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetOpenPMConvosResponse
    {
        [JsonPropertyName("list")]
        public List<CharacterOpenPMConvos> List { get; set; }
    }
}