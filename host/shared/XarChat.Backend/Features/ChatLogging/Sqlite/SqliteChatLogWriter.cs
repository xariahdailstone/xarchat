using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common.DbSchema;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.ChatLogging.Sqlite.Migrations;

namespace XarChat.Backend.Features.ChatLogging.Sqlite
{
    public class SqliteChatLogWriter : IChatLogWriter, IDisposable
    {
        private readonly SemaphoreSlim _sem = new SemaphoreSlim(1);
        private readonly Microsoft.Data.Sqlite.SqliteConnection _connection;

        public SqliteChatLogWriter(
            IAppDataFolder appDataFolder)
        {
            var adf = appDataFolder.GetAppDataFolder();
            var fn = Path.Combine(adf, "chatlog.db");

            _connection = DbSchemaManager.VerifySchemaAsync(fn, false,
                [
                    new Migration01Initial(),
                    new Migration02AddSchemaVersionTable(),
                    new Migration03AddGenderStatusToMessageLog(),
                    new Migration04AddGenderStatusToPMLog()
                ], 
                CancellationToken.None).GetAwaiter().GetResult();
        }

        public void Dispose()
        {
            _connection.Close();
        }

        private void ExecuteNonQuery(string sql, SqliteTransaction? xa = null)
        {
            using var cmd = _connection.CreateCommand();
            cmd.CommandText = sql;
            cmd.Transaction = xa;
            cmd.ExecuteNonQuery();
        }

        private object? ExecuteScalar(string sql)
        {
            using var cmd = _connection.CreateCommand();
            cmd.CommandText = sql;
            var result = cmd.ExecuteScalar();
            if (result is DBNull)
                return null;
            else
                return result;
        }


