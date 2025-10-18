using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common.DbSchema;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.ChatLogging.Sqlite.Migrations;
using XarChat.Backend.Features.StartupTasks;

namespace XarChat.Backend.Features.ChatLogging.Sqlite
{
    public class SqliteChatLogWriter : IChatLogWriter, IDisposable
    {
        private readonly IAppConfiguration _appConfiguration;

        private readonly SemaphoreSlim _sem = new SemaphoreSlim(1);
        private Microsoft.Data.Sqlite.SqliteConnection? _cnn;

        private bool _disposed = false;
        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();

        public SqliteChatLogWriter(
            IAppDataFolder appDataFolder,
            IAppConfiguration appConfiguration)
        {
            _appConfiguration = appConfiguration;

            var adf = appDataFolder.GetAppDataFolder();
            var fn = Path.Combine(adf, "chatlog.db");
            VerifySchema(fn);
        }

        private void VerifySchema(string fn)
        {
            _sem.Wait();
            Task.Run(async () =>
            {
                try
                {
                    StartupTask.UpdateStatus(false, "Migrating chat log format...", null);

                    _cnn = await DbSchemaManager.VerifySchemaAsync(fn, false,
                        [
                            new Migration01Initial(),
                            new Migration02AddSchemaVersionTable(),
                            new Migration03AddGenderStatusToMessageLog(),
                            new Migration04AddGenderStatusToPMLog(),
                            new Migration05MovePMConvosToChannels(),
                        ],
                        _disposeCTS.Token);

                    StartupTask.UpdateStatus(true, "Chat log is ready.", null);
                }
                catch (Exception ex)
                {
                    StartupTask.UpdateStatus(false, "Chat log migration failed.", ex);

                    try { _cnn?.Close(); }
                    catch { }
                }
                finally
                {
                    _sem.Release();
                }
            });
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _disposed = true;
                _disposeCTS.Cancel();

                _sem.Wait();
                try
                {
                    _cnn?.Close();
                }
                finally
                {
                    _sem.Release();
                }
            }
        }

        public StartupTask StartupTask { get; } = new StartupTask("Initializing chat log...");

        private void ThrowIfDisposed()
        {
            if (_disposed)
            {
                throw new ObjectDisposedException(GetType().FullName);
            }
        }

        internal async Task<T> WithSemaphore<T>(
            Func<SqliteConnection, CancellationToken, Task<T>> func,
            CancellationToken cancellationToken)
        {
            ThrowIfDisposed();

            await _sem.WaitAsync(cancellationToken);
            try
            {
                ThrowIfDisposed();
                var result = await func(_cnn!, cancellationToken);
                return result;
            }
            finally
            {
                _sem.Release();
            }
        }

        private async Task<long> GetCharacterIdAsync(
            SqliteConnection connection, SqliteTransaction xa, string name, CancellationToken cancellationToken)
        {
            using (var cmd = connection.CreateCommand())
            {
                cmd.Transaction = xa;
                cmd.CommandText = @"select id from character where namelower = @name";
                cmd.Parameters.Add("@name", Microsoft.Data.Sqlite.SqliteType.Text).Value = name.ToLower();
                var existingCharacterId = await cmd.ExecuteScalarAsync(cancellationToken);

                if (existingCharacterId == null || existingCharacterId is DBNull)
                {
                    using var createCmd = connection.CreateCommand();
                    createCmd.Transaction = xa;
                    createCmd.CommandText = @"insert into character(name, namelower) values (@name, @namelower)";
                    createCmd.Parameters.Add("@name", Microsoft.Data.Sqlite.SqliteType.Text).Value = name;
                    createCmd.Parameters.Add("@namelower", Microsoft.Data.Sqlite.SqliteType.Text).Value = name.ToLower();
                    await createCmd.ExecuteNonQueryAsync(cancellationToken);

                    existingCharacterId = await cmd.ExecuteScalarAsync(cancellationToken);
                }

                return Convert.ToInt64(existingCharacterId);
            }
        }

