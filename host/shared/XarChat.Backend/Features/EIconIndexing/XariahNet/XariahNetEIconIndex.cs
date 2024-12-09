using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Hosting;
using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Diagnostics;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Transactions;
using XarChat.Backend.Common.DbSchema;
using XarChat.Backend.Features.AppDataFolder;
using XarChat.Backend.Features.EIconIndexing.XariahNet.Migrations;

namespace XarChat.Backend.Features.EIconIndexing.XariahNet
{
    internal class XariahNetEIconIndex : IEIconIndex
    {
        private readonly IAppDataFolder _appDataFolder;
        private readonly IHostApplicationLifetime _hostApplicationLifetime;

        private SqliteConnection? _sqliteConnection = null;
        private long? _lastUpdateAt = null;

        public XariahNetEIconIndex(
            IAppDataFolder appDataFolder,
            IHostApplicationLifetime hostApplicationLifetime)
        {
            _appDataFolder = appDataFolder;
            _hostApplicationLifetime = hostApplicationLifetime;
        }

        public async Task InitializeAsync(CancellationToken cancellationToken)
        {
            await GetIconSetAsync(cancellationToken);
        }

        private readonly SemaphoreSlim _getEIconInfoExtendedSem = new SemaphoreSlim(2);

        public async Task<IEIconInfoExtended?> GetEIconInfoExtendedAsync(string eiconName, CancellationToken cancellationToken)
        {
            await _getEIconInfoExtendedSem.WaitAsync(cancellationToken);
            try
            {
                using var rocnn = await CreateSqliteConnectionAsync(true, cancellationToken);
                using (var cmd = rocnn.CreateCommand())
                {
                    cmd.CommandText = @$"
                    SELECT lower(name) AS name, addedat, etag, contentlength
                    FROM eicon 
                    WHERE lower(name) = @name";
                    cmd.Parameters.Add("@name", SqliteType.Text).Value = eiconName.ToLower();

                    using (var reader = await cmd.ExecuteReaderAsync(cancellationToken))
                    {
                        while (await reader.ReadAsync(cancellationToken))
                        {
                            var name = Convert.ToString(reader["name"])!;
                            var addedAt = DateTimeOffset.FromUnixTimeMilliseconds(Convert.ToInt64(reader["addedat"])).UtcDateTime;
                            var etag = (reader["etag"] is not DBNull) ? Convert.ToString(reader["etag"])! : "";
                            var contentLength = (reader["contentlength"] is not DBNull) ? Convert.ToInt64(reader["contentlength"]) : 0;
                            return new EIconInfoExtended(name, addedAt, etag, contentLength);
                        }
                    }
                }

                return null;
            }
            finally
            {
                _getEIconInfoExtendedSem.Release();
            }
        }

        public async Task<IEIconSearchResults> SearchEIconsAsync(string searchTerm, CancellationToken cancellationToken)
        {
            var timings = new Dictionary<string, long>();

            Stopwatch sw = Stopwatch.StartNew();
            var curTiming = "";
            void startTiming(string name)
            {
                curTiming = name;
                sw.Restart();
            }
            void endTiming()
            {
                sw.Stop();
                if (curTiming != "")
                {
                    timings[curTiming] = sw.ElapsedMilliseconds;
                    curTiming = "";
                }
            }

            //startTiming("acquire sem");
            //await _sem.WaitAsync(cancellationToken);
            //endTiming();
            //try
            {
				startTiming("geticonsetasync");
				var indexSet = await GetIconSetAsync(cancellationToken);
                endTiming();

				var now = DateTime.UtcNow;

                var hasResults = new HashSet<string>();
                var result = new List<IEIconInfo>();
                if (!String.IsNullOrWhiteSpace(searchTerm))
                {
                    searchTerm = searchTerm.ToLower();

                    var exactMatches = new List<IEIconInfo>();
                    var initialMatches = new List<IEIconInfo>();
                    var anyMatches = new List<IEIconInfo>();
					startTiming("search loop");
					foreach (var eicon in indexSet)
                    {
                        if (cancellationToken.IsCancellationRequested) { break; }

                        var name = eicon.Name;
                        if (name == searchTerm)
                        {
                            exactMatches.Add(eicon);
                        }
                        else
                        {
                            var midx = name.IndexOf(searchTerm);
                            if (midx == 0)
                            {
                                initialMatches.Add(eicon);
                            }
                            else if (midx > 0)
                            {
                                anyMatches.Add(eicon);
                            }
                        }
                    }
                    endTiming();

                    result.AddRange(exactMatches);
                    result.AddRange(initialMatches);
                    result.AddRange(anyMatches);
                }
                else
                {
                    result.AddRange(indexSet);
                    Shuffle(result);
                }

                return new EIconSearchResults() { Results = result, SearchTimings = timings };
            }
            //finally
            //{
            //    _sem.Release();
            //}
        }

