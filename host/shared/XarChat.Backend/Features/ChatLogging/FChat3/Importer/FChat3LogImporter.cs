using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.FileChooser;

namespace XarChat.Backend.Features.ChatLogging.FChat3.Importer
{
    internal class HorizonLogImporter : FChat3LogImporter
    {
        public HorizonLogImporter(
            IFileChooser fileChooser,
            IChatLogWriter chatLogWriter)
            : base(fileChooser, chatLogWriter)
        {
            
        }

        protected override string ApplicationDisplayName => "Horizon";
    }

    internal class FChat3LogImporter : IChatLogImporter
    {
        private readonly IFileChooser _fileChooser;
        private readonly IChatLogWriter _chatLogWriter;

        public FChat3LogImporter(
            IFileChooser fileChooser,
            IChatLogWriter chatLogWriter)
        {
            _fileChooser = fileChooser;
            _chatLogWriter = chatLogWriter;
        }

        protected virtual string ApplicationDisplayName => "F-Chat 3.0";

        protected virtual string? GetDefaultDirectory()
        {
            string? preferredPath = null;
            if (OperatingSystem.IsWindows())
            {
                preferredPath = "%appdata%\\fchat\\data";
                preferredPath = Environment.ExpandEnvironmentVariables(preferredPath);
            }
            else if (OperatingSystem.IsLinux())
            {
                preferredPath = "~/.config/fchat/data";
            }
            else if (OperatingSystem.IsMacOS())
            {
                preferredPath = "~/Library/Application Support/fchat/data";
            }
            else
            {
                preferredPath = null;
            }

            if (preferredPath is not null)
            {
                if (!Directory.Exists(preferredPath))
                {
                    preferredPath = null;
                }
            }

            return preferredPath;
        }

        public async Task ImportAsync(
            Func<string, Task> writeStatusFunc,
            CancellationToken cancellationToken)
        {
            var defDir = GetDefaultDirectory();
            var topLevelDirectory = await _fileChooser.SelectLocalDirectoryAsync(
                    initialDirectory: defDir,
                    dialogTitle: $"Select {ApplicationDisplayName} Log Directory",
                    cancellationToken: cancellationToken);
            if (topLevelDirectory is null) { return; }

            var hasLogs = GetMyCharacterNames(topLevelDirectory).Any();
            if (!hasLogs)
            {
                throw new ApplicationException("That location does not appear to contain any logs. Please choose the " +
                    $"top level directory where the {ApplicationDisplayName} logs are stored.");
            }

            await writeStatusFunc($"Beginning import of {ApplicationDisplayName} log path {topLevelDirectory}");
            await this.ImportFromFileAsync(
                topLevelDirectory,
                writeStatusFunc,
                cancellationToken);
            await writeStatusFunc($"{ApplicationDisplayName} log import complete!");
        }

        public async Task ImportFromFileAsync(
            string filename, 
            Func<string, Task> writeStatusFunc, CancellationToken cancellationToken)
        {
            var charNames = GetMyCharacterNames(filename).ToList();

            var availableChannels = GetAvailableChannels(filename, charNames);
            await writeStatusFunc($"Found {availableChannels.Count:N0} channels to import.");

            await _chatLogWriter.EnsureChannelsAsync(
                availableChannels.Select(ac => (ac.ChannelName, ac.ChannelTitle)).ToAsyncEnumerable(), cancellationToken);
            await ImportChannelMessagesAsync(availableChannels, writeStatusFunc, cancellationToken);

            var availablePMConvos = GetAvailablePMConvos(filename, charNames);
            await writeStatusFunc($"Found {availablePMConvos.Count:N0} PM conversations to import.");

            await _chatLogWriter.EnsurePMConvosAsync(
                availablePMConvos.Select(apm => (apm.MyCharacterName, apm.InterlocutorCharacterName)).ToAsyncEnumerable(), cancellationToken);
            await ImportPMConvoMessagesAsync(availablePMConvos, writeStatusFunc, cancellationToken);
        }

