using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Incoming
{

    [IncomingMessage(Target = "CHANNEL", Type = "CHARACTERS_INACTIVE")]
    public class CharacterLeftChannel : IFirehoseIncomingMessage
    {
        [JsonPropertyName("channelId")]
        public required ChannelId ChannelId { get; set; }

        [JsonPropertyName("characters")]
        public required List<CharacterJoinLeaveChannelCharacter> Characters { get; set; }
    }

    public class CharacterJoinLeaveChannelCharacter
    {
        [JsonPropertyName("id")]
        public required int Id { get; set; }

        [JsonPropertyName("characterName")]
        public required CharacterName CharacterName { get; set; }

        [JsonPropertyName("characterNameLower")]
        public required string CharacterNameLower
        {
            get => this.CharacterName.CanonicalValue;
            set => this.CharacterName = CharacterName.Create(value);
        }

        [JsonPropertyName("characterAvatarPath")]
        public required string CharacterAvatarPath { get; set; }

        [JsonPropertyName("presence")]
        public required CharacterJoinLeaveChannelPresence Presence { get; set; }

        [JsonPropertyName("badgeList")]
        public required List<string> BadgeList { get; set; }

        [JsonPropertyName("genderColor")]
        public required string GenderColor { get; set; }
    }

    public class CharacterJoinLeaveChannelPresence
    {
        [JsonPropertyName("characterId")]
        public required CharacterId CharacterId { get; set; }

        [JsonPropertyName("publicStatusView")]
        public required CharacterJoinLeaveChannelPresenceStatusView PublicStatusView { get; set; }

        [JsonPropertyName("privateStatusView")]
        public required CharacterJoinLeaveChannelPresenceStatusView PrivateStatusView { get; set; }

        [JsonPropertyName("statusMessage")]
        public required string? StatusMessage { get; set; }
    }

    public class CharacterJoinLeaveChannelPresenceStatusView
    {
        [JsonPropertyName("status")]
        public required string? Status { get; set; }

        [JsonPropertyName("title")]
        public required string? Title { get; set; }
    }
}
