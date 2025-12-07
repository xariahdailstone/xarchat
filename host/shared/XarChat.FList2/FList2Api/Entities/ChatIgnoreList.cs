using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class ChatIgnoreList
    {
        [JsonPropertyName("total")]
        public int Total { get; set; }

        [JsonPropertyName("characterIdList")]
        public List<CharacterId> CharacterIdList { get; set; }
    }
}