        private async Task ImportPMConvoMessagesAsync(
            ICollection<AvailablePMConvoInfo> availablePMConvos, 
            Func<string, Task> writeStatusFunc, 
            CancellationToken cancellationToken)
        {
            var msgEnumsForConvos =
                from pmConvo in availablePMConvos
                select (pmConvo, EnumerateUniqueMessagesFromLogFiles([pmConvo.LogFileName]));

            IEnumerable<EnsurePMConvoMessageInfo> enumerateEPCMIFromMsgEnum(
                (AvailablePMConvoInfo apmci, IEnumerable<FChat3Message> msgs) tuple)
            {
                foreach (var msg in tuple.msgs)
                {
                    var xcMessageTuple = FChat3MessageTypeToXCMessageType(msg);
                    if (xcMessageTuple is not null)
                    {
                        yield return new EnsurePMConvoMessageInfo(
                            MyCharacterName: tuple.apmci.MyCharacterName,
                            InterlocutorCharacterName: tuple.apmci.InterlocutorCharacterName,
                            MessageType: xcMessageTuple.Value.XCMessageType,
                            SpeakingCharacterName: msg.Sender,
                            MessageText: xcMessageTuple.Value.MessageText,
                            Timestamp: msg.Timestamp,
                            SpeakerGenderId: 0,
                            SpeakerOnlineStatusId: 0);
                    }
                }
            }

            var msgsForMsgEnums = msgEnumsForConvos.SelectMany(enumerateEPCMIFromMsgEnum)
                .ToAsyncEnumerable();

            await _chatLogWriter.EnsurePMConvoMessagesAsync(msgsForMsgEnums, cancellationToken);
        }

        private async Task ImportChannelMessagesAsync(
            ICollection<AvailableChannelInfo> availableChannels, 
            Func<string, Task> writeStatusFunc, 
            CancellationToken cancellationToken)
        {
            var msgEnumsForChannels =
                from channel in availableChannels
                select (channel, EnumerateUniqueMessagesFromLogFiles(channel.LogFileNames));

            IEnumerable<EnsureChannelMessageInfo> enumerateECMIFromMsgEnum(
                (AvailableChannelInfo aci, IEnumerable<FChat3Message> msgs) tuple)
            {
                foreach (var msg in tuple.msgs)
                {
                    var xcMessageTuple = FChat3MessageTypeToXCMessageType(msg);
                    if (xcMessageTuple is not null)
                    {
                        yield return new EnsureChannelMessageInfo(
                            ChannelName: tuple.aci.ChannelName,
                            ChannelTitle: tuple.aci.ChannelTitle,
                            MessageType: xcMessageTuple.Value.XCMessageType,
                            SpeakingCharacterName: msg.Sender,
                            MessageText: xcMessageTuple.Value.MessageText,
                            Timestamp: msg.Timestamp,
                            SpeakerGenderId: 0,
                            SpeakerOnlineStatusId: 0);
                    }
                }
            }

            var msgsForMsgEnums = msgEnumsForChannels.SelectMany(enumerateECMIFromMsgEnum)
                .ToAsyncEnumerable();

            await _chatLogWriter.EnsureChannelMessagesAsync(msgsForMsgEnums, cancellationToken);
        }

        private static readonly Regex RollPattern =
            new Regex(@"^(?<prestuff>rolls\s+(.+?):\s+(.*?\s+=\s+)?)(?<endresult>\d+)$",
                RegexOptions.Compiled | RegexOptions.Singleline | RegexOptions.ExplicitCapture);
        private static readonly Regex SpinPattern =
            new Regex(@"^(?<prestuff>spins the bottle:\s*)(?<target>.+)$",
                RegexOptions.Compiled | RegexOptions.Singleline | RegexOptions.ExplicitCapture);

        private (int XCMessageType, string MessageText)? FChat3MessageTypeToXCMessageType(FChat3Message message)
        {
            switch (message.Type)
            {
                case FChat3MessageType.Message:
                    return (0, message.Text);
                case FChat3MessageType.Action:
                    // Convert text?
                    return (0, "/me " + message.Text);
                case FChat3MessageType.Warn:
                    // Convert text?
                    return (0, "/warn " + message.Text);
                case FChat3MessageType.Roll:
                    // Convert text?
                    if (message.Text.StartsWith("rolls "))
                    {
                        var mtxt = message.Text;
                        var m = RollPattern.Match(mtxt);
                        if (m.Success && !m.Groups["endresult"].Value.Contains("[b]"))
                        {
                            mtxt = m.Groups["prestuff"].Value + "[b]" + m.Groups["endresult"].Value + "[/b]";
                        }

                        return (2, mtxt);
                    }
                    else
                    {
                        var mtxt = message.Text;
                        var m = SpinPattern.Match(mtxt);
                        if (m.Success && !m.Groups["target"].Value.Contains("[user]"))
                        {
                            mtxt = m.Groups["prestuff"].Value + "[user]" + m.Groups["target"].Value + "[/user]";
                        }

                        return (3, mtxt);
                    }
                case FChat3MessageType.Ad:
                case FChat3MessageType.Broadcast:
                case FChat3MessageType.Event:
                default:
                    return null;
            }
        }

