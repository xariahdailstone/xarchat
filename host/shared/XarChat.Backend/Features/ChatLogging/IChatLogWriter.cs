using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.ChatLogging
{
    public interface IChatLogWriter
    {
        void EndLogSource(string myCharacterName);

        Task LogChannelMessageAsync(
            string myCharacterName,
            string channelName, string channelTitle, 
            string speakerName, int speakerGender, int speakerStatus,
            int messageType, string messageText,
            CancellationToken cancellationToken);

        Task LogPMConvoMessageAsync(
            string myCharacterName,
            string interlocutorName, 
            string speakerName, int speakerGender, int speakerStatus,
            int messageType, string messageText,
            CancellationToken cancellationToken);

        Task<List<LoggedChannelMessageInfo>> GetChannelMessagesAsync(
            string channelName, 
            DateAnchor dateAnchor, DateTime date,
            int maxEntries,
            CancellationToken cancellationToken);

        Task<List<LoggedPMConvoMessageInfo>> GetPMConvoMessagesAsync(
            string myCharacterName,
            string interlocutorName,
            DateAnchor dateAnchor, DateTime date,
            int maxEntries,
            CancellationToken cancellationToken);

        Task<List<string>> GetChannelHintsFromPartialNameAsync(string partialChannelName,
            CancellationToken cancellationToken);

        Task<List<string>> GetPMConvoHintsFromPartialNameAsync(string myCharacterName, string partialInterlocutorName,
            CancellationToken cancellationToken);

        //Task<bool> ValidateChannelInLogsAsync(string channelName, CancellationToken cancellationToken);

        //Task<bool> ValidatePMConvoInLogsAsync(
        //    string myCharacterName, string interlocutorName, CancellationToken cancellationToken);

        Task PerformExpirationAsync(CancellationToken cancellationToken);
    }

    public enum DateAnchor
    {
        Before,
        After
    }

    public class LoggedMessageInfo
    {
        [JsonPropertyName("timestamp")]
        public long Timestamp { get; set; }

        [JsonPropertyName("speakerName")]
        public required string SpeakerName { get; set; }

        [JsonPropertyName("messageType")]
        public int MessageType { get; set; }

        [JsonPropertyName("messageText")]
        public required string MessageText { get; set; }

        [JsonPropertyName("gender")]
        public int CharacterGender { get; set; }

        [JsonPropertyName("status")]
        public int CharacterStatus { get; set; }
    }

    public class LoggedChannelMessageInfo : LoggedMessageInfo
    {
        [JsonPropertyName("channelName")]
        public required string ChannelName { get; set; }

        [JsonPropertyName("channelTitle")]
        public required string ChannelTitle { get; set; }
    }

    public class LoggedPMConvoMessageInfo : LoggedMessageInfo
    {
        [JsonPropertyName("myCharacterName")]
        public required string MyCharacterName { get; set; }

        [JsonPropertyName("interlocutorName")]
        public required string InterlocutorName { get; set; }
    }
}