        private void Shuffle<T>(IList<T> list)
        {
            var rng = new Random();
            int n = list.Count;
            while (n > 1)
            {
                n--;
                int k = rng.Next(n + 1);
                T value = list[k];
                list[k] = list[n];
                list[n] = value;
            }
        }

        private readonly SemaphoreSlim _populateSem = new SemaphoreSlim(1);
        private IReadOnlyList<EIconInfo>? _loadedIndexSet = null;

        private async Task<IReadOnlyList<EIconInfo>> GetIndexSetAsync(CancellationToken cancellationToken)
        {
            var ls = _loadedIndexSet;
            if (ls != null)
            {
                return ls;
            }

            List<EIconInfo> result = new List<EIconInfo>();

            using (var cmd = _sqliteConnection!.CreateCommand())
            {
                cmd.CommandText = @$"
                    SELECT lower(name) AS name, addedat
                    FROM eicon 
                    WHERE name is not null 
                    ORDER BY lower(name)";
                using (var reader = await cmd.ExecuteReaderAsync(cancellationToken))
                {
                    while (await reader.ReadAsync(cancellationToken))
                    {
                        var name = Convert.ToString(reader["name"])!;
                        var addedAt = DateTimeOffset.FromUnixTimeMilliseconds(Convert.ToInt64(reader["addedat"])).UtcDateTime;
                        result.Add(new EIconInfo(name, addedAt));
                    }
                }
            }

            _loadedIndexSet = result;
            return result;
        }

        private class EIconSearchResults : IEIconSearchResults
        {
            public IReadOnlyList<IEIconInfo> Results { get; set; }

            public required IReadOnlyDictionary<string, long> SearchTimings { get; set; }
		}

        private class EIconInfo : IEIconInfo
        {
            public EIconInfo(string name, DateTime addedAt)
            {
                this.Name = name;
                this.AddedAt = addedAt;
            }

            public string Name { get; }

            public DateTime AddedAt { get; }
        }

        private class EIconInfoExtended : EIconInfo, IEIconInfoExtended
        {
            public EIconInfoExtended(string name, DateTime addedAt, string etag, long contentLength)
                : base(name, addedAt)
            {
                this.ETag = etag;
                this.ContentLength = contentLength;
            }

            public string ETag { get; }

            public long ContentLength { get; }
        }

        private async Task TryWithPopulateSem(Func<Task> asyncFunc)
        {
            if (await _populateSem.WaitAsync(0))
            {
                try
                {
                    await asyncFunc();
                }
                finally
                {
                    _populateSem.Release();
                }
            }
        }

        private async Task<IReadOnlyList<EIconInfo>> GetIconSetAsync(CancellationToken cancellationToken)
        {
            if (this._loadedIndexSet == null)
            {
                await _populateSem.WaitAsync(cancellationToken);
                try
                {
                    if (this._loadedIndexSet == null)
                    {
                        await EnsureDbConnectedAsync(cancellationToken);
                        await GetIndexSetAsync(cancellationToken);
                        await EnsureIndexUpToDateInternalAsync(cancellationToken);
                        return this._loadedIndexSet ?? new List<EIconInfo>();
                    }
                    else
                    {
                        return this._loadedIndexSet;
                    }
                }
                finally
                {
                    _populateSem.Release();
                }
            }
            else
            {
                _ = Task.Run(async () =>
                {
                    var cancellationToken = _hostApplicationLifetime.ApplicationStopping;

                    await TryWithPopulateSem(async () =>
                    {
						await EnsureDbConnectedAsync(cancellationToken);
						await GetIndexSetAsync(cancellationToken);
						await EnsureIndexUpToDateInternalAsync(cancellationToken);
					});
                });
                return this._loadedIndexSet;
            }
        }

        private async Task EnsureDbConnectedAsync(CancellationToken cancellationToken)
        {
            if (_sqliteConnection == null)
            {
				_sqliteConnection = await CreateSqliteConnectionAsync(false, cancellationToken);
            }
        }