        private IEnumerable<string> GetMyCharacterNames(string topLevelDirectory)
        {
            foreach (var subdir in Directory.EnumerateDirectories(topLevelDirectory))
            {
                var di = new DirectoryInfo(Path.Combine(subdir, "logs"));
                if (di.Exists)
                {
                    yield return Path.GetFileName(subdir);
                }
            }
        }

        private record AvailableChannelInfo(
            string ChannelName,
            string ChannelTitle,
            List<string> LogFileNames);

        private record AvailablePMConvoInfo(
            string MyCharacterName,
            string InterlocutorCharacterName,
            string LogFileName);

        private ICollection<AvailablePMConvoInfo> GetAvailablePMConvos(string topLevelDirectory, List<string> myCharacterNames)
        {
            var results = new List<AvailablePMConvoInfo>();
            foreach (var myCharacterName in myCharacterNames)
            {
                var logDir = Path.Combine(topLevelDirectory, myCharacterName, "logs");
                foreach (var indexFilename in Directory.EnumerateFiles(logDir, "*.idx")
                    .Where(fn => !Path.GetFileName(fn).StartsWith("#") && Path.GetFileName(fn) != "_.idx"))
                {
                    var logFilename = Path.Combine(Path.GetDirectoryName(indexFilename)!, Path.GetFileNameWithoutExtension(indexFilename));

                    string interlocutorCharacterName;
                    using (var idxFile = File.OpenRead(indexFilename))
                    {
                        var titleLengthBuf = new byte[1];
                        idxFile.ReadExactly(titleLengthBuf);
                        var titleBuf = new byte[(int)titleLengthBuf[0]];
                        idxFile.ReadExactly(titleBuf);
                        interlocutorCharacterName = Encoding.UTF8.GetString(titleBuf);
                    }

                    var apmi = new AvailablePMConvoInfo(
                        MyCharacterName: myCharacterName,
                        InterlocutorCharacterName: interlocutorCharacterName,
                        LogFileName: logFilename);
                    results.Add(apmi);
                }
            }
            return results;
        }

        private ICollection<AvailableChannelInfo> GetAvailableChannels(string topLevelDirectory, List<string> myCharacterNames)
        {
            var resultDict = new Dictionary<string, AvailableChannelInfo>();

            foreach (var myCharacterName in myCharacterNames)
            {
                var logDir = Path.Combine(topLevelDirectory, myCharacterName, "logs");
                foreach (var indexFilename in Directory.EnumerateFiles(logDir, "#*.idx"))
                {
                    var logFilename = Path.Combine(Path.GetDirectoryName(indexFilename)!, Path.GetFileNameWithoutExtension(indexFilename));

                    var channelName = Path.GetFileName(logFilename).Substring(1);
                    var caseFixedChannelName = channelName;
                    if (channelName.StartsWith("adh-"))
                    {
                        channelName = "ADH-" + channelName.Substring(4);
                        caseFixedChannelName = channelName;
                    }

                    if (!resultDict.ContainsKey(channelName))
                    {
                        string channelTitle;
                        using (var idxFile = File.OpenRead(indexFilename))
                        {
                            var titleLengthBuf = new byte[1];
                            idxFile.ReadExactly(titleLengthBuf);
                            var titleBuf = new byte[(int)titleLengthBuf[0]];
                            idxFile.ReadExactly(titleBuf);
                            channelTitle = Encoding.UTF8.GetString(titleBuf);
                        }
                        if (!channelName.StartsWith("ADH-"))
                        {
                            caseFixedChannelName = channelTitle;
                        }

                        var aci = new AvailableChannelInfo(
                            ChannelName: caseFixedChannelName,
                            ChannelTitle: channelTitle,
                            LogFileNames: GetLogFilenamesMatching(topLevelDirectory, myCharacterNames, Path.GetFileName(logFilename)));
                        resultDict[channelName] = aci;
                    }
                }
            }

            return resultDict.Values;
        }

