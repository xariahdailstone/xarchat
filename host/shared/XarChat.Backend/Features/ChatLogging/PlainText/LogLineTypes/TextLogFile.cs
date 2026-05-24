using Microsoft.Win32.SafeHandles;
using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.ChatLogging.PlainText.LogLineTypes
{
    internal record CharacterInfo(string CharacterName, string Gender);

    internal enum TextLogFileType
    {
        Channel,
        PrivateMessage,
        Unknown
    }


    internal class TextLogFile : IDisposable, IAsyncDisposable
    {
        public static async IAsyncEnumerable<IResolvedLogFileLine> EnumerateAsync(
            string filename, 
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await using var fs = File.OpenRead(filename);
            await foreach (var lfn in EnumerateLogFileLinesAsync(fs, cancellationToken))
            {
                yield return lfn;
            }
        }

        public static async Task<TextLogFile> CreateChannelLogFileAsync(
            string filename,
            DateOnly fileDate,
            string channelName,
            string channelTitle,
            CancellationToken cancellationToken)
        {
            /* (string filename, FileStream fs,
            int fileVersion, DateOnly fileDate, TextLogFileType logFileType,
            Dictionary<string, CharacterInfo> shortCodeDict,
            Dictionary<string, string> lastAdBySpeaker) */

            var fs = File.Create(filename);

            var hdrLine = new ChannelHeaderLogLine()
            {
                Timestamp = new DateTime(fileDate, new TimeOnly(0, 0), DateTimeKind.Utc),
                ChannelName = channelName,
                ChannelTitle = channelTitle,
                FileVersion = 1,
                LogFileDate = fileDate
            };
            var hdrLineText = LogLineBase.Serialize(hdrLine);
            await fs.WriteAsync(Encoding.UTF8.GetBytes(hdrLineText + "\n"), cancellationToken);


            var result = new TextLogFile(filename, fs, 1, fileDate, TextLogFileType.Channel,
                new Dictionary<string, CharacterInfo>(),
                new Dictionary<string, string>());
            return result;
        }

        public static async Task<TextLogFile> OpenAsync(string filename, CancellationToken cancellationToken)
        {
            bool gotHeaderInfo = false;
            int? fileVersion = null;
            DateOnly? fileDate = null;
            TextLogFileType? fileType = null;
            var shortCodeDict = new Dictionary<string, CharacterInfo>();
            var lastAdBySpeaker = new Dictionary<string, string>();

            var returnedResult = false;
            var fs = File.Open(filename, FileMode.Open);
            try
            {
                await foreach (var lfn in EnumerateLogFileLinesAsync(fs, cancellationToken))
                {
                    if (lfn is IResolvedHeaderLogFileLine headerLogLine)
                    {
                        gotHeaderInfo = true;
                        fileVersion = headerLogLine.FileVersion;
                        fileDate = headerLogLine.LogFileDate;
                        fileType = headerLogLine.LogFileType;
                    }
                    else if (lfn is ResolvedDefineLogFileLine defineLogLine)
                    {
                        shortCodeDict[defineLogLine.ShortCode] = new CharacterInfo(defineLogLine.CharacterName, defineLogLine.Gender);
                    }
                    else if (lfn is ResolvedAdMessageLogFileLine adMessageLogLine)
                    {
                        lastAdBySpeaker[adMessageLogLine.Speaker] = adMessageLogLine.AdMessage;
                    }
                }

                if (gotHeaderInfo)
                {
                    fs.Seek(0, SeekOrigin.End);

                    var result = new TextLogFile(filename, fs,
                        fileVersion!.Value, fileDate!.Value, fileType!.Value, shortCodeDict, lastAdBySpeaker);
                    returnedResult = true;
                    return result;
                }
                else
                {
                    throw new ApplicationException("Log file is missing a header line");
                }
            }
            finally
            {
                if (!returnedResult)
                {
                    await fs.DisposeAsync();
                }
            }
        }

        private static async IAsyncEnumerable<IResolvedLogFileLine> EnumerateLogFileLinesAsync(
            Stream s, 
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            int? fileVersion = null;
            DateOnly? fileDate = null;
            TextLogFileType? fileType = null;
            var shortCodeDict = new Dictionary<string, CharacterInfo>();
            var lastAdByChar = new Dictionary<string, string>();

            var reader = new StreamReader(s);
            string? line;
            while ((line = await reader.ReadLineAsync()) != null)
            {
                if (LogLineBase.TryDeserialize(fileDate ?? new DateOnly(2000, 1, 1), line, out var logLine))
                {
                    if (logLine is HeaderLogLineBase headerLogLine)
                    {
                        fileVersion = headerLogLine.FileVersion;
                        fileDate = headerLogLine.LogFileDate;
                        fileType = headerLogLine.LogLineTypeChar == 'C' ? TextLogFileType.Channel
                            : headerLogLine.LogLineTypeChar == 'P' ? TextLogFileType.PrivateMessage
                            : TextLogFileType.Unknown;

                        if (logLine is ChannelHeaderLogLine channelHeaderLogLine)
                        {
                            yield return new ResolvedChannelHeaderLogFileLine(
                                Timestamp: new DateTime(fileDate.Value, new TimeOnly(0, 0), DateTimeKind.Utc),
                                FileVersion: fileVersion.Value,
                                LogFileDate: fileDate.Value,
                                LogFileType: fileType.Value,
                                ChannelName: channelHeaderLogLine.ChannelName,
                                ChannelTitle: channelHeaderLogLine.ChannelTitle);

                        }
                        else if (logLine is PMConversationHeaderLogLine pmConversationHeaderLogLine)
                        {
                            yield return new ResolvedPMConversationHeaderLogFileLine(
                                Timestamp: new DateTime(fileDate.Value, new TimeOnly(0, 0), DateTimeKind.Utc),
                                FileVersion: fileVersion.Value,
                                LogFileDate: fileDate.Value,
                                LogFileType: fileType.Value,
                                MyCharacterName: pmConversationHeaderLogLine.MyCharacterName,
                                TheirCharacterName: pmConversationHeaderLogLine.TheirCharacterName);
                        }
                    }
                    else if (logLine is DefineCharacterLogLine defineLogLine)
                    {
                        CharacterInfo ci;
                        if (defineLogLine.CharacterName is not null)
                        {
                            ci = new(defineLogLine.CharacterName, defineLogLine.Gender);
                        }
                        else if (shortCodeDict.TryGetValue(defineLogLine.ShortCode, out var existingDef))
                        {
                            ci = new(existingDef.CharacterName, defineLogLine.Gender);
                        }
                        else
                        {
                            continue;
                        }

                        shortCodeDict[defineLogLine.ShortCode] = ci;

                        yield return new ResolvedDefineLogFileLine(
                            Timestamp: defineLogLine.Timestamp,
                            ShortCode: defineLogLine.ShortCode,
                            CharacterName: ci.CharacterName,
                            Gender: ci.Gender);
                    }
                    else if (logLine is ChatMessageLogLine chatMessageLogLine)
                    {
                        var speaker = "Unknown Character";
                        var speakerGender = "unknown";
                        if (shortCodeDict.TryGetValue(chatMessageLogLine.SpeakerShortCode, out var speakerInfo))
                        {
                            speaker = speakerInfo.CharacterName;
                            speakerGender = speakerInfo.Gender;
                        }

                        yield return new ResolvedChatMessageLogFileLine(
                            Timestamp: chatMessageLogLine.Timestamp,
                            Speaker: speaker,
                            SpeakerGender: speakerGender,
                            TextMessage: chatMessageLogLine.MessageText);
                    }
                    else if (logLine is AdMessageLogLine adMessageLogLine)
                    {
                        var speaker = "Unknown Character";
                        var speakerGender = "unknown";
                        if (shortCodeDict.TryGetValue(adMessageLogLine.SpeakerShortCode, out var speakerInfo))
                        {
                            speaker = speakerInfo.CharacterName;
                            speakerGender = speakerInfo.Gender;
                        }

                        if (adMessageLogLine.IsRepeatedAd)
                        {
                            if (lastAdByChar.TryGetValue(speaker, out var lastAdMessage))
                            {
                                yield return new ResolvedAdMessageLogFileLine(
                                    Timestamp: adMessageLogLine.Timestamp,
                                    Speaker: speaker,
                                    SpeakerGender: speakerGender,
                                    AdMessage: lastAdMessage);
                            }
                        }
                        else
                        {
                            lastAdByChar[speaker] = adMessageLogLine.MessageText;
                            yield return new ResolvedAdMessageLogFileLine(
                                Timestamp: adMessageLogLine.Timestamp,
                                Speaker: speaker,
                                SpeakerGender: speakerGender,
                                AdMessage: adMessageLogLine.MessageText);
                        }
                    }
                    else if (logLine is DiceRollLogLine diceRollLogLine)
                    {
                        var speaker = "Unknown Character";
                        var speakerGender = "unknown";
                        if (shortCodeDict.TryGetValue(diceRollLogLine.SpeakerShortCode, out var speakerInfo))
                        {
                            speaker = speakerInfo.CharacterName;
                            speakerGender = speakerInfo.Gender;
                        }

                        yield return new ResolvedDiceRollLogFileLine(
                            Timestamp: diceRollLogLine.Timestamp,
                            Speaker: speaker,
                            SpeakerGender: speakerGender,
                            RollExpression: diceRollLogLine.DiceExpression,
                            IndividualResults: diceRollLogLine.IndividualResults,
                            EndResult: diceRollLogLine.EndResult);
                    }
                    else if (logLine is BottleSpinLogLine bottleSpinLogLine)
                    {
                        var speaker = "Unknown Character";
                        var speakerGender = "unknown";
                        if (shortCodeDict.TryGetValue(bottleSpinLogLine.SpinnerShortCode, out var speakerInfo))
                        {
                            speaker = speakerInfo.CharacterName;
                            speakerGender = speakerInfo.Gender;
                        }

                        var target = "Unknown Character";
                        var targetGender = "unknown";
                        if (shortCodeDict.TryGetValue(bottleSpinLogLine.TargetShortCode, out var targetInfo))
                        {
                            target = targetInfo.CharacterName; 
                            targetGender = targetInfo.Gender;
                        }

                        yield return new ResolvedBottleSpinLogFileLine(
                            Timestamp: bottleSpinLogLine.Timestamp,
                            Speaker: speaker,
                            SpeakerGender: speakerGender,
                            Target: target,
                            TargetGender: targetGender);
                    }
                }
            }
        }

        private readonly string _filename;
        private readonly FileStream _fs;
        private readonly int _fileVersion;
        private readonly DateOnly _fileDate;
        private readonly TextLogFileType _logFileType;
        private readonly Dictionary<string, CharacterInfo> _shortCodeDict;
        private readonly Dictionary<string, string> _charNameToShortCodeDict;
        private readonly Dictionary<string, string> _lastAdBySpeaker;

        private readonly SemaphoreSlim _accessSem = new SemaphoreSlim(1);
        private bool _disposed = false;
        private int _nextShortCodeNum = 1;

        private TextLogFile(string filename, FileStream fs,
            int fileVersion, DateOnly fileDate, TextLogFileType logFileType,
            Dictionary<string, CharacterInfo> shortCodeDict,
            Dictionary<string, string> lastAdBySpeaker)
        {
            _filename = filename;
            _fs = fs;
            _fileVersion = fileVersion;
            _fileDate = fileDate;
            _logFileType = logFileType;
            _shortCodeDict = shortCodeDict;
            _lastAdBySpeaker = lastAdBySpeaker;

            _charNameToShortCodeDict = new Dictionary<string, string>();
            foreach (var kvp in _shortCodeDict)
            {
                _charNameToShortCodeDict[kvp.Value.CharacterName] = kvp.Key;
            }
        }

        public void Dispose()
        {
            DisposeAsync().AsTask().GetAwaiter().GetResult();
        }

        public async ValueTask DisposeAsync()
        { 
            if (!_disposed)
            {
                await _accessSem.WaitAsync();
                try
                {
                    if (!_disposed)
                    {
                        _disposed = true;
                        _fs.Dispose();
                    }
                }
                finally
                {
                    _accessSem.Release();
                }
            }
        }

        private void ThrowIfDisposed()
        {
            if (_disposed)
            {
                throw new ObjectDisposedException(this.GetType().Name);
            }
        }

        private async Task RunWithinLockAsync(Func<CancellationToken, Task> func, CancellationToken cancellationToken)
        {
            await _accessSem.WaitAsync(cancellationToken);
            try
            {
                ThrowIfDisposed();
                await func(cancellationToken);
            }
            finally
            {
                _accessSem.Release();
            }
        }

        private string ShortCodeNumToShortCodeString(int shortCodeNum)
        {
            return shortCodeNum.ToString();
        }

        private string GetNewShortCode()
        {
            while (true)
            {
                var candidateShortCodeNum = _nextShortCodeNum++;
                var candidateShortCode = ShortCodeNumToShortCodeString(candidateShortCodeNum);
                if (!_shortCodeDict.ContainsKey(candidateShortCode))
                {
                    return candidateShortCode;
                }
            }
        }

        private async Task<string> GetShortCodeForCharacterAsync(
            DateTime timestamp,
            string characterName, string characterGender,
            CancellationToken cancellationToken)
        {
            if (!_charNameToShortCodeDict.TryGetValue(characterName, out var charShortCode) ||
                !_shortCodeDict.TryGetValue(charShortCode, out var charInfo))
            {
                charShortCode = GetNewShortCode();
                _shortCodeDict[charShortCode] = new CharacterInfo(characterName, characterGender);
                _charNameToShortCodeDict[characterName] = charShortCode;

                await WriteLogLineAsync(new DefineCharacterLogLine()
                {
                    Timestamp = timestamp,
                    CharacterName = characterName,
                    Gender = characterGender,
                    ShortCode = charShortCode
                },
                cancellationToken);
            }
            else if (charInfo.Gender != characterGender)
            {
                _shortCodeDict[charShortCode] = new CharacterInfo(characterName, characterGender);

                await WriteLogLineAsync(new DefineCharacterLogLine()
                {
                    Timestamp = timestamp,
                    Gender = characterGender,
                    ShortCode = charShortCode
                },
                cancellationToken);
            }

            return charShortCode;
        }

        private async Task WriteLogLineAsync(LogLineBase msg, CancellationToken cancellationToken)
        {
            var serMsg = LogLineBase.Serialize(msg);
            var msgBytes = Encoding.UTF8.GetBytes(serMsg + "\n");
            await _fs.WriteAsync(msgBytes, cancellationToken);
            await _fs.FlushAsync(cancellationToken);
        }

        public async Task WriteChatMessageAsync(
            DateTime timestamp, string speakerCharName, string speakerGender, string messageText,
            CancellationToken cancellationToken)
        {
            await RunWithinLockAsync(
                cancellationToken: cancellationToken,
                func: async (cancellationToken) =>
                {
                    var speakerShortCode = await GetShortCodeForCharacterAsync(
                        timestamp, speakerCharName, speakerGender, cancellationToken);

                    var msg = new ChatMessageLogLine()
                    {
                        Timestamp = timestamp,
                        MessageText = messageText,
                        SpeakerShortCode = speakerShortCode
                    };
                    await WriteLogLineAsync(msg, cancellationToken);
                });
        }

        public async Task WriteAdMessageAsync(
            DateTime timestamp, string speakerCharName, string speakerGender, string messageText,
            CancellationToken cancellationToken)
        {
            await RunWithinLockAsync(
                cancellationToken: cancellationToken,
                func: async (cancellationToken) =>
                {
                    var speakerShortCode = await GetShortCodeForCharacterAsync(
                        timestamp, speakerCharName, speakerGender, cancellationToken);

                    if (_lastAdBySpeaker.TryGetValue(speakerCharName, out var lastAdForSpeaker)
                        && lastAdForSpeaker == messageText)
                    {
                        var msg = new AdMessageLogLine()
                        {
                            Timestamp = timestamp,
                            IsRepeatedAd = true,
                            MessageText = "",
                            SpeakerShortCode = speakerShortCode
                        };
                        await WriteLogLineAsync(msg, cancellationToken);
                    }
                    else
                    {
                        var msg = new AdMessageLogLine()
                        {
                            Timestamp = timestamp,
                            IsRepeatedAd = false,
                            MessageText = messageText,
                            SpeakerShortCode = speakerShortCode
                        };
                        await WriteLogLineAsync(msg, cancellationToken);
                        _lastAdBySpeaker[speakerCharName] = messageText;
                    }
                });
        }

        public async Task WriteDiceRollAsync(
            DateTime timestamp, string speakerCharName, string speakerGender, 
            string diceExpression, List<int> individualResults, int endResult,
            CancellationToken cancellationToken)
        {
            await RunWithinLockAsync(
                cancellationToken: cancellationToken,
                func: async (cancellationToken) =>
                {
                    var speakerShortCode = await GetShortCodeForCharacterAsync(
                        timestamp, speakerCharName, speakerGender, cancellationToken);
                    
                    var msg = new DiceRollLogLine()
                    {
                        Timestamp = timestamp,
                        SpeakerShortCode = speakerShortCode,
                        DiceExpression = diceExpression,
                        IndividualResults = individualResults,
                        EndResult = endResult
                    };
                    await WriteLogLineAsync(msg, cancellationToken);
                });
        }

        public async Task WriteBottleSpinAsync(
            DateTime timestamp, string speakerCharName, string speakerGender,
            string targetCharName, string targetGender,
            CancellationToken cancellationToken)
        {
            await RunWithinLockAsync(
                cancellationToken: cancellationToken,
                func: async (cancellationToken) =>
                {
                    var speakerShortCode = await GetShortCodeForCharacterAsync(
                        timestamp, speakerCharName, speakerGender, cancellationToken);
                    var targetShortCode = await GetShortCodeForCharacterAsync(
                        timestamp, targetCharName, targetGender, cancellationToken);

                    var msg = new BottleSpinLogLine()
                    {
                        Timestamp = timestamp,
                        SpinnerShortCode = speakerShortCode,
                        TargetShortCode = targetShortCode
                    };
                    await WriteLogLineAsync(msg, cancellationToken);
                });
        }
    }

    internal interface IResolvedLogFileLine 
    { 
        DateTime Timestamp { get; }
    }

    internal interface IResolvedHeaderLogFileLine
    {
        DateTime Timestamp { get; }
        int FileVersion { get; }
        DateOnly LogFileDate { get; }
        TextLogFileType LogFileType { get; }
    }

    internal record ResolvedChannelHeaderLogFileLine(
        DateTime Timestamp,
        int FileVersion,
        DateOnly LogFileDate,
        TextLogFileType LogFileType,
        string ChannelName,
        string ChannelTitle) : IResolvedLogFileLine, IResolvedHeaderLogFileLine;

    internal record ResolvedPMConversationHeaderLogFileLine(
        DateTime Timestamp,
        int FileVersion,
        DateOnly LogFileDate,
        TextLogFileType LogFileType,
        string MyCharacterName,
        string TheirCharacterName) : IResolvedLogFileLine, IResolvedHeaderLogFileLine;

    internal record ResolvedDefineLogFileLine(
        DateTime Timestamp,
        string ShortCode,
        string CharacterName,
        string Gender) : IResolvedLogFileLine;

    internal record ResolvedChatMessageLogFileLine(
        DateTime Timestamp,
        string Speaker,
        string SpeakerGender,
        string TextMessage) : IResolvedLogFileLine;

    internal record ResolvedAdMessageLogFileLine(
        DateTime Timestamp,
        string Speaker,
        string SpeakerGender,
        string AdMessage) : IResolvedLogFileLine;

    internal record ResolvedDiceRollLogFileLine(
        DateTime Timestamp,
        string Speaker,
        string SpeakerGender,
        string RollExpression,
        List<int> IndividualResults,
        int EndResult) : IResolvedLogFileLine;

    internal record ResolvedBottleSpinLogFileLine(
        DateTime Timestamp,
        string Speaker,
        string SpeakerGender,
        string Target,
        string TargetGender) : IResolvedLogFileLine;
}