        private async Task EnsureIndexUpToDateInternalAsync(CancellationToken cancellationToken)
        { 
            if (_lastUpdateAt == null)
            {
                _lastUpdateAt = await GetLastUpdatedAtAsync(cancellationToken);
            }
            if (_lastUpdateAt != null)
            {
                var asofnow = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                if (asofnow > _lastUpdateAt + (5 * 60))
                {
                    await UpdateIndexAsync(_lastUpdateAt.Value, cancellationToken);
                }
            }
        }

        private async Task UpdateIndexAsync(long updateAsOf, CancellationToken cancellationToken)
        {
            var nowDTO = DateTimeOffset.UtcNow;
            var updateAsOfDTO = DateTimeOffset.FromUnixTimeSeconds(updateAsOf);
            var diff = nowDTO - updateAsOfDTO;
            if (diff < TimeSpan.Zero || diff > TimeSpan.FromHours(48))
            {
                await FullyRefreshIndexAsync(cancellationToken);
            }

            using var hc = new HttpClient();

            var url = $"https://xariah.net/eicons/Home/EiconsDataDeltaSince/{_lastUpdateAt}?v=2";
            using var resp = await hc.GetAsync(url, cancellationToken);

            var asOf = 0L;
            var eicons = new Dictionary<string, (long AddedAt, string ETag, long ContentLength)?>();
            var bodyText = await resp.Content.ReadAsStringAsync();
            using (var sr = new StringReader(bodyText))
            {
                string? line;
                while ((line = sr.ReadLine()) != null)
                {
                    if (String.IsNullOrWhiteSpace(line)) continue;
                    if (line.StartsWith("#"))
                    {
                        if (line.StartsWith("# As Of: "))
                        {
                            asOf = Convert.ToInt64(line.Substring("# As Of: ".Length));
                        }
                    }
                    else
                    {
                        var parts = line.Split('\t');
                        if (parts[0] == "+")
                        {
                            eicons[parts[1]] = (Convert.ToInt64(parts[2]), parts[3], Convert.ToInt64(parts[4]));
                        }
                        else if (parts[0] == "-")
                        {
                            eicons[parts[1]] = null;
                        }
                    }
                }
            }

            var onCommitActions = new List<Action>();
            Dictionary<string, EIconInfo>? eiconInfoDict = null;
            void populateEIconInfoDict()
            {
                if (eiconInfoDict == null && this._loadedIndexSet != null)
                {
                    eiconInfoDict = this._loadedIndexSet.ToDictionary(e => e.Name);
                }
            }

            using var xa = await _sqliteConnection!.BeginTransactionAsync(cancellationToken);
            foreach (var kvp in eicons)
            {
                if (kvp.Value != null)
                {
                    var kvpValue = kvp.Value.Value;
                    try
                    {
                        await ExecuteNonQueryAsync(
                            $"DELETE FROM eicon WHERE name = {SqlEscape(kvp.Key)}",
                            xa, cancellationToken);
                        await ExecuteNonQueryAsync(@$"
                                INSERT INTO eicon(name, addedat, etag, contentlength) 
                                VALUES ({SqlEscape(kvp.Key)}, {kvpValue.AddedAt},
                                    {SqlEscape(kvpValue.ETag)}, {kvpValue.ContentLength})", 
                            xa, cancellationToken);
                        if (_loadedIndexSet != null)
                        {
                            onCommitActions.Add(() =>
                            {
                                populateEIconInfoDict();
                                if (!eiconInfoDict!.TryGetValue(kvp.Key.ToLower(), out _))
                                {
                                    var addedAt = DateTimeOffset.FromUnixTimeMilliseconds(kvpValue.AddedAt).UtcDateTime;
                                    eiconInfoDict[kvp.Key.ToLower()] = new EIconInfo(kvp.Key.ToLower(), addedAt);
                                }
                            });
                        }
                    }
                    catch { }
                }
                else
                {
                    await ExecuteNonQueryAsync(
                        $"DELETE FROM eicon WHERE name = {SqlEscape(kvp.Key)}",
                        xa, cancellationToken);

                    if (_loadedIndexSet != null)
                    {
                        onCommitActions.Add(() =>
                        {
                            populateEIconInfoDict();
                            eiconInfoDict!.Remove(kvp.Key.ToLower());
                        });
                    }
                }
            }
            await PutLastUpdatedAtAsync(xa, asOf, cancellationToken);
            _lastUpdateAt = asOf;
            await xa.CommitAsync(cancellationToken);

            foreach (var onCommitAction in onCommitActions)
            {
                onCommitAction();
            }
            if (eiconInfoDict != null)
            {
                this._loadedIndexSet = eiconInfoDict!.Values.OrderBy(e => e.Name).ToList();
            }
        }

