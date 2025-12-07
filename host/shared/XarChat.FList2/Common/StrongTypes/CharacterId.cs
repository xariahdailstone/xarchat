using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Net.NetworkInformation;
using System.Text;
using System.Text.Json.Serialization;

namespace XarChat.FList2.Common.StrongTypes
{
    [JsonConverter(typeof(CharacterId.JsonConverter))]
    public sealed class CharacterId : StronglyTypedNumberValue<CharacterId, int>, 
        ICreatable<int, CharacterId>,
        IHasComparer<int>
    {
        public static IComparer<int> Comparer => Comparer<int>.Default;

        public static CharacterId Create(int value) => new CharacterId(value);

        public CharacterId(int value) : base(value) { }
    }
}
