using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;
using XarChat.FList2.FList2Api.Entities;

namespace XarChat.Backend.Bridge1to2.StrongTypes
{
    [JsonConverter(typeof(FL1ChannelName.JsonConverter))]
    public sealed class FL1ChannelName : StronglyTypedComparableValue<FL1ChannelName, string>,
        ICreatable<string, FL1ChannelName>,
        IHasComparer<string>
    {
        public static IComparer<string> Comparer => StringComparer.Ordinal;

        public static FL1ChannelName Create(string value) => new FL1ChannelName(value);

        public FL1ChannelName(string value) : base(value) { }
    }

    [JsonConverter(typeof(FL1CharacterStatus.JsonConverter))]
    public sealed class FL1CharacterStatus : StronglyTypedComparableValue<FL1CharacterStatus, string>,
        ICreatable<string, FL1CharacterStatus>,
        IHasComparer<string>
    {
        public static readonly FL1CharacterStatus OFFLINE = new FL1CharacterStatus("offline");
        public static readonly FL1CharacterStatus ONLINE = new FL1CharacterStatus("online");
        public static readonly FL1CharacterStatus AWAY = new FL1CharacterStatus("away");
        public static readonly FL1CharacterStatus BUSY = new FL1CharacterStatus("busy");
        public static readonly FL1CharacterStatus LOOKING = new FL1CharacterStatus("looking");
        public static readonly FL1CharacterStatus DND = new FL1CharacterStatus("dnd");
        public static readonly FL1CharacterStatus CROWN = new FL1CharacterStatus("crown");

        public static readonly FL1CharacterStatus[] DefinedValues = [
            OFFLINE, ONLINE, AWAY, BUSY, LOOKING, DND, CROWN
        ];

        public static IComparer<string> Comparer => StringComparer.Ordinal;

        public static FL1CharacterStatus Create(string value) => new FL1CharacterStatus(value);

        public FL1CharacterStatus(string value) : base(value) { }
    }

    public static class FL1CharacterStatusExtensions
    {
        public static FL1CharacterStatus ToFL1CharacterStatus(this CharacterStatus fl2Status)
        {
            return FL1CharacterStatus.Create(fl2Status.CodeValue.ToLower());
        }

        public static CharacterStatus ToFL2CharacterStatus(this FL1CharacterStatus fl2Status)
        {
            return CharacterStatus.Parse(fl2Status.Value);
        }
    }
}
