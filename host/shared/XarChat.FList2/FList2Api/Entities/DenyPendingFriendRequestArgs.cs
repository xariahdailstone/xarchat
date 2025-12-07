using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class DenyPendingFriendRequestArgs
    {
        [JsonPropertyName("recipientCharacterId")]
        public required CharacterId RecipientCharacterId { get; set; }

        [JsonPropertyName("senderCharacterId")]
        public required CharacterId SenderCharacterId { get; set; }
    }

    public class GetFriendsListResponse
    {
        [JsonPropertyName("characters")]
        public required Dictionary<CharacterName, List<FriendListItem>> Characters { get; set; }
    }

    public class FriendListItem
    {
        [JsonPropertyName("friendId")]
        public required CharacterId FriendId { get; set; }

        [JsonPropertyName("friendName")]
        public required CharacterName FriendName { get; set; }

        [JsonPropertyName("friendAvatarPath")]
        public required string FriendAvatarPath { get; set; }
    }

    public class GetMyEIconsResponseItem
    {
        [JsonPropertyName("name")]
        public required string Name { get; set; }

        [JsonPropertyName("path")]
        public required string Path { get; set; }
    }

    public class RenameEIconArgs
    {
        [JsonIgnore]
        public required string ExistingName { get; set; }

        [JsonPropertyName("newName")]
        public required string NewName { get; set; }
    }

    public class DeleteEIconArgs
    {
        public required string EIconName { get; set; }
    }

    public class UploadEIconArgs
    {
        public required NamedStream EIconImageData { get; set; }

        public required string EIconName { get; set; }
    }

    public record NamedStream(Stream Stream, string Name);
}