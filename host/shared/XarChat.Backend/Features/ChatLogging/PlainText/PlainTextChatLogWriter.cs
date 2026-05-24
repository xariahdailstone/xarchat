using System;
using System.Collections.Generic;
using System.Text;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.AppDataFolder;

namespace XarChat.Backend.Features.ChatLogging.PlainText
{
    public class PlainTextChatLogWriter : IChatLogWriter, IDisposable
    {
        private readonly IAppDataFolder _appDataFolder;
        private readonly IAppConfiguration _appConfiguration;

        public PlainTextChatLogWriter(
            IAppDataFolder appDataFolder,
            IAppConfiguration appConfiguration)
        {
            _appDataFolder = appDataFolder;
            _appConfiguration = appConfiguration;
        }

        public void Dispose()
        {
            throw new NotImplementedException();
        }

        public Task ClearDatabaseAsync(CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public void EndLogSource(string myCharacterName)
        {
            throw new NotImplementedException();
        }

        public Task<List<string>> GetChannelHintsFromPartialNameAsync(string partialChannelName, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<List<LoggedChannelMessageInfo>> GetChannelMessagesAsync(string channelName, DateAnchor dateAnchor, DateTime date, int maxEntries, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<long> GetLogFileSizeAsync(CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<List<string>> GetPMConvoHintsFromPartialNameAsync(string myCharacterName, string partialInterlocutorName, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<List<LoggedPMConvoMessageInfo>> GetPMConvoMessagesAsync(string myCharacterName, string interlocutorName, DateAnchor dateAnchor, DateTime date, int maxEntries, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task LogChannelMessageAsync(string myCharacterName, string channelName, string channelTitle, string speakerName, int speakerGender, int speakerStatus, int messageType, string messageText, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task LogPMConvoMessageAsync(string myCharacterName, string interlocutorName, string speakerName, int speakerGender, int speakerStatus, int messageType, string messageText, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task PerformExpirationAsync(CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task VacuumAsync(CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }
    }
}