        private async Task<long> GetStringIdAsync(
            SqliteConnection connection, SqliteTransaction xa, string text, CancellationToken cancellationToken)
        {
            var hashStr = Convert.ToBase64String(SHA256.Create().ComputeHash(System.Text.Encoding.UTF8.GetBytes(text)));

            using (var cmd = connection.CreateCommand())
            {
                cmd.Transaction = xa;
                cmd.CommandText = @"select id from strings where hash = @hash";
                cmd.Parameters.Add("@hash", Microsoft.Data.Sqlite.SqliteType.Text).Value = hashStr;
                var existingStringId = await cmd.ExecuteScalarAsync(cancellationToken);

                if (existingStringId == null || existingStringId is DBNull)
                {
                    using var createCmd = connection.CreateCommand();
                    createCmd.Transaction = xa;
                    createCmd.CommandText = @"insert into strings(value, hash) values (@value, @hash)";
                    createCmd.Parameters.Add("@value", Microsoft.Data.Sqlite.SqliteType.Text).Value = text;
                    createCmd.Parameters.Add("@hash", Microsoft.Data.Sqlite.SqliteType.Text).Value = hashStr;
                    await createCmd.ExecuteNonQueryAsync(cancellationToken);

                    existingStringId = await cmd.ExecuteScalarAsync(cancellationToken);
                }

                return Convert.ToInt64(existingStringId);
            }
        }

        private async Task<long> GetChannelIdForChannelAsync(
            SqliteConnection connection, SqliteTransaction xa, 
            string channelName, string channelTitle, CancellationToken cancellationToken)
        {
            using (var cmd = connection.CreateCommand())
            {
                cmd.Transaction = xa;
                cmd.CommandText = @"select id from channel where channeltype = 'C' and name = @name";
                cmd.Parameters.Add("@name", Microsoft.Data.Sqlite.SqliteType.Text).Value = channelName;
                var existingChannelId = await cmd.ExecuteScalarAsync(cancellationToken);

                if (existingChannelId == null || existingChannelId is DBNull)
                {
                    using var createCmd = connection.CreateCommand();
                    createCmd.Transaction = xa;
                    createCmd.CommandText = @"insert into channel(channeltype, name, title) values ('C', @name, @title)";
                    createCmd.Parameters.Add("@name", Microsoft.Data.Sqlite.SqliteType.Text).Value = channelName;
                    createCmd.Parameters.Add("@title", Microsoft.Data.Sqlite.SqliteType.Text).Value = channelTitle;
                    await createCmd.ExecuteNonQueryAsync(cancellationToken);

                    existingChannelId = await cmd.ExecuteScalarAsync(cancellationToken);
                }

                return Convert.ToInt64(existingChannelId);
            }
        }

        private async Task<long> GetChannelIdForPMConvoAsync(
            SqliteConnection connection, SqliteTransaction xa,
            long myCharacterId, long interlocutorCharacterId, CancellationToken cancellationToken)
        {
            using (var cmd = connection.CreateCommand())
            {
                cmd.Transaction = xa;
                cmd.CommandText = @"select id from channel where channeltype = 'P' 
                    and mycharacterid = @mycharacterid and interlocutorcharacterid = @interlocutorcharacterid";
                cmd.Parameters.Add("@mycharacterid", Microsoft.Data.Sqlite.SqliteType.Integer).Value = myCharacterId;
                cmd.Parameters.Add("@interlocutorcharacterid", Microsoft.Data.Sqlite.SqliteType.Integer).Value = interlocutorCharacterId;
                var existingChannelId = await cmd.ExecuteScalarAsync(cancellationToken);

                if (existingChannelId == null || existingChannelId is DBNull)
                {
                    using var createCmd = connection.CreateCommand();
                    createCmd.Transaction = xa;
                    createCmd.CommandText = @"insert into channel(channeltype, mycharacterid, interlocutorcharacterid)
                        values ('P', @mycharacterid, @interlocutorcharacterid)";
                    createCmd.Parameters.Add("@mycharacterid", Microsoft.Data.Sqlite.SqliteType.Text).Value = myCharacterId;
                    createCmd.Parameters.Add("@interlocutorcharacterid", Microsoft.Data.Sqlite.SqliteType.Text).Value = interlocutorCharacterId;
                    await createCmd.ExecuteNonQueryAsync(cancellationToken);

                    existingChannelId = await cmd.ExecuteScalarAsync(cancellationToken);
                }

                return Convert.ToInt64(existingChannelId);
            }
        }

