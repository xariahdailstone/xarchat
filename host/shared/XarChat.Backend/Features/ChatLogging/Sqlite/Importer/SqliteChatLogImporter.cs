using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Channels;
using System.Xml.Linq;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.Importer
{
    internal class SqliteChatLogImporter : IChatLogImporter
    {
        private readonly SqliteChatLogWriter _logWriter;

        public SqliteChatLogImporter(
            SqliteChatLogWriter logWriter)
        {
            _logWriter = logWriter;
        }

        public async Task ImportFromFileAsync(
            string filename,
            Func<string, Task> writeStatusFunc,
            CancellationToken cancellationToken)
        {
            await using var inputCnn = await OpenLogFileAsync(filename, cancellationToken);
            var version = await DetectLogFileVersion(inputCnn, cancellationToken);

            ILogFileVersionedReader reader;
            switch (version)
            {
                case 1: // initial
                case 2: // add schema version table
                case 3: // add gender/status to channel log
                case 4: // add gender/status to PM log
                    reader = new SplitTableLogFileVersionedReader(
                        cnn: inputCnn,
                        channelMessagesHaveGender: version >= 3, 
                        pmsHaveGender: version >= 4);
                    break;
                case 5: // combine channel/PM messages
                case 6: // remove full text index
                case 7: // use blob string hashes
                case 8: // remove unused indexes
                case 9: // remove logged ads
                    reader = new CombinedTableLogFileVersionedReader(
                        cnn: inputCnn);
                    break;
                default:
                    throw new ApplicationException($"Unhandled log file version: {version}");
            }

            await writeStatusFunc($"Detected chat log version {version} format.");

            await writeStatusFunc($"Importing characters...");
            await ImportCharactersAsync(reader, cancellationToken);

            await writeStatusFunc($"Getting channels...");
            var channels = await reader.EnumerateChannelsAsync(cancellationToken).ToListAsync(cancellationToken);
            await writeStatusFunc($"Importing {channels.Count} channels...");
            await ImportChannelsAsync(channels, cancellationToken);
            await writeStatusFunc($"Importing channel messages...");
            await ImportChannelMessagesAsync(reader, channels, writeStatusFunc, cancellationToken);

            await writeStatusFunc($"Getting PM conversations...");
            var pmConvos = await reader.EnumeratePMConvosAsync(cancellationToken).ToListAsync(cancellationToken);
            await writeStatusFunc($"Importing PM conversations...");
            await ImportPMConvosAsync(pmConvos, cancellationToken);
            await writeStatusFunc($"Importing PM conversation messages...");
            await ImportPMConvoMessagesAsync(reader, pmConvos, writeStatusFunc, cancellationToken);
        }

        private async Task ImportCharactersAsync(ILogFileVersionedReader reader, CancellationToken cancellationToken)
        {
            var charsEnumerable = reader.EnumerateCharactersAsync(cancellationToken);
            await _logWriter.EnsureCharactersAsync(
                charsEnumerable.Select(lci => lci.Name!), cancellationToken);
        }

        private async Task ImportChannelsAsync(IEnumerable<LogChannelInfo> channels, CancellationToken cancellationToken)
        {
            await _logWriter.EnsureChannelsAsync(
                channels.Select(c => (c.ChannelName, c.ChannelTitle)).ToAsyncEnumerable(),
                cancellationToken);
        }

        private async Task ImportChannelMessagesAsync(
            ILogFileVersionedReader reader, 
            IEnumerable<LogChannelInfo> channels,
            Func<string, Task> writeStatusFunc,
            CancellationToken cancellationToken)
        {
            long mcount = await channels.ToAsyncEnumerable()
                .Select(async (c, ct) => await reader.CountChannelMessagesAsync(c.ChannelName, ct))
                .SumAsync(cancellationToken);

            long curCount = 0;
            var lastReportedPct = 0;
            var writeSem = new SemaphoreSlim(1);
            void updateCount()
            {
                curCount++;
                var curPct = (int)((curCount * 100L) / mcount);
                if (curPct != lastReportedPct)
                {
                    lastReportedPct = curPct;
                    if (writeSem.Wait(0))
                    {
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                if (!cancellationToken.IsCancellationRequested)
                                {
                                    await writeStatusFunc($"Processing {mcount:N0} messages, {curPct}% complete...");
                                }
                            }
                            finally
                            {
                                writeSem.Release();
                            }
                        });
                    }
                }
            }

            var messages = channels.ToAsyncEnumerable()
                .SelectMany(lci => 
                    reader.EnumerateChannelMessagesAsync(lci.ChannelName, cancellationToken)
                    .Select(x =>
                    {
                        updateCount();
                        return new EnsureChannelMessageInfo(
                                ChannelName: lci.ChannelName,
                                ChannelTitle: lci.ChannelTitle,
                                MessageType: x.MessageType,
                                SpeakingCharacterName: x.SpeakingCharacterName,
                                MessageText: x.MessageText,
                                Timestamp: x.Timestamp,
                                SpeakerGenderId: x.SpeakerGenderId ?? 0,
                                SpeakerOnlineStatusId: x.SpeakerOnlineStatusId ?? 0);
                    }));

            await _logWriter.EnsureChannelMessagesAsync(messages, cancellationToken);
        }

        private async Task ImportPMConvosAsync(IEnumerable<LogPMConvoInfo> pmConvos, CancellationToken cancellationToken)
        {
            await _logWriter.EnsurePMConvosAsync(
                pmConvos.Select(c => (c.MyCharacterName, c.InterlocutorCharacterName)).ToAsyncEnumerable(),
                cancellationToken);
        }

        private async Task ImportPMConvoMessagesAsync(
            ILogFileVersionedReader reader,
            IEnumerable<LogPMConvoInfo> pmConvos,
            Func<string, Task> writeStatusFunc,
            CancellationToken cancellationToken)
        {
            long mcount = await pmConvos.ToAsyncEnumerable()
                .Select(async (c, ct) => await reader.CountPMConvoMessagesAsync(c.MyCharacterName, c.InterlocutorCharacterName, ct))
                .SumAsync(cancellationToken);

            long curCount = 0;
            var lastReportedPct = 0;
            var writeSem = new SemaphoreSlim(1);
            void updateCount()
            {
                curCount++;
                var curPct = (int)((curCount * 100L) / mcount);
                if (curPct != lastReportedPct)
                {
                    lastReportedPct = curPct;
                    if (writeSem.Wait(0))
                    {
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                if (!cancellationToken.IsCancellationRequested)
                                {
                                    await writeStatusFunc($"Processing {mcount:N0} messages, {curPct}% complete...");
                                }
                            }
                            finally
                            {
                                writeSem.Release();
                            }
                        });
                    }
                }
            }

            var messages = pmConvos.ToAsyncEnumerable()
                .SelectMany(lci =>
                    reader.EnumeratePMConvoMessagesAsync(lci.MyCharacterName, lci.InterlocutorCharacterName, cancellationToken)
                    .Select(x =>
                    {
                        updateCount();
                        return new EnsurePMConvoMessageInfo(
                                MyCharacterName: lci.MyCharacterName,
                                InterlocutorCharacterName: lci.InterlocutorCharacterName,
                                MessageType: x.MessageType,
                                SpeakingCharacterName: x.SpeakingCharacterName,
                                MessageText: x.MessageText,
                                Timestamp: x.Timestamp,
                                SpeakerGenderId: x.SpeakerGenderId ?? 0,
                                SpeakerOnlineStatusId: x.SpeakerOnlineStatusId ?? 0);
                    }));

            await _logWriter.EnsurePMConvoMessagesAsync(messages, cancellationToken);
        }

        private async Task<SqliteConnection> OpenLogFileAsync(string filename, CancellationToken cancellationToken)
        {
            var mode = "ReadOnly";
            var connStr = $"Data Source={filename};Mode={mode};Cache=Shared;";
            var cnn = new SqliteConnection(connStr);
            await cnn.OpenAsync(cancellationToken);
            return cnn;
        }

        private async Task<int> DetectLogFileVersion(SqliteConnection cnn, CancellationToken cancellationToken)
        {
            int logFileVersion;

            // See if it has the schemaver table
            var hasSchemaVerTable = false;
            await using (var cmd = cnn.CreateCommand())
            {
                cmd.CommandText = "SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='schemaver'";
                var result = await cmd.ExecuteScalarAsync(cancellationToken);
                hasSchemaVerTable = !((result is DBNull) || (result is null) || ((long)result == 0));
            }

            if (!hasSchemaVerTable)
            {
                // See if it has the characters table
                var hasCharacterTable = false;
                await using (var cmd = cnn.CreateCommand())
                {
                    cmd.CommandText = "SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='character'";
                    var result = await cmd.ExecuteScalarAsync(cancellationToken);
                    hasCharacterTable = !((result is DBNull) || (result is null) || ((long)result == 0));
                }
                if (!hasSchemaVerTable)
                {
                    throw new ApplicationException("Unrecognized log file");
                }
                logFileVersion = 1;
            }
            else
            {
                await using (var cmd = cnn.CreateCommand())
                {
                    cmd.CommandText = "SELECT schemaversion FROM schemaver";
                    var curVer = Convert.ToInt32(await cmd.ExecuteScalarAsync());
                    logFileVersion = curVer;
                }
            }

            return logFileVersion;
        }
    }

    internal interface ILogFileVersionedReader 
    {
        IAsyncEnumerable<LogCharacterInfo> EnumerateCharactersAsync(CancellationToken cancellationToken);
        IAsyncEnumerable<LogChannelInfo> EnumerateChannelsAsync(CancellationToken cancellationToken);
        IAsyncEnumerable<LogPMConvoInfo> EnumeratePMConvosAsync(CancellationToken cancellationToken);
        IAsyncEnumerable<LogMessageInfo> EnumerateChannelMessagesAsync(string channelName, CancellationToken cancellationToken);
        IAsyncEnumerable<LogMessageInfo> EnumeratePMConvoMessagesAsync(
            string myCharacterName, string interlocutorCharacterName, CancellationToken cancellationToken);

        Task<int> CountChannelMessagesAsync(string channelName, CancellationToken cancellationToken);
        Task<int> CountPMConvoMessagesAsync(
            string myCharacterName, string interlocutorCharacterName, CancellationToken cancellationToken);
    }

    internal record LogCharacterInfo(
        string? Name);

    internal record LogChannelInfo(
        string ChannelName,
        string ChannelTitle
    );

    internal record LogPMConvoInfo(
        string MyCharacterName,
        string InterlocutorCharacterName
    );

    internal record LogMessageInfo(
        string SpeakingCharacterName,
        int MessageType,
        string MessageText,
        DateTime Timestamp,
        int? SpeakerGenderId,
        int? SpeakerOnlineStatusId
    );

    internal class SplitTableLogFileVersionedReader : ILogFileVersionedReader
    {
        private readonly SqliteConnection _cnn;
        private readonly bool _channelMessagesHaveGender;
        private readonly bool _pmsHaveGender;

        public SplitTableLogFileVersionedReader(
            SqliteConnection cnn,
            bool channelMessagesHaveGender,
            bool pmsHaveGender)
        {
            _cnn = cnn;
            _channelMessagesHaveGender = channelMessagesHaveGender;
            _pmsHaveGender = pmsHaveGender;
        }

        public async IAsyncEnumerable<LogCharacterInfo> EnumerateCharactersAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await using var cmd = _cnn.CreateCommand();
            cmd.CommandText = "SELECT name FROM character";

            await using var dr = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await dr.ReadAsync(cancellationToken))
            {
                var name = Convert.ToString(dr["name"])!;
                
                yield return new LogCharacterInfo(
                    Name: name);
            }
        }

        public async IAsyncEnumerable<LogChannelInfo> EnumerateChannelsAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await using var cmd = _cnn.CreateCommand();
            cmd.CommandText = "SELECT id, name, title FROM channel";

            await using var dr = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await dr.ReadAsync(cancellationToken))
            {
                var id = Convert.ToInt32(dr["id"]);
                var name = Convert.ToString(dr["name"])!;
                var title = Convert.ToString(dr["title"])!;

                yield return new LogChannelInfo(name, title);
            }
        }

        public async IAsyncEnumerable<LogPMConvoInfo> EnumeratePMConvosAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await using var cmd = _cnn.CreateCommand();
            //cmd.CommandText = @"
            //    SELECT pcm.speakingcharacterid, pcm.messagetype, s.value, pcmtimestamp
            //    FROM pmconvomessage pcm
            //    INNER JOIN character cme ON pcm.mycharacterid = cme.id
            //    INNER JOIN character cthem ON pcm.interlocutorcharacterid = cthem.id
            //    INNER JOIN strings s ON s.id = pcm.textstringid";
            cmd.CommandText = @"
                SELECT DISTINCT cme.name as mycharactername, cthem.name as interlocutorcharactername
                FROM pmconvomessage pcm
                INNER JOIN character cme ON pcm.mycharacterid = cme.id
                INNER JOIN character cthem ON pcm.interlocutorcharacterid = cthem.id";

            await using var dr = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await dr.ReadAsync(cancellationToken))
            {
                var myCharacterName = Convert.ToString(dr["mycharactername"])!;
                var interlocutorCharacterName = Convert.ToString(dr["interlocutorcharactername"])!;

                yield return new LogPMConvoInfo(myCharacterName, interlocutorCharacterName);
            }
        }

        public async Task<int> CountChannelMessagesAsync(string channelName, CancellationToken cancellationToken)
        {
            await using var cmd = _cnn.CreateCommand();
            cmd.CommandText = $@"
                SELECT COUNT(1)
                FROM channelmessage cm
                WHERE cm.channelid = (SELECT id FROM channel c WHERE c.name = @channelName)
                    AND cm.messagetype <> 1";
            cmd.Parameters.Add("@channelName", SqliteType.Text).Value = channelName;
            var resultObj = await cmd.ExecuteScalarAsync(cancellationToken);
            return Convert.ToInt32(resultObj);
        }

        public async Task<int> CountPMConvoMessagesAsync(
            string myCharacterName, string interlocutorCharacterName, CancellationToken cancellationToken)
        {
            await using var cmd = _cnn.CreateCommand();
            cmd.CommandText = $@"
                SELECT COUNT(1)
                FROM pmconvomessage cm
                WHERE cm.mycharacterid = (SELECT id FROM character c WHERE c.namelower = @myCharacterNameLower)
                    AND cm.interlocutorcharacterid = (SELECT id FROM character c WHERE c.namelower = @interlocutorCharacterNameLower)";
            cmd.Parameters.Add("@myCharacterNameLower", SqliteType.Text).Value = myCharacterName.ToLower();
            cmd.Parameters.Add("@interlocutorCharacterNameLower", SqliteType.Text).Value = interlocutorCharacterName.ToLower();
            var resultObj = await cmd.ExecuteScalarAsync(cancellationToken);
            return Convert.ToInt32(resultObj);
        }

        public async IAsyncEnumerable<LogMessageInfo> EnumerateChannelMessagesAsync(
            string channelName,
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await using var cmd = _cnn.CreateCommand();
            var moreSelectColumns = "";
            if (_channelMessagesHaveGender)
            {
                moreSelectColumns = ", cm.genderid, cm.onlinestatusid";
            }
            cmd.CommandText = $@"
                SELECT cspeaker.name as speakingcharactername, cm.messagetype, s.value as messagetext, cm.timestamp {moreSelectColumns}
                FROM channelmessage cm
                INNER JOIN character cspeaker ON cspeaker.id = cm.speakingcharacterid
                INNER JOIN strings s ON s.id = cm.textstringid
                WHERE cm.channelid = (SELECT id FROM channel c WHERE c.name = @channelName)
                    AND cm.messagetype <> 1";
            cmd.Parameters.Add("@channelName", SqliteType.Text).Value = channelName;

            await using var dr = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await dr.ReadAsync(cancellationToken))
            {
                var speakingCharacterName = Convert.ToString(dr["speakingcharactername"])!;
                var messageType = Convert.ToInt32(dr["messagetype"]);
                var messageText = Convert.ToString(dr["messagetext"])!;
                var timestampUnixMS = Convert.ToInt64(dr["timestamp"]);
                var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampUnixMS).UtcDateTime;
                var speakerGenderId = _channelMessagesHaveGender
                    ? (int?)Convert.ToInt32(dr["genderid"])
                    : null;
                var speakerOnlineStatusId = _channelMessagesHaveGender
                    ? (int?)Convert.ToInt32(dr["onlinestatusid"])
                    : null;

                yield return new LogMessageInfo(
                    SpeakingCharacterName: speakingCharacterName,
                    MessageType: messageType,
                    MessageText: messageText,
                    Timestamp: timestamp,
                    SpeakerGenderId: speakerGenderId,
                    SpeakerOnlineStatusId: speakerOnlineStatusId);
            }
        }

        public async IAsyncEnumerable<LogMessageInfo> EnumeratePMConvoMessagesAsync(
            string myCharacterName, 
            string interlocutorCharacterName, 
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await using var cmd = _cnn.CreateCommand();
            var moreSelectColumns = "";
            if (_pmsHaveGender)
            {
                moreSelectColumns = ", cm.genderid, cm.onlinestatusid";
            }
            cmd.CommandText = $@"
                SELECT cspeaker.name as speakingcharactername, cm.messagetype, s.value as messagetext, cm.timestamp {moreSelectColumns}
                FROM pmconvomessage cm
                INNER JOIN character cspeaker ON cspeaker.id = cm.speakingcharacterid
                INNER JOIN strings s ON s.id = cm.textstringid
                WHERE cm.mycharacterid = (SELECT id FROM character c WHERE c.namelower = @myCharacterNameLower)
                    AND cm.interlocutorcharacterid = (SELECT id FROM character c WHERE c.namelower = @interlocutorCharacterNameLower)";
            cmd.Parameters.Add("@myCharacterNameLower", SqliteType.Text).Value = myCharacterName.ToLower();
            cmd.Parameters.Add("@interlocutorCharacterNameLower", SqliteType.Text).Value = interlocutorCharacterName.ToLower();

            await using var dr = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await dr.ReadAsync(cancellationToken))
            {
                var speakingCharacterName = Convert.ToString(dr["speakingcharactername"])!;
                var messageType = Convert.ToInt32(dr["messagetype"]);
                var messageText = Convert.ToString(dr["messagetext"])!;
                var timestampUnixMS = Convert.ToInt64(dr["timestamp"]);
                var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampUnixMS).UtcDateTime;
                var speakerGenderId = _channelMessagesHaveGender
                    ? (int?)Convert.ToInt32(dr["genderid"])
                    : null;
                var speakerOnlineStatusId = _channelMessagesHaveGender
                    ? (int?)Convert.ToInt32(dr["onlinestatusid"])
                    : null;

                yield return new LogMessageInfo(
                    SpeakingCharacterName: speakingCharacterName,
                    MessageType: messageType,
                    MessageText: messageText,
                    Timestamp: timestamp,
                    SpeakerGenderId: speakerGenderId,
                    SpeakerOnlineStatusId: speakerOnlineStatusId);
            }
        }
    }

    internal class CombinedTableLogFileVersionedReader : ILogFileVersionedReader
    {
        private readonly SqliteConnection _cnn;

        public CombinedTableLogFileVersionedReader(
            SqliteConnection cnn)
        {
            _cnn = cnn;
        }

        public async IAsyncEnumerable<LogCharacterInfo> EnumerateCharactersAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await using var cmd = _cnn.CreateCommand();
            cmd.CommandText = "SELECT name FROM character";

            await using var dr = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await dr.ReadAsync(cancellationToken))
            {
                var name = Convert.ToString(dr["name"])!;

                yield return new LogCharacterInfo(
                    Name: name);
            }
        }

        public async IAsyncEnumerable<LogChannelInfo> EnumerateChannelsAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await using var cmd = _cnn.CreateCommand();
            cmd.CommandText = @"
                SELECT c.name, c.title 
                FROM channel c
                WHERE c.channeltype = 'C'";

            await using var dr = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await dr.ReadAsync(cancellationToken))
            {
                var name = Convert.ToString(dr["name"])!;
                var title = Convert.ToString(dr["title"])!;

                yield return new LogChannelInfo(name, title);
            }
        }

        public async IAsyncEnumerable<LogPMConvoInfo> EnumeratePMConvosAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await using var cmd = _cnn.CreateCommand();
            cmd.CommandText = @"
                SELECT cme.name as mycharactername, cthem.name as interlocutorcharactername
                FROM channel c
                INNER JOIN character cme ON cme.id = c.mycharacterid
                INNER JOIN character cthem ON cthem.id = c.interlocutorcharacterid
                WHERE c.channeltype = 'P'";

            await using var dr = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await dr.ReadAsync(cancellationToken))
            {
                var myCharacterName = Convert.ToString(dr["mycharactername"])!;
                var interlocutorCharacterName = Convert.ToString(dr["interlocutorcharactername"])!;

                yield return new LogPMConvoInfo(
                    MyCharacterName: myCharacterName,
                    InterlocutorCharacterName: interlocutorCharacterName);
            }
        }

        public async Task<int> CountChannelMessagesAsync(string channelName, CancellationToken cancellationToken)
        {
            await using var cmd = _cnn.CreateCommand();
            cmd.CommandText = $@"
                SELECT COUNT(1)
                FROM channelmessage cm
                WHERE cm.channelid = (SELECT id FROM channel c WHERE c.channeltype = 'C' AND c.name = @channelName)
                    AND cm.messagetype <> 1";
            cmd.Parameters.Add("@channelName", SqliteType.Text).Value = channelName;
            var resultObj = await cmd.ExecuteScalarAsync(cancellationToken);
            return Convert.ToInt32(resultObj);
        }

        public async Task<int> CountPMConvoMessagesAsync(
            string myCharacterName, string interlocutorCharacterName, CancellationToken cancellationToken)
        {
            int channelId;
            {
                await using var cmd = _cnn.CreateCommand();
                cmd.CommandText = @"
                    SELECT c.id
                    FROM channel c
                    INNER JOIN character cme ON cme.id = c.mycharacterid
                    INNER JOIN character cthem ON cthem.id = c.interlocutorcharacterid
                    WHERE c.channeltype = 'P'
                        AND cme.namelower = @myCharacterNameLower
                        AND cthem.namelower = @interlocutorCharacterNameLower";
                cmd.Parameters.Add("@myCharacterNameLower", SqliteType.Text).Value = myCharacterName.ToLower();
                cmd.Parameters.Add("@interlocutorCharacterNameLower", SqliteType.Text).Value = interlocutorCharacterName.ToLower();

                var channelIdObj = await cmd.ExecuteScalarAsync(cancellationToken);
                if (channelIdObj is null || channelIdObj is DBNull) { throw new InvalidOperationException("can't find PM Convo"); }
                channelId = Convert.ToInt32(channelIdObj);
            }
            {
                await using var cmd = _cnn.CreateCommand();
                cmd.CommandText = $@"
                    SELECT COUNT(1)
                    FROM channelmessage cm
                    WHERE cm.channelid = @channelId
                        AND cm.messagetype <> 1";
                cmd.Parameters.Add("@channelId", SqliteType.Integer).Value = channelId;
                var resultObj = await cmd.ExecuteScalarAsync(cancellationToken);
                return Convert.ToInt32(resultObj);
            }
        }

        public async IAsyncEnumerable<LogMessageInfo> EnumerateChannelMessagesAsync(
            string channelName,
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await using var cmd = _cnn.CreateCommand();
            cmd.CommandText = $@"
                SELECT cspeaker.name as speakingcharactername, cm.messagetype, s.value as messagetext, 
                    cm.timestamp, cm.genderid, cm.onlinestatusid
                FROM channelmessage cm
                INNER JOIN character cspeaker ON cspeaker.id = cm.speakingcharacterid
                INNER JOIN strings s ON s.id = cm.textstringid
                WHERE cm.channelid = (SELECT id FROM channel c WHERE c.channeltype = 'C' AND c.name = @channelName)
                    AND cm.messagetype <> 1";
            cmd.Parameters.Add("@channelName", SqliteType.Text).Value = channelName;

            await using var dr = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await dr.ReadAsync(cancellationToken))
            {
                var speakingCharacterName = Convert.ToString(dr["speakingcharactername"])!;
                var messageType = Convert.ToInt32(dr["messagetype"]);
                var messageText = Convert.ToString(dr["messagetext"])!;
                var timestampUnixMS = Convert.ToInt64(dr["timestamp"]);
                var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampUnixMS).UtcDateTime;
                var speakerGenderId = Convert.ToInt32(dr["genderid"]);
                var speakerOnlineStatusId = Convert.ToInt32(dr["onlinestatusid"]);

                yield return new LogMessageInfo(
                    SpeakingCharacterName: speakingCharacterName,
                    MessageType: messageType,
                    MessageText: messageText,
                    Timestamp: timestamp,
                    SpeakerGenderId: speakerGenderId,
                    SpeakerOnlineStatusId: speakerOnlineStatusId);
            }
        }

        public async IAsyncEnumerable<LogMessageInfo> EnumeratePMConvoMessagesAsync(
            string myCharacterName, 
            string interlocutorCharacterName, 
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            int channelId;
            {
                await using var cmd = _cnn.CreateCommand();
                cmd.CommandText = @"
                    SELECT c.id
                    FROM channel c
                    INNER JOIN character cme ON cme.id = c.mycharacterid
                    INNER JOIN character cthem ON cthem.id = c.interlocutorcharacterid
                    WHERE c.channeltype = 'P'
                        AND cme.namelower = @myCharacterNameLower
                        AND cthem.namelower = @interlocutorCharacterNameLower";
                cmd.Parameters.Add("@myCharacterNameLower", SqliteType.Text).Value = myCharacterName.ToLower();
                cmd.Parameters.Add("@interlocutorCharacterNameLower", SqliteType.Text).Value = interlocutorCharacterName.ToLower();

                var channelIdObj = await cmd.ExecuteScalarAsync(cancellationToken);
                if (channelIdObj is null || channelIdObj is DBNull) { throw new InvalidOperationException("can't find PM Convo"); }
                channelId = Convert.ToInt32(channelIdObj);
            }
            {
                await using var cmd = _cnn.CreateCommand();
                cmd.CommandText = $@"
                    SELECT cspeaker.name as speakingcharactername, cm.messagetype, s.value as messagetext, 
                        cm.timestamp, cm.genderid, cm.onlinestatusid
                    FROM channelmessage cm
                    INNER JOIN character cspeaker ON cspeaker.id = cm.speakingcharacterid
                    INNER JOIN strings s ON s.id = cm.textstringid
                    WHERE cm.channelid = @channelId
                        AND cm.messagetype <> 1";
                cmd.Parameters.Add("@channelId", SqliteType.Integer).Value = channelId;

                await using var dr = await cmd.ExecuteReaderAsync(cancellationToken);
                while (await dr.ReadAsync(cancellationToken))
                {
                    var speakingCharacterName = Convert.ToString(dr["speakingcharactername"])!;
                    var messageType = Convert.ToInt32(dr["messagetype"]);
                    var messageText = Convert.ToString(dr["messagetext"])!;
                    var timestampUnixMS = Convert.ToInt64(dr["timestamp"]);
                    var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampUnixMS).UtcDateTime;
                    var speakerGenderId = Convert.ToInt32(dr["genderid"]);
                    var speakerOnlineStatusId = Convert.ToInt32(dr["onlinestatusid"]);

                    yield return new LogMessageInfo(
                        SpeakingCharacterName: speakingCharacterName,
                        MessageType: messageType,
                        MessageText: messageText,
                        Timestamp: timestamp,
                        SpeakerGenderId: speakerGenderId,
                        SpeakerOnlineStatusId: speakerOnlineStatusId);
                }
            }
        }
    }
}
