using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppDataFolder;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.File
{
    public class SwarmingChatLogWriter : IChatLogWriter, IDisposable, IAsyncDisposable
    {
        private readonly DbLogFileSwarm _swarm;

        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();
        private readonly SemaphoreSlim _sem = new SemaphoreSlim(1);

        public SwarmingChatLogWriter(
            IAppDataFolder appDataFolder)
        {
            _swarm = new DbLogFileSwarm(
                Path.Combine(appDataFolder.GetAppDataFolder(), "logs"));
        }

        public void Dispose() 
        { 
            DisposeAsync().AsTask().GetAwaiter().GetResult();
        }

        public async ValueTask DisposeAsync() 
        { 
            if (!_disposeCTS.IsCancellationRequested)
            {
                _disposeCTS.Cancel();
                await _swarm.DisposeAsync();
            }
        }

        public void EndLogSource(string myCharacterName)
        {
            throw new NotImplementedException();
        }

        public async Task<List<string>> GetChannelHintsFromPartialNameAsync(string partialChannelName, CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
            cancellationToken = cts.Token;

            var results = new ConcurrentBag<string>();

            await _sem.WaitAsync(cancellationToken);
            try
            {
                await Parallel.ForEachAsync(
                    _swarm.EnumerateAllLogFiles(cancellationToken: cancellationToken), 
                    async (logfile, cancellationToken) =>
                    {
                        var h = await logfile.GetChannelHintsFromPartialNameAsync(partialChannelName, cancellationToken);
                        foreach (var x in h)
                        {
                            results.Add(x);
                        }
                    });
            }
            finally
            {
                _sem.Release();
            }

            return results.Distinct().ToList();
        }

        public async Task<List<LoggedChannelMessageInfo>> GetChannelMessagesAsync(string channelName, DateAnchor dateAnchor, DateTime date, int maxEntries, CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
            cancellationToken = cts.Token;

            await _sem.WaitAsync(cancellationToken);
            try
            {
                var charLogFilesEnum = _swarm.EnumerateAllLogFiles(
                    cancellationToken: cancellationToken);

                var orderedCharLogFilesEnum = dateAnchor == DateAnchor.After
                    ? charLogFilesEnum.OrderBy(x => x.Year * 12 + x.Month)
                        .Where(x => x.DataTo >= date)
                    : charLogFilesEnum.OrderByDescending(x => x.Year * 12 + x.Month)
                        .Where(x => x.DataFrom <= date);

                var xresults = new List<LoggedChannelMessageInfo>();
                await foreach (var logFile in orderedCharLogFilesEnum)
                {
                    var titems = await logFile.GetChannelMessagesAsync(
                        channelName, dateAnchor, date, maxEntries, cancellationToken);
                    xresults.AddRange(titems);
                    if (xresults.Count >= maxEntries)
                    {
                        break;
                    }
                }

                var results = dateAnchor == DateAnchor.After
                    ? xresults.OrderBy(x => x.Timestamp).Take(maxEntries).ToList()
                    : xresults.OrderByDescending(x => x.Timestamp).Take(maxEntries).ToList();
                return results;
            }
            finally
            {
                _sem.Release();
            }
        }

        public async Task<List<string>> GetPMConvoHintsFromPartialNameAsync(string myCharacterName, string partialInterlocutorName, CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
            cancellationToken = cts.Token;

            var results = new ConcurrentBag<string>();

            await _sem.WaitAsync(cancellationToken);
            try
            {
                await Parallel.ForEachAsync(
                    _swarm.EnumerateAllLogFiles(cancellationToken: cancellationToken),
                    async (logfile, cancellationToken) =>
                    {
                        var h = await logfile.GetPMConvoHintsFromPartialNameAsync(
                            myCharacterName, partialInterlocutorName, cancellationToken);
                        foreach (var x in h)
                        {
                            results.Add(x);
                        }
                    });
            }
            finally
            {
                _sem.Release();
            }

            return results.Distinct().ToList();
        }

        public async Task<List<LoggedPMConvoMessageInfo>> GetPMConvoMessagesAsync(
            string myCharacterName, string interlocutorName, 
            DateAnchor dateAnchor, DateTime date, int maxEntries, CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
            cancellationToken = cts.Token;

            await _sem.WaitAsync(cancellationToken);
            try
            {
                var streamName = GetLogStreamNameForPMConvo(myCharacterName, interlocutorName);

                var charLogFilesEnum = _swarm.EnumerateAllLogFiles(
                    forCharacterName: streamName,
                    cancellationToken: cancellationToken);

                var orderedCharLogFilesEnum = dateAnchor == DateAnchor.After
                    ? charLogFilesEnum.OrderBy(x => x.Year * 12 + x.Month)
                        .Where(x => x.DataTo >= date)
                    : charLogFilesEnum.OrderByDescending(x => x.Year * 12 + x.Month)
                        .Where(x => x.DataFrom <= date);

                var xresults = new List<LoggedPMConvoMessageInfo>();
                await foreach (var logFile in orderedCharLogFilesEnum)
                {
                    var titems = await logFile.GetPMConvoMessagesAsync(
                        myCharacterName, interlocutorName, dateAnchor, date, maxEntries, cancellationToken);
                    xresults.AddRange(titems);
                    if (xresults.Count >= maxEntries)
                    {
                        break;
                    }
                }

                var results = dateAnchor == DateAnchor.After
                    ? xresults.OrderBy(x => x.Timestamp).Take(maxEntries).ToList()
                    : xresults.OrderByDescending(x => x.Timestamp).Take(maxEntries).ToList();
                return results;
            }
            finally
            {
                _sem.Release(); 
            }
        }

        public async Task LogChannelMessageAsync(
            string myCharacterName, string channelName, string channelTitle, 
            string speakerName, int speakerGender, int speakerStatus, int messageType, 
            string messageText, CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
            cancellationToken = cts.Token;

            var now = DateTime.UtcNow;

            await _sem.WaitAsync(cancellationToken);
            try
            {
                var streamName = GetLogStreamNameForChannelTitle(channelTitle);

                var logFile = await _swarm.GetOrCreateLogFileAsync(
                    streamName, now.Year, now.Month, cancellationToken);
                await logFile.LogChannelMessageAsync(now, myCharacterName, channelName, channelTitle,
                    speakerName, speakerGender, speakerStatus, messageType, messageText, cancellationToken);
            }
            finally
            {
                _sem.Release();
            }
        }

        public async Task LogPMConvoMessageAsync(
            string myCharacterName, string interlocutorName, string speakerName, int speakerGender, 
            int speakerStatus, int messageType, string messageText, CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
            cancellationToken = cts.Token;

            var now = DateTime.UtcNow;

            await _sem.WaitAsync(cancellationToken);
            try
            {
                var streamName = GetLogStreamNameForPMConvo(myCharacterName, interlocutorName);

                var logFile = await _swarm.GetOrCreateLogFileAsync(streamName, now.Year, now.Month, cancellationToken);
                await logFile.LogPMConvoMessageAsync(now, myCharacterName,
                    interlocutorName, speakerName, speakerGender, speakerStatus,
                    messageType, messageText, cancellationToken);
            }
            finally
            {
                _sem.Release();
            }
        }

        public async Task<bool> ValidateChannelInLogsAsync(string channelName, CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
            cancellationToken = cts.Token;

            await _sem.WaitAsync(cancellationToken);
            try
            {
                var expectedCharName = GetLogStreamNameForChannelTitle(channelName);

                var exists = await _swarm.EnumerateAllLogFiles(
                    forCharacterName: expectedCharName,
                    cancellationToken: cancellationToken)
                    .AnyAsync(cancellationToken);

                return exists;
            }
            finally
            {
                _sem.Release();
            }
        }

        private string GetLogStreamNameForChannelTitle(string channelTitle)
            => $"ch[{channelTitle}]";

        private string GetLogStreamNameForPMConvo(string myCharacterName, string interlocutorName)
            => $"pm[{myCharacterName}={interlocutorName}]";

        public async Task<bool> ValidatePMConvoInLogsAsync(string myCharacterName, string interlocutorName, CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
            cancellationToken = cts.Token;

            await _sem.WaitAsync(cancellationToken);
            try
            {
                var expectedCharName = GetLogStreamNameForPMConvo(myCharacterName, interlocutorName);

                var exists = await _swarm.EnumerateAllLogFiles(
                    forCharacterName: expectedCharName,
                    cancellationToken: cancellationToken)
                    .AnyAsync(cancellationToken);

                return exists;
            }
            finally
            {
                _sem.Release();
            }
        }
    }
}
