using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.Backend.Bridge1to2.StrongTypes
{
    [JsonConverter(typeof(FL1ChannelTitle.JsonConverter))]
    public class FL1ChannelTitle : StronglyTypedComparableValue<FL1ChannelTitle, string>,
        ICreatable<string, FL1ChannelTitle>,
        IHasComparer<string>
    {
        public static IComparer<string> Comparer => StringComparer.Ordinal;

        public static FL1ChannelTitle Create(string value) => new FL1ChannelTitle(value);

        public FL1ChannelTitle(string value) : base(value) { }
    }
}
