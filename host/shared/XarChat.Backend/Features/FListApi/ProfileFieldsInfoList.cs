using System.Text.Json.Serialization;

namespace XarChat.Backend.Features.FListApi
{
    public class ProfileFieldsInfoList
    {
        [JsonPropertyName("info")]
        public ProfileFieldsInfoListInner Info { get; set; }
    }
}