        private async Task<long> GetCharacterIdAsync(SqliteTransaction xa, string name, CancellationToken cancellationToken)
        {
            using (var cmd = _connection.CreateCommand())
            {
                cmd.Transaction = xa;
                cmd.CommandText = @"select id from character where namelower = @name";
                cmd.Parameters.Add("@name", Microsoft.Data.Sqlite.SqliteType.Text).Value = name.ToLower();
                var existingCharacterId = await cmd.ExecuteScalarAsync(cancellationToken);

                if (existingCharacterId == null || existingCharacterId is DBNull)
                {
                    using var createCmd = _connection.CreateCommand();
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

        private async Task<long> GetStringIdAsync(SqliteTransaction xa, string text, CancellationToken cancellationToken)
        {
            var hashStr = Convert.ToBase64String(SHA256.Create().ComputeHash(System.Text.Encoding.UTF8.GetBytes(text)));

            using (var cmd = _connection.CreateCommand())
            {
                cmd.Transaction = xa;
                cmd.CommandText = @"select id from strings where hash = @hash";
                cmd.Parameters.Add("@hash", Microsoft.Data.Sqlite.SqliteType.Text).Value = hashStr;
                var existingStringId = await cmd.ExecuteScalarAsync(cancellationToken);

                if (existingStringId == null || existingStringId is DBNull)
                {
                    using var createCmd = _connection.CreateCommand();
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

        private async Task<long> GetChannelIdAsync(SqliteTransaction xa, string channelName, string channelTitle, CancellationToken cancellationToken)
        {
            using (var cmd = _connection.CreateCommand())
            {
                cmd.Transaction = xa;
                cmd.CommandText = @"select id from channel where name = @name";
                cmd.Parameters.Add("@name", Microsoft.Data.Sqlite.SqliteType.Text).Value = channelName;
                var existingChannelId = await cmd.ExecuteScalarAsync(cancellationToken);

                if (existingChannelId == null || existingChannelId is DBNull)
                {
                    using var createCmd = _connection.CreateCommand();
                    createCmd.Transaction = xa;
                    createCmd.CommandText = @"insert into channel(name, title) values (@name, @title)";
                    createCmd.Parameters.Add("@name", Microsoft.Data.Sqlite.SqliteType.Text).Value = channelName;
                    createCmd.Parameters.Add("@title", Microsoft.Data.Sqlite.SqliteType.Text).Value = channelTitle;
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
            await _sem.WaitAsync(cancellationToken);
            try
            {
                var results = new List<string>();

                using (var cmd = _connection.CreateCommand())
                {
                    cmd.CommandText = @"select name from channel where name like @name order by name";
                    cmd.Parameters.Add("@name", Microsoft.Data.Sqlite.SqliteType.Text).Value = partialChannelName + "%";
                    await using (var dr = await cmd.ExecuteReaderAsync(cancellationToken))
                    {
                        while (await dr.ReadAsync(cancellationToken))
                        {
                            var tname = Convert.ToString(dr["name"])!;
                            results.Add(tname);
                        }
                    }
                }

                return results;
            }
            finally
            {
                _sem.Release();
            }
        }

        public async Task<List<string>> GetPMConvoHintsFromPartialNameAsync(string myCharacterName, string partialInterlocutorName,
            CancellationToken cancellationToken)
        {
            await _sem.WaitAsync(cancellationToken);
            try
            {
                var results = new List<string>();

                await using var xa = _connection.BeginTransaction();

                var myCharId = await this.GetCharacterIdAsync(xa, myCharacterName, cancellationToken);
                using (var cmd = _connection.CreateCommand())
                {
                    cmd.Transaction = xa;
                    cmd.CommandText = @"
                        select name 
                        from character c
                        where c.namelower like @namelower
                            and exists(select 1 from pmconvomessage pmc
                                where pmc.mycharacterid = @mycharacterid and pmc.interlocutorcharacterid = c.id)
                        order by c.namelower";
                    cmd.Parameters.Add("@namelower", Microsoft.Data.Sqlite.SqliteType.Text).Value = partialInterlocutorName.ToLower() + "%";
                    cmd.Parameters.Add("@mycharacterid", Microsoft.Data.Sqlite.SqliteType.Integer).Value = myCharId;
                    await using (var dr = await cmd.ExecuteReaderAsync(cancellationToken))
                    {
                        while (await dr.ReadAsync(cancellationToken))
                        {
                            var tname = Convert.ToString(dr["name"])!;
                            results.Add(tname);
                        }
                    }
                }

                return results;
            }
            finally
            {
                _sem.Release();
            }
        }

        public async Task<bool> ValidateChannelInLogsAsync(string channelName, CancellationToken cancellationToken)
        {
            await _sem.WaitAsync(cancellationToken);
            try
            {
                using (var cmd = _connection.CreateCommand())
                {
                    cmd.CommandText = @"select count(1) from channel where lower(name) = lower(@name)";
                    cmd.Parameters.Add("@name", Microsoft.Data.Sqlite.SqliteType.Text).Value = channelName;
                    var count = Convert.ToInt32(await cmd.ExecuteScalarAsync(cancellationToken));
                    return (count == 1);
                }
            }
            finally
            {
                _sem.Release();
            }
        }

        public async Task<bool> ValidatePMConvoInLogsAsync(
            string myCharacterName, string interlocutorName, CancellationToken cancellationToken)
        {
            await _sem.WaitAsync(cancellationToken);
            try
            {
                await using var xa = _connection.BeginTransaction();

                var myCharId = await this.GetCharacterIdAsync(xa, myCharacterName, cancellationToken);

                using (var cmd = _connection.CreateCommand())
                {
                    cmd.CommandText = @"
                        select count(1) 
                        from character c
                        where c.namelower = @namelower
                            and exists(select 1 from pmconvomessage pmc
                                where pmc.mycharacterid = @mycharacterid and pmc.interlocutorcharacterid = c.id)";
                    cmd.Parameters.Add("@namelower", Microsoft.Data.Sqlite.SqliteType.Text).Value = interlocutorName.ToLower();
                    cmd.Parameters.Add("@mycharacterid", Microsoft.Data.Sqlite.SqliteType.Integer).Value = myCharId;
                    var count = Convert.ToInt32(await cmd.ExecuteScalarAsync(cancellationToken));
                    return (count == 1);
                }
            }
            finally
            {
                _sem.Release();
            }
        }

        public async Task LogChannelMessageAsync(
            string myCharacterName,
            string channelName, string channelTitle, 
            string speakerName, int speakerGender, int speakerStatus,
            int messageType, string messageText,
            CancellationToken cancellationToken)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            await _sem.WaitAsync(cancellationToken);
            try
            {
                var msgHash = GetMessageHash(channelName, speakerName, messageType, messageText);
                if (IsDuplicateMessage(myCharacterName, msgHash))
                {
                    return;
                }

                using var xa = _connection.BeginTransaction();

                var channelId = await GetChannelIdAsync(xa, channelName, channelTitle, cancellationToken);
                var speakingCharacterId = await GetCharacterIdAsync(xa, speakerName, cancellationToken);
                var stringId = await GetStringIdAsync(xa, messageText, cancellationToken);

                using (var insertCmd = _connection.CreateCommand())
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
            }
            finally
            {
                _sem.Release();
            }
        }

        public async Task LogPMConvoMessageAsync(
            string myCharacterName,
            string interlocutorName,
            string speakerName, int speakerGender, int speakerStatus,
            int messageType, string messageText,
            CancellationToken cancellationToken)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            await _sem.WaitAsync(cancellationToken);
            try
            {
                using var xa = _connection.BeginTransaction();

                var myCharacterId = await GetCharacterIdAsync(xa, myCharacterName, cancellationToken);
                var interlocutorCharacterId = await GetCharacterIdAsync(xa, interlocutorName, cancellationToken);
                var speakingCharacterId = interlocutorName == speakerName
                    ? interlocutorCharacterId
                    : (myCharacterName == speakerName
                        ? myCharacterId
                        : await GetCharacterIdAsync(xa, speakerName, cancellationToken));
                var stringId = await GetStringIdAsync(xa, messageText, cancellationToken);

                using (var insertCmd = _connection.CreateCommand())
                {
                    insertCmd.Transaction = xa;
                    insertCmd.CommandText = @"
                        insert into pmconvomessage(mycharacterid, interlocutorcharacterid, speakingcharacterid,
                            messagetype, textstringid, timestamp, genderid, onlinestatusid)
                        values(@mycharacterid, @interlocutorcharacterid, @speakingcharacterid,
                            @messagetype, @textstringid, @timestamp, @genderid, @onlinestatusid)
                    ";
                    insertCmd.Parameters.Add("@mycharacterid", SqliteType.Integer).Value = myCharacterId;
                    insertCmd.Parameters.Add("@interlocutorcharacterid", SqliteType.Integer).Value = interlocutorCharacterId;
                    insertCmd.Parameters.Add("@speakingcharacterid", SqliteType.Integer).Value = speakingCharacterId;
                    insertCmd.Parameters.Add("@messagetype", SqliteType.Integer).Value = messageType;
                    insertCmd.Parameters.Add("@textstringid", SqliteType.Integer).Value = stringId;
                    insertCmd.Parameters.Add("@timestamp", SqliteType.Integer).Value = now;
                    insertCmd.Parameters.Add("@genderid", SqliteType.Integer).Value = speakerGender;
                    insertCmd.Parameters.Add("@onlinestatusid", SqliteType.Integer).Value = speakerStatus;
                    await insertCmd.ExecuteNonQueryAsync(cancellationToken);
                }

                xa.Commit();
            }
            finally
            {
                _sem.Release();
            }
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
            await _sem.WaitAsync(cancellationToken);
            try
            {
                using var xa = _connection.BeginTransaction();

                var channelId = await GetChannelIdAsync(xa, channelName, channelName, cancellationToken);

                using (var queryCmd = _connection.CreateCommand())
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
            }
            finally
            {
                _sem.Release();
            }
        }

        public async Task<List<LoggedPMConvoMessageInfo>> GetPMConvoMessagesAsync(
            string myCharacterName,
            string interlocutorName,
            DateAnchor dateAnchor, DateTime date,
            int maxEntries,
            CancellationToken cancellationToken)
        {
            await _sem.WaitAsync(cancellationToken);
            try
            {
                using var xa = _connection.BeginTransaction();

                var myCharacterId = await GetCharacterIdAsync(xa, myCharacterName, cancellationToken);
                var interlocutorCharacterId = await GetCharacterIdAsync(xa, interlocutorName, cancellationToken);

                using (var queryCmd = _connection.CreateCommand())
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
                        from pmconvomessage pcm
                        inner join character myc on myc.id = pcm.mycharacterid
                        inner join character icc on icc.id = pcm.interlocutorcharacterid
                        inner join character spc on spc.id = pcm.speakingcharacterid
                        inner join strings s on s.id = pcm.textstringid
                        where mycharacterid = @mycharacterid and interlocutorcharacterid = @interlocutorcharacterid
                                    and {dateWhere}
                        order by timestamp desc
                        limit {maxEntries}
                    ";
                    queryCmd.Parameters.Add("@mycharacterid", SqliteType.Integer).Value = myCharacterId;
                    queryCmd.Parameters.Add("@interlocutorcharacterid", SqliteType.Integer).Value = interlocutorCharacterId;
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
            }
            finally
            {
                _sem.Release();
            }
        }
    }
}