        private async Task FullyRefreshIndexAsync(CancellationToken cancellationToken)
        {
            using var hc = new HttpClient();

            var url = "https://xariah.net/eicons/Home/EiconsDataBase/base2.doc";
            using var resp = await hc.GetAsync(url, cancellationToken);

            var asOf = 0L;
            var eicons = new Dictionary<string, (long AddedAt, string ETag, long ContentLength)>();
            var bodyText = await resp.Content.ReadAsStringAsync();
            using (var sr = new StringReader(bodyText))
            {
                string? line;
                while ((line = sr.ReadLine()) != null)
                {
                    if (String.IsNullOrWhiteSpace(line)) continue;
                    if (line.StartsWith("#"))
                    {
                        if (line.StartsWith("# As Of: "))
                        {
                            asOf = Convert.ToInt64(line.Substring("# As Of: ".Length));
                        }
                    }
                    else
                    {
                        var parts = line.Split('\t');

                        var eiconName = parts[0];
                        var addedAt = Convert.ToInt64(parts[1]);
                        var etag = parts.Length > 2 ? parts[2] : "";
                        if (parts.Length <= 3 || !Int64.TryParse(parts[3], out var contentLength))
                        {
                            contentLength = 0;
                        }

                        eicons[parts[0]] = (addedAt, etag, contentLength);
                    }
                }
            }

            using var xa = await _sqliteConnection!.BeginTransactionAsync(cancellationToken);
            await ExecuteNonQueryAsync("DELETE FROM eicon", xa, cancellationToken);
            foreach (var kvp in eicons)
            {
                await ExecuteNonQueryAsync(@$"
                    INSERT INTO eicon(name, addedat, etag, contentlength) 
                    VALUES ({SqlEscape(kvp.Key)}, {kvp.Value.AddedAt}, {SqlEscape(kvp.Value.ETag)}, {kvp.Value.ContentLength})", 
                    xa, cancellationToken);
            }
            await PutLastUpdatedAtAsync(xa, asOf, cancellationToken);
            _lastUpdateAt = asOf;
            await xa.CommitAsync(cancellationToken);

            this._loadedIndexSet = null;
        }

        private string SqlEscape(string str)
        {
            return "'" + str.Replace("'", "''") + "'";
        }

        private async Task<long?> GetLastUpdatedAtAsync(CancellationToken cancellationToken)
        {
            var lastasof = await ExecuteScalarAsync("SELECT lastasof FROM updatestate", cancellationToken);
            if (lastasof is DBNull)
            {
                return null;
            }
            else
            {
                return Convert.ToInt64(lastasof);
            }
        }

        private async Task PutLastUpdatedAtAsync(
            DbTransaction transaction,
            long lastAsOf, CancellationToken cancellationToken)
        {
            //using var xa = await _sqliteConnection!.BeginTransactionAsync(cancellationToken);
            await ExecuteNonQueryAsync("DELETE FROM updatestate", transaction, cancellationToken);
            await ExecuteNonQueryAsync($"INSERT INTO updatestate (lastasof) VALUES({lastAsOf})", transaction, cancellationToken);
            //await xa.CommitAsync(cancellationToken);
        }

        private async Task<SqliteConnection> CreateSqliteConnectionAsync(
            bool readOnly,
            CancellationToken cancellationToken)
        {
            var adf = _appDataFolder.GetAppDataFolder();
            var fn = Path.Combine(adf, "eicons.db");

            var result = await DbSchemaManager.VerifySchemaAsync(fn, readOnly,
                [
                    new EIconIndexMigration01Initial(),
                    new EIconIndexMigration02AddSchemaVersionTable(),
                    new EIconIndexMigration03AddImageChangeData()
                ],
                cancellationToken);
            return result;
        }

        private async Task<object?> ExecuteScalarAsync(string sql, CancellationToken cancellationToken)
        {
            using var cmd = _sqliteConnection!.CreateCommand();
            cmd.CommandText = sql;
            var result = await cmd.ExecuteScalarAsync(cancellationToken);
            if (result is DBNull)
            {
                return null;
            }
            else
            {
                return result;
            }
        }

        private async Task ExecuteNonQueryAsync(string sql, DbTransaction? xa = null, CancellationToken cancellationToken = default)
        {
            using var cmd = _sqliteConnection!.CreateCommand();
            cmd.CommandText = sql;
            cmd.Transaction = xa as SqliteTransaction;
            await cmd.ExecuteNonQueryAsync(cancellationToken);
        }
    }
}
