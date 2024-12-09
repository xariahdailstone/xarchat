using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.ChatLogging.Sqlite.Migrations;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.File
{
    internal class SingleDbLogFile : IAsyncDisposable
    {
        public static async Task<SingleDbLogFile> CreateNewAsync(
            string myCharacterName, int year, int month, string filename, CancellationToken cancellationToken)
        {
            await using (var cnn = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={filename};Mode=ReadWriteCreate;Cache=Private;"))
            {
                await cnn.OpenAsync();
                await CheckForSchemaAsync(cnn, cancellationToken);
            }
            return new SingleDbLogFile(myCharacterName, year, month, filename);
        }

        public static async Task<SingleDbLogFile> OpenExistingAsync(
           string myCharacterName, int year, int month, string filename, CancellationToken cancellationToken)
        {
            await using (var cnn = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={filename};Mode=ReadWrite;Cache=Private;"))
            {
                await cnn.OpenAsync();
                await CheckForSchemaAsync(cnn, cancellationToken);
            }
            return new SingleDbLogFile(myCharacterName, year, month, filename);
        }

        private static async Task CheckForSchemaAsync(
            SqliteConnection cnn, CancellationToken cancellationToken)
        {
            var migrations = new IMigration[]
            {
                new Migration01Initial(),
                new Migration02AddSchemaVersionTable(),
                new Migration03AddGenderStatusToMessageLog(),
                new Migration04AddGenderStatusToPMLog()
            };

            foreach (var mig in migrations)
            {
                await mig.RunAsync(cnn, cancellationToken);
            }
        }

        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();

        private SingleDbLogFile(string myCharacterName, int year, int month, string filename)
        {
            this.MyCharacterName = myCharacterName;
            this.Year = year;
            this.Month = month;
            this.Filename = filename;
        }

        public ValueTask DisposeAsync()
        {
            if (!_disposeCTS.IsCancellationRequested)
            {
                _disposeCTS.Cancel();
            }

            return ValueTask.CompletedTask;
        }

        public string MyCharacterName { get; }

        public int Year { get; }

        public int Month { get; }

        public DateTime DataFrom => new DateTime(Year, Month, 1, 0, 0, 0);

        public DateTime DataTo
        {
            get
            {
                if (Month == 12)
                {
                    return new DateTime(Year + 1, 1, 1, 0, 0, 0) - TimeSpan.FromTicks(1);
                }
                else
                {
                    return new DateTime(Year, Month + 1, 1, 0, 0, 0) - TimeSpan.FromTicks(1);
                }
            }
        }

        public string Filename { get; }

        public async Task<List<string>> GetChannelHintsFromPartialNameAsync(string partialChannelName, CancellationToken cancellationToken)
        {
            // TODO:
        }

        public async Task<List<string>> GetPMConvoHintsFromPartialNameAsync(string myCharacterName, string partialInterlocutorName, CancellationToken cancellationToken)
        {
            // TODO:
        }

        public async Task<List<LoggedPMConvoMessageInfo>> GetPMConvoMessagesAsync(
            string myCharacterName, string interlocutorName,
            DateAnchor dateAnchor, DateTime date, int maxEntries, CancellationToken cancellationToken)
        {
            // TODO:
        }

        public async Task<List<LoggedChannelMessageInfo>> GetChannelMessagesAsync(string channelName, DateAnchor dateAnchor, DateTime date, int maxEntries, CancellationToken cancellationToken)
        {
            // TODO:
        }

        public async Task LogChannelMessageAsync(
            DateTime timestamp, string myCharacterName, string channelName, string channelTitle, string speakerName, int speakerGender, int speakerStatus, int messageType, string messageText, CancellationToken cancellationToken)
        {
            // TODO:
        }

        public Task LogPMConvoMessageAsync(
            DateTime timestamp, string myCharacterName, string interlocutorName, string speakerName, int speakerGender, int speakerStatus, int messageType, string messageText, CancellationToken cancellationToken)
        {
            // TODO:
        }

        public async Task<bool> ValidateChannelInLogsAsync(string channelName, CancellationToken cancellationToken)
        {
            // TODO:
        }

        public async Task<bool> ValidatePMConvoInLogsAsync(string myCharacterName, string interlocutorName, CancellationToken cancellationToken)
        {
            // TODO:
        }

        private class OpenDbConnection : IAsyncDisposable
        {
            private readonly SqliteConnection _connection;
            private readonly SemaphoreSlim _sem = new SemaphoreSlim(1);

            public OpenDbConnection(SqliteConnection connection)
            {
                _connection = connection;
            }

            public async ValueTask DisposeAsync()
            {
                await _connection.DisposeAsync();
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
        }
    }
}