        private List<string> GetLogFilenamesMatching(string topLevelDirectory, List<string> myCharacterNames, string fn)
        {
            var results = new List<string>();
            foreach (var myCharacterName in myCharacterNames)
            {
                var logDir = Path.Combine(topLevelDirectory, myCharacterName, "logs");
                var checkFilename = Path.Combine(logDir, fn);
                if (File.Exists(checkFilename))
                {
                    results.Add(checkFilename);
                }
            }
            return results;
        }

        private IEnumerable<FChat3Message> EnumerateUniqueMessagesFromLogFiles(ICollection<string> logFileNames)
        {
            var logFiles = new List<FChat3LogFile2>();
            try
            {
                foreach (var fn in logFileNames)
                {
                    var lf = new FChat3LogFile2(fn);
                    logFiles.Add(lf);
                }

                var similarMessageWindow = TimeSpan.FromMinutes(2);

                bool areSimilarMessages(FChat3Message a, FChat3Message b)
                {
                    if (a.Type == b.Type
                        && a.Sender == b.Sender
                        && a.Text == b.Text)
                    {
                        var tsDiff = new TimeSpan(Math.Abs((a.Timestamp - b.Timestamp).Ticks));
                        if (tsDiff < similarMessageWindow)
                        {
                            return true;
                        }
                    }
                    return false;
                }

                var seenMessages = new HashSet<(object Source, FChat3Message Message)>();
                bool alreadySeenMessage((object Source, FChat3Message Message) lookForTuple)
                {
                    foreach (var smsg in seenMessages)
                    {
                        // Always allow duplicate messages from the same source stream
                        if (smsg.Source == lookForTuple.Source) { continue; }
                        // Don't allow if we've seen a similar message from a different stream within the
                        // dedup interval
                        if (areSimilarMessages(smsg.Message, lookForTuple.Message)) { return true; }
                    }
                    // No dup found!
                    return false;
                }
                void purgeOldSeenMessages(DateTime before)
                {
                    // Forget seen messages old enough to not match the dedup window anymore
                    seenMessages.RemoveWhere(tup => tup.Message.Timestamp < before);
                }

                var enumerables = logFiles.Select(lf => lf.EnumerateMessages(EnumerationDirection.Forward));
                foreach (var msgTuple in EnumerateMessagesInDateOrder(enumerables))
                {
                    purgeOldSeenMessages(msgTuple.Message.Timestamp - similarMessageWindow);
                    if (!alreadySeenMessage(msgTuple))
                    {
                        seenMessages.Add(msgTuple);
                        yield return msgTuple.Message;
                    }
                }
            }
            finally
            {
                foreach (var lf in logFiles)
                {
                    lf.Dispose();
                }
            }
        }

        private IEnumerable<(object Source, FChat3Message Message)> EnumerateMessagesInDateOrder(
            IEnumerable<IEnumerable<FChat3Message>> enumerables)
        {
            var activeInnerEtors = new HashSet<IEnumerator<FChat3Message>>();

            // Advance each to the first record (if no records, remove the file from the list)
            foreach (var enumerable in enumerables)
            {
                var etor = enumerable.GetEnumerator();

                if (etor.MoveNext())
                {
                    activeInnerEtors.Add(etor);
                }
                else
                {
                    etor.Dispose();
                }
            }

            // While there are still any messages unyielded, get the oldest, yield it; and
            // advance that file to the next message in it (removing that file from the
            // list when its done)
            while (activeInnerEtors.Count > 0)
            {
                IEnumerator<FChat3Message>? oldestCurrent = null;
                foreach (var ie in activeInnerEtors)
                {
                    if (oldestCurrent is null || ie.Current.Timestamp < oldestCurrent.Current.Timestamp)
                    {
                        oldestCurrent = ie;
                    }
                }
                if (oldestCurrent is null) { break; }

                yield return (oldestCurrent, oldestCurrent.Current);

                if (!oldestCurrent.MoveNext())
                {
                    activeInnerEtors.Remove(oldestCurrent);
                    oldestCurrent.Dispose();
                }
            }
        }
    }
}
