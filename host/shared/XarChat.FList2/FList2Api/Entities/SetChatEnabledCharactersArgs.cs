using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class SetChatEnabledCharactersArgs
    {
        [JsonPropertyName("chatEnabledCharacterIdList")]
        public required List<CharacterId> ChatEnabledCharacterIdList { get; set; }
    }
}