        private Dictionary<string, Queue<byte[]>> _seenMessageHashes = new Dictionary<string, Queue<byte[]>>();

        private byte[] GetMessageHash(string channelName, string speakerName, int messageType, string messageText)
        {
            var hashBytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(
                $"{channelName}:{speakerName}:{messageType}:{messageText}"));
            return hashBytes;
        }

        private bool AreEqual(byte[] a, byte[] b)
        {
            if (a.Length != b.Length) return false;
            for (var i = 0; i < a.Length; i++)
            {
                if (a[i] != b[i]) return false;
            }
            return true;
        }

        private bool IsDuplicateMessage(string myCharacterName, byte[] messageHash)
        {
            foreach (var kvp in _seenMessageHashes.Where(kvp => kvp.Key != myCharacterName))
            {
                foreach (var xhash in kvp.Value)
                {
                    if (AreEqual(messageHash, xhash))
                    {
                        return true;
                    }
                }
            }
            if (!_seenMessageHashes.TryGetValue(myCharacterName, out var hashQueue))
            {
                hashQueue = new Queue<byte[]>();
                _seenMessageHashes[myCharacterName] = hashQueue;
            }
            hashQueue.Enqueue(messageHash);
            while (hashQueue.Count > 30)
            {
                hashQueue.Dequeue();
            }
            return false;
        }
        
        public async Task<List<string>> GetChannelHintsFromPartialNameAsync(string partialChannelName,
            CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public async Task<List<string>> GetPMConvoHintsFromPartialNameAsync(string myCharacterName, string partialInterlocutorName,
            CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public async Task<bool> ValidateChannelInLogsAsync(string channelName, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public async Task<bool> ValidatePMConvoInLogsAsync(
            string myCharacterName, string interlocutorName, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public async Task LogChannelMessageAsync(
            string myCharacterName,
            string channelName, string channelTitle, 
            string speakerName, int speakerGender, int speakerStatus,
            int messageType, string messageText,
            CancellationToken cancellationToken)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            var result = await WithSemaphore(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    var msgHash = GetMessageHash(channelName, speakerName, messageType, messageText);
                    if (IsDuplicateMessage(myCharacterName, msgHash))
                    {
                        return 0;
                    }

                    using var xa = connection.BeginTransaction();

                    var channelId = await GetChannelIdForChannelAsync(connection, xa, channelName, channelTitle, cancellationToken);
                    var speakingCharacterId = await GetCharacterIdAsync(connection, xa, speakerName, cancellationToken);
                    var stringId = await GetStringIdAsync(connection, xa, messageText, cancellationToken);

                    using (var insertCmd = connection.CreateCommand())
                    {
                        insertCmd.Transaction = xa;
                        insertCmd.CommandText = @"
                        insert into channelmessage(channelid, speakingcharacterid, messagetype, textstringid, timestamp,
                            genderid, onlinestatusid)
                        values(@channelid, @speakingcharacterid, @messagetype, @textstringid, @timestamp,
                            @genderid, @onlinestatusid)
                    ";
                        insertCmd.Parameters.Add("@channelid", SqliteType.Integer).Value = channelId;
                        insertCmd.Parameters.Add("@speakingcharacterid", SqliteType.Integer).Value = speakingCharacterId;
                        insertCmd.Parameters.Add("@messagetype", SqliteType.Integer).Value = messageType;
                        insertCmd.Parameters.Add("@textstringid", SqliteType.Integer).Value = stringId;
                        insertCmd.Parameters.Add("@timestamp", SqliteType.Integer).Value = now;
                        insertCmd.Parameters.Add("@genderid", SqliteType.Integer).Value = speakerGender;
                        insertCmd.Parameters.Add("@onlinestatusid", SqliteType.Integer).Value = speakerStatus;
                        await insertCmd.ExecuteNonQueryAsync(cancellationToken);
                    }

                    xa.Commit();
                    return 0;
                });
        }

        public async Task LogPMConvoMessageAsync(
            string myCharacterName,
            string interlocutorName,
            string speakerName, int speakerGender, int speakerStatus,
            int messageType, string messageText,
            CancellationToken cancellationToken)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            var result = await WithSemaphore(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    using var xa = connection.BeginTransaction();

                    var myCharacterId = await GetCharacterIdAsync(connection, xa, myCharacterName, cancellationToken);
                    var interlocutorCharacterId = await GetCharacterIdAsync(connection, xa, interlocutorName, cancellationToken);
                    var speakingCharacterId = interlocutorName == speakerName
                        ? interlocutorCharacterId
                        : (myCharacterName == speakerName
                            ? myCharacterId
                            : await GetCharacterIdAsync(connection, xa, speakerName, cancellationToken));
                    var channelId = await GetChannelIdForPMConvoAsync(connection, xa, myCharacterId, interlocutorCharacterId, cancellationToken);
                    var stringId = await GetStringIdAsync(connection, xa, messageText, cancellationToken);

                    using (var insertCmd = connection.CreateCommand())
                    {
                        insertCmd.Transaction = xa;
                        insertCmd.CommandText = @"
                        insert into channelmessage(channelid, speakingcharacterid,
                            messagetype, textstringid, timestamp, genderid, onlinestatusid)
                        values(@channelid, @speakingcharacterid,
                            @messagetype, @textstringid, @timestamp, @genderid, @onlinestatusid)
                    ";
                        insertCmd.Parameters.Add("@channelid", SqliteType.Integer).Value = channelId;
                        insertCmd.Parameters.Add("@speakingcharacterid", SqliteType.Integer).Value = speakingCharacterId;
                        insertCmd.Parameters.Add("@messagetype", SqliteType.Integer).Value = messageType;
                        insertCmd.Parameters.Add("@textstringid", SqliteType.Integer).Value = stringId;
                        insertCmd.Parameters.Add("@timestamp", SqliteType.Integer).Value = now;
                        insertCmd.Parameters.Add("@genderid", SqliteType.Integer).Value = speakerGender;
                        insertCmd.Parameters.Add("@onlinestatusid", SqliteType.Integer).Value = speakerStatus;
                        await insertCmd.ExecuteNonQueryAsync(cancellationToken);
                    }

                    xa.Commit();
                    return 0;
                });
        }

        public void EndLogSource(string myCharacterName)
        {
            _sem.Wait();
            try
            {
                _seenMessageHashes.Remove(myCharacterName);
            }
            finally
            {
                _sem.Release();
            }
        }

        public async Task<List<LoggedChannelMessageInfo>> GetChannelMessagesAsync(
            string channelName,
            DateAnchor dateAnchor, DateTime date,
            int maxEntries,
            CancellationToken cancellationToken)
        {
            var result = await WithSemaphore(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    using var xa = connection.BeginTransaction();

                    var channelId = await GetChannelIdForChannelAsync(connection, xa, channelName, channelName, cancellationToken);

                    using (var queryCmd = connection.CreateCommand())
                    {
                        string dateWhere;
                        switch (dateAnchor)
                        {
                            default:
                            case DateAnchor.Before:
                                dateWhere = "timestamp < @date";
                                break;
                            case DateAnchor.After:
                                dateWhere = "timestamp >= @date";
                                break;
                        }

                        queryCmd.CommandText = $@"
                        select ch.name as channelname, ch.title as channeltitle,
                               spc.name as speakingcharactername, 
                               pcm.messagetype, s.value as textstring, pcm.timestamp,
                               pcm.genderid, pcm.onlinestatusid
                        from channelmessage pcm
                        inner join channel ch on ch.id = pcm.channelid
                        inner join character spc on spc.id = pcm.speakingcharacterid
                        inner join strings s on s.id = pcm.textstringid
                        where pcm.channelid = @channelid and {dateWhere}
                        order by timestamp desc
                        limit {maxEntries}
                    ";
                        queryCmd.Parameters.Add("@channelid", SqliteType.Integer).Value = channelId;
                        queryCmd.Parameters.Add("@date", SqliteType.Integer).Value = new DateTimeOffset(date, TimeSpan.Zero).ToUnixTimeMilliseconds();
                        using (var dr = await queryCmd.ExecuteReaderAsync(cancellationToken))
                        {
                            var result = new List<LoggedChannelMessageInfo>();
                            while (await dr.ReadAsync(cancellationToken))
                            {
                                var vChannelName = Convert.ToString(dr["channelname"]);
                                var vChannelTitle = Convert.ToString(dr["channeltitle"]);
                                var vSpeakingCharacterName = Convert.ToString(dr["speakingcharactername"]);
                                var vMessageType = Convert.ToInt32(dr["messagetype"]);
                                var vTextString = Convert.ToString(dr["textstring"]);
                                var vTimestamp = Convert.ToInt64(dr["timestamp"]);
                                var vGenderId = Convert.ToInt32(dr["genderid"]);
                                var vOnlineStatusId = Convert.ToInt32(dr["onlinestatusid"]);
                                var lcmi = new LoggedChannelMessageInfo()
                                {
                                    ChannelName = vChannelName!,
                                    ChannelTitle = vChannelTitle!,
                                    SpeakerName = vSpeakingCharacterName!,
                                    MessageType = vMessageType,
                                    MessageText = vTextString!,
                                    Timestamp = vTimestamp,
                                    CharacterGender = vGenderId,
                                    CharacterStatus = vOnlineStatusId,
                                };
                                result.Add(lcmi);
                            }
                            return result;
                        }
                    }
                });

            return result;
        }

        public async Task<List<LoggedPMConvoMessageInfo>> GetPMConvoMessagesAsync(
            string myCharacterName,
            string interlocutorName,
            DateAnchor dateAnchor, DateTime date,
            int maxEntries,
            CancellationToken cancellationToken)
        {
            var result = await WithSemaphore(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    using var xa = connection.BeginTransaction();

                    var myCharacterId = await GetCharacterIdAsync(connection, xa, myCharacterName, cancellationToken);
                    var interlocutorCharacterId = await GetCharacterIdAsync(connection, xa, interlocutorName, cancellationToken);
                    var channelId = await GetChannelIdForPMConvoAsync(connection, xa, myCharacterId, interlocutorCharacterId, cancellationToken);

                    using (var queryCmd = connection.CreateCommand())
                    {
                        string dateWhere;
                        switch (dateAnchor)
                        {
                            default:
                            case DateAnchor.Before:
                                dateWhere = "timestamp < @date";
                                break;
                            case DateAnchor.After:
                                dateWhere = "timestamp >= @date";
                                break;
                        }

                        queryCmd.CommandText = $@"
                        select myc.name as mycharactername, icc.name as interlocutorcharactername,
                               spc.name as speakingcharactername, 
                               pcm.messagetype, s.value as textstring, pcm.timestamp,
                               pcm.genderid, pcm.onlinestatusid
                        from channelmessage pcm
                        inner join channel c on c.id = pcm.channelid
                        inner join character myc on myc.id = c.mycharacterid
                        inner join character icc on icc.id = c.interlocutorcharacterid
                        inner join character spc on spc.id = pcm.speakingcharacterid
                        inner join strings s on s.id = pcm.textstringid
                        where channelid = @channelid
                                    and {dateWhere}
                        order by timestamp desc
                        limit {maxEntries}
                    ";
                        queryCmd.Parameters.Add("@channelid", SqliteType.Integer).Value = channelId;
                        queryCmd.Parameters.Add("@date", SqliteType.Integer).Value = new DateTimeOffset(date, TimeSpan.Zero).ToUnixTimeMilliseconds();
                        using (var dr = await queryCmd.ExecuteReaderAsync(cancellationToken))
                        {
                            var result = new List<LoggedPMConvoMessageInfo>();
                            while (await dr.ReadAsync(cancellationToken))
                            {
                                var vMyCharacterName = Convert.ToString(dr["mycharactername"]);
                                var vInterlocutorCharacterName = Convert.ToString(dr["interlocutorcharactername"]);
                                var vSpeakingCharacterName = Convert.ToString(dr["speakingcharactername"]);
                                var vMessageType = Convert.ToInt32(dr["messagetype"]);
                                var vTextString = Convert.ToString(dr["textstring"]);
                                var vTimestamp = Convert.ToInt64(dr["timestamp"]);
                                var vGenderId = Convert.ToInt32(dr["genderid"]);
                                var vOnlineStatusId = Convert.ToInt32(dr["onlinestatusid"]);
                                var lcmi = new LoggedPMConvoMessageInfo()
                                {
                                    MyCharacterName = vMyCharacterName!,
                                    InterlocutorName = vInterlocutorCharacterName!,
                                    SpeakerName = vSpeakingCharacterName!,
                                    MessageType = vMessageType,
                                    MessageText = vTextString!,
                                    Timestamp = vTimestamp,
                                    CharacterGender = vGenderId,
                                    CharacterStatus = vOnlineStatusId,
                                };
                                result.Add(lcmi);
                            }
                            return result;
                        }
                    }
                });
            return result;
        }

        private record struct ChannelInfo(long Id, string Name, string Title);
        private record struct PMConvoInfo(
            long MyCharacterId, string MyCharacterName, 
            long InterlocutorCharacterId, string InterlocutorCharacterName);

        private async IAsyncEnumerable<ChannelInfo> EnumerateChannelsAsync(
            SqliteConnection connection, SqliteTransaction xa, [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            using (var qCmd = connection.CreateCommand())
            {
                qCmd.Transaction = xa;
                qCmd.CommandText = @"
                    select id, name, title
                    from channel c
";
                await using var dr = await qCmd.ExecuteReaderAsync(cancellationToken);
                while (await dr.ReadAsync(cancellationToken))
                {
                    var id = Convert.ToInt64(dr["id"]);
                    var chanName = Convert.ToString(dr["name"]) ?? "";
                    var chanTitle = Convert.ToString(dr["title"]) ?? "";
                    yield return new ChannelInfo(id, chanName, chanTitle);
                }
            }
        }

        private async IAsyncEnumerable<PMConvoInfo> EnumeratePMConvosAsync(
            SqliteConnection connection, SqliteTransaction xa, [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            using (var qCmd = connection.CreateCommand())
            {
                qCmd.Transaction = xa;
                qCmd.CommandText = @"
                    select distinct mycharacterid, interlocutorcharacterid,
                        c1.name as mycharactername, c2.name as interlocutorcharactername
                    from pmconvomessage pmm
                    inner join character c1 on c1.id = pmm.mycharacterid
                    inner join character c2 on c2.id = pmm.interlocutorcharacterid
                ";
                await using var dr = await qCmd.ExecuteReaderAsync(cancellationToken);
                while (await dr.ReadAsync(cancellationToken))
                {
                    var myCharacterId = Convert.ToInt64(dr["mycharacterid"]);
                    var interlocutorCharacterId = Convert.ToInt64(dr["interlocutorcharacterid"]);
                    var myCharacterName = Convert.ToString(dr["mycharactername"]) ?? "";
                    var interlocutorCharacterName = Convert.ToString(dr["interlocutorcharactername"]) ?? "";
                    
                    yield return new PMConvoInfo(myCharacterId, myCharacterName, interlocutorCharacterId, interlocutorCharacterName);
                }
            }
        }

        private async Task<int> PerformExpirationPMConvoAsync(
            SqliteConnection connection, SqliteTransaction xa,
            PMConvoInfo pmConvoInfo,
            CancellationToken cancellationToken)
        {
            var retentionDays =
                (int?)_appConfiguration.GetArbitraryValue($"character.{pmConvoInfo.MyCharacterName.ToLower()}.pm.{pmConvoInfo.InterlocutorCharacterName.ToLower()}.logging.retentionDays")
                ?? (int?)_appConfiguration.GetArbitraryValue($"character.{pmConvoInfo.MyCharacterName.ToLower()}.any.logging.defaultPmConvoRretentionDays")
                ?? (int?)_appConfiguration.GetArbitraryValue("global.logging.defaultPmConvoRretentionDays");

            if (retentionDays is not null && retentionDays > 0)
            {
                var expireBeforeDate = DateTimeOffset.UtcNow - TimeSpan.FromDays(retentionDays.Value);

                using (var purgeCmd = connection.CreateCommand())
                {
                    purgeCmd.Transaction = xa;
                    purgeCmd.CommandText = @"
                        delete from pmconvomessage
                        where mycharacterid = @mycharacterid 
                            and interlocutorcharacterid = @interlocutorcharacterid 
                            and timestamp < @expirebefore
                    ";
                    purgeCmd.Parameters.Add("@mycharacterid", SqliteType.Integer).Value = pmConvoInfo.MyCharacterId;
                    purgeCmd.Parameters.Add("@interlocutorcharacterid", SqliteType.Integer).Value = pmConvoInfo.InterlocutorCharacterId;
                    purgeCmd.Parameters.Add("@expirebefore", SqliteType.Integer).Value = expireBeforeDate.ToUnixTimeMilliseconds();
                    var rowsPurged = await purgeCmd.ExecuteNonQueryAsync(cancellationToken);
                    return rowsPurged;
                }
            }
            else
            {
                return 0;
            }
        }

        private async Task<int> PerformExpirationChannelAsync(
            SqliteConnection connection, SqliteTransaction xa, 
            ChannelInfo channelInfo,
            CancellationToken cancellationToken)
        {
            var retentionDays = 
                (int?)_appConfiguration.GetArbitraryValue($"global.logging.channel.{channelInfo.Name}.retentionDays")
                ?? (int?)_appConfiguration.GetArbitraryValue("global.logging.defaultChannelRetentionDays");

            if (retentionDays is not null && retentionDays > 0)
            {
                var expireBeforeDate = DateTimeOffset.UtcNow - TimeSpan.FromDays(retentionDays.Value);

                using (var purgeCmd = connection.CreateCommand())
                {
                    purgeCmd.Transaction = xa;
                    purgeCmd.CommandText = @"
                        delete from channelmessage
                        where channelid = @channelid
                            and timestamp < @expirebefore
                    ";
                    purgeCmd.Parameters.Add("@channelid", SqliteType.Integer).Value = channelInfo.Id;
                    purgeCmd.Parameters.Add("@expirebefore", SqliteType.Integer).Value = expireBeforeDate.ToUnixTimeMilliseconds();
                    var rowsPurged = await purgeCmd.ExecuteNonQueryAsync(cancellationToken);
                    return rowsPurged;
                }
            }
            else
            {
                return 0;
            }
        }

        public async Task PerformExpirationAsync(CancellationToken cancellationToken)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            var result = await WithSemaphore(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    using var xa = connection.BeginTransaction();

                    var channels = await EnumerateChannelsAsync(connection, xa, cancellationToken)
                        .ToListAsync(cancellationToken);

                    var totalRowsRemoved = 0;
                    foreach (var chan in channels)
                    {
                        totalRowsRemoved +=  await PerformExpirationChannelAsync(connection, xa, chan, cancellationToken);
                    }

                    var pmConvos = await EnumeratePMConvosAsync(connection, xa, cancellationToken)
                        .ToListAsync(cancellationToken);

                    foreach (var pmConvo in pmConvos)
                    {
                        totalRowsRemoved += await PerformExpirationPMConvoAsync(connection, xa,
                            pmConvo, cancellationToken);
                    }

                    //if (totalRowsRemoved > 0)
                    //{
                    using (var purgeStringsCmd = connection.CreateCommand())
                    {
                        purgeStringsCmd.Transaction = xa;
                        purgeStringsCmd.CommandText = @"
                            delete from strings
                            where id not in (
	                            select distinct cm.textstringid
	                            from channelmessage cm
	                            union
	                            select distinct pmm.textstringid
	                            from pmconvomessage pmm
                            )
                        ";
                        await purgeStringsCmd.ExecuteNonQueryAsync(cancellationToken);
                    }
                    //}

                    xa.Commit();
                    return 0;
                });
        }
    }
}
