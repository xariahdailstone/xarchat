using System.Text.Json.Serialization;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.FList2.FList2Api.Entities
{
    public class GetCharacterProfileResponse
    {
        [JsonPropertyName("characterId")]
        public required CharacterId CharacterId { get; set; }

        [JsonPropertyName("characterName")]
        public required CharacterName CharacterName { get; set; }

        [JsonPropertyName("basicDetails")]
        public required CharacterProfileBasicDetails BasicDetails { get; set; }

        [JsonPropertyName("settings")]
        public required CharacterProfileSettings Settings { get; set; }

        [JsonPropertyName("kinkPreferenceList")]
        public required List<CharacterProfileKinkPreference> KinkPreferenceList { get; set; }

        [JsonPropertyName("customKinkPreferenceList")]
        public required List<CharacterProfileCustomKinkPreference> CustomKinkPreferenceList { get; set; }

        [JsonPropertyName("profileImageList")]
        public required List<CharacterProfileImage> ProfileImageList { get; set; }

        [JsonPropertyName("characterAttributeSectionList")]
        public required List<CharacterProfileAttributeSection> CharacterAttributeSectionList { get; set; }

        [JsonPropertyName("profileAttributeHighlights")]
        public required List<CharacterProfileAttribute> ProfileAttributeHighlights { get; set; }

        [JsonPropertyName("systemInfoList")]
        public required List<CharacterProfileSystemInfo> SystemInfoList { get; set; }

        [JsonPropertyName("badgeList")]
        public required List<string> BadgeList { get; set; }

        [JsonPropertyName("owner")]
        public required bool Owner { get; set; }
    }

    public class CharacterProfileBasicDetails
    {
        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("avatarPath")]
        public required string AvatarPath { get; set; }

        [JsonPropertyName("customTitle")]
        public string? CustomTitle { get; set; }

        [JsonPropertyName("bannerPath")]
        public string? BannerPath { get; set; }
    }

    public class CharacterProfileSettings
    {
        [JsonPropertyName("isDisplayingFriends")]
        public required bool IsDisplayingFriends { get; set; }
    }

    public class CharacterProfileKinkPreference
    {
        [JsonPropertyName("kinkId")]
        public required int KinkId { get; set; }

        [JsonPropertyName("kinkName")]
        public required string KinkName { get; set; }

        [JsonPropertyName("kinkDescription")]
        public required string KinkDescription { get; set; }

        [JsonPropertyName("choice")]
        public required string Choice { get; set; }
    }

    public class CharacterProfileCustomKinkPreference
    {
        [JsonPropertyName("customKinkId")]
        public required int CustomKinkId { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }

        [JsonPropertyName("description")]
        public required string Description { get; set; }

        [JsonPropertyName("sortOrder")]
        public required int SortOrder { get; set; }

        [JsonPropertyName("choice")]
        public required string Choice { get; set; }

        [JsonPropertyName("color")]
        public required string Color { get; set; }

        [JsonPropertyName("subKinks")]
        public required List<CharacterProfileKinkPreference> SubKinks { get; set; }  // TODO: check me
    }

    public class CharacterProfileSubKink
    {
        [JsonPropertyName("kinkId")]
        public required int KinkId { get; set; }

        [JsonPropertyName("name")]
        public required string Name { get; set; }

        [JsonPropertyName("description")]
        public required string Description { get; set; }
    }

    public class CharacterProfileImage
    {
        [JsonPropertyName("imageId")]
        public required int ImageId { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("sortOrder")]
        public required int SortOrder { get; set; }

        [JsonPropertyName("imagePath")]
        public required string ImagePath { get; set; }
    }

    public class CharacterProfileAttributeSection
    {
        [JsonPropertyName("sectionId")]
        public required int SectionId { get; set; }

        [JsonPropertyName("sectionName")]
        public required string SectionName { get; set; }

        [JsonPropertyName("sectionSortOrder")]
        public required int SectionSortOrder { get; set; }

        [JsonPropertyName("attributeList")]
        public required List<CharacterProfileAttribute> AttributeList { get; set; }
    }

    public class CharacterProfileAttribute
    {
        [JsonPropertyName("attributeId")]
        public required int AttributeId { get; set; }

        [JsonPropertyName("attributeName")]
        public required string AttributeName { get; set; }

        [JsonPropertyName("attributeValue")]
        public required string AttributeValue { get; set; }
    }

    public class CharacterProfileSystemInfo
    {
        [JsonPropertyName("systemInfoName")]
        public required string SystemInfoName { get; set; }

        [JsonPropertyName("systemInfoValue")]
        public required string SystemInfoValue { get; set; }

        [JsonPropertyName("tooltipValue")]
        public required string TooltipValue { get; set; }
    }
}