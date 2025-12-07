using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json.Serialization;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Incoming;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Outgoing;

namespace XarChat.FList2.FList2Api.Implementation.Firehose.Messages
{
    [JsonSerializable(typeof(ChannelMessageReceived))]
    [JsonSerializable(typeof(CharacterJoinedChannel))]
    [JsonSerializable(typeof(CharacterLeftChannel))]
    [JsonSerializable(typeof(CharacterPresenceChanged))]
    [JsonSerializable(typeof(FirehoseBrokenMessage))]
    [JsonSerializable(typeof(PMConvoHasUnreadMessage))]
    [JsonSerializable(typeof(PMConvoMessageReceived))]
    [JsonSerializable(typeof(SendChannelMessage))]
    [JsonSerializable(typeof(SendPrivateMessageMessage))]
    public partial class FirehostMessagesJsonSerializerContext : JsonSerializerContext
    {
    }
}
