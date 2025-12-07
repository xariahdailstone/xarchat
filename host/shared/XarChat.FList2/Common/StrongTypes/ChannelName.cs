using System.Text.Json.Serialization;

namespace XarChat.FList2.Common.StrongTypes
{
    [JsonConverter(typeof(ChannelName.JsonConverter))]
    public sealed class ChannelName : StronglyTypedComparableValue<ChannelName, string>,
        ICreatable<string, ChannelName>,
        IHasComparer<string>
    {
        public static IComparer<string> Comparer => StringComparer.Ordinal;

        public static ChannelName Create(string value) => new ChannelName(value);

        public ChannelName(string value) : base(value) { }
    }
}
