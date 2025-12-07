using System.Text.Json.Serialization;

namespace XarChat.FList2.Common.StrongTypes
{
    [JsonConverter(typeof(ChannelId.JsonConverter))]
    public sealed class ChannelId : StronglyTypedComparableValue<ChannelId, string>,
        ICreatable<string, ChannelId>,
        IHasComparer<string>
    {
        public static IComparer<string> Comparer => StringComparer.Ordinal;

        public static ChannelId Create(string value) => new ChannelId(value);

        public ChannelId(string value) : base(value) { }
    }
}
