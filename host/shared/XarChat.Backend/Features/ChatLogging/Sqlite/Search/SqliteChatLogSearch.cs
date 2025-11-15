using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppSettings;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.Search
{
    internal class SqliteChatLogSearch : IChatLogSearch, IDisposable
    {
        private readonly SqliteChatLogWriter _logWriter;
        private readonly IAppSettingsManager _appSettingsManager;

        private readonly SemaphoreSlim _sem = new SemaphoreSlim(1);
        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();
        private bool _disposed = false;

        public SqliteChatLogSearch(
            SqliteChatLogWriter sqliteChatLogWriter,
            IAppSettingsManager appSettingsManager)
        {
            _logWriter = sqliteChatLogWriter;
            _appSettingsManager = appSettingsManager;
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _disposeCTS.Cancel();
            }
        }

        private void ThrowIfDisposed()
        {
            if (_disposed)
            {
                throw new ObjectDisposedException(GetType().FullName);
            }
        }

        private async Task<T> RunWithDisposeCancellation<T>(
            Func<SqliteConnection, CancellationToken, Task<T>> func,
            CancellationToken cancellationToken)
        {
            ThrowIfDisposed();

            using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
            try
            {
                var result = await _logWriter.WithSemaphore(
                    cancellationToken: combinedCTS.Token,
                    func: async (connection, cancellationToken) =>
                    {
                        var result = await func(connection, cancellationToken);
                        return result;
                    });
                return result;
            }
            catch when (_disposeCTS.IsCancellationRequested)
            {
                throw new ObjectDisposedException(GetType().FullName);
            }
            catch when (cancellationToken.IsCancellationRequested)
            {
                throw new OperationCanceledException(cancellationToken);
            }
        }

        private (string Query, List<SqliteParameter> parameters) GetBaseQuery(SearchCriteria criteria)
        {
            var sb = new StringBuilder();
            var parameters = new List<SqliteParameter>();

            var channelWheres = new List<string>();
            var channelWheresParams = new List<SqliteParameter>();
            channelWheres.Add("1 = 1");

            var channelMessageWheres = new List<string>();
            var channelMessageWheresParams = new List<SqliteParameter>();
            channelMessageWheres.Add("1 = 1");

            if (criteria.TimeSpec is not null)
            {
                if (criteria.TimeSpec.After is not null && criteria.TimeSpec.Before is not null)
                {
                    channelMessageWheres.Add("cm.timestamp between @timeafter and @timebefore");
                    var prmAfter = new SqliteParameter("@timeafter", SqliteType.Integer);
                    prmAfter.Value = new DateTimeOffset(criteria.TimeSpec.After.Value, TimeSpan.Zero).ToUnixTimeMilliseconds();
                    var prmBefore = new SqliteParameter("@timebefore", SqliteType.Integer);
                    prmBefore.Value = new DateTimeOffset(criteria.TimeSpec.Before.Value, TimeSpan.Zero).ToUnixTimeMilliseconds();
                    channelMessageWheresParams.Add(prmAfter);
                    channelMessageWheresParams.Add(prmBefore);
                }
                else if (criteria.TimeSpec.After is not null)
                {
                    channelMessageWheres.Add("cm.timestamp >= @timeafter");
                    var prmAfter = new SqliteParameter("@timeafter", SqliteType.Integer);
                    prmAfter.Value = new DateTimeOffset(criteria.TimeSpec.After.Value, TimeSpan.Zero).ToUnixTimeMilliseconds();
                    channelMessageWheresParams.Add(prmAfter);
                }
                else if (criteria.TimeSpec.Before is not null)
                {
                    channelMessageWheres.Add("cm.timestamp <= @timebefore");
                    var prmBefore = new SqliteParameter("@timebefore", SqliteType.Integer);
                    prmBefore.Value = new DateTimeOffset(criteria.TimeSpec.Before.Value, TimeSpan.Zero).ToUnixTimeMilliseconds();
                    channelMessageWheresParams.Add(prmBefore);
                }
            }

            if (criteria.WhoSpec is not null && criteria.WhoSpec is SearchLogsForCharacterCriterion lfc)
            {
                channelWheres.Add($@"
                    (cm.speakingcharacterid = (select xc.id from character xc where xc.namelower = @speakingcharnamelower))
                    ");
                var prmMyCharNameLower = new SqliteParameter("@speakingcharnamelower", SqliteType.Text);
                prmMyCharNameLower.Value = lfc.CharacterName.ToLower();
                channelWheresParams.Add(prmMyCharNameLower);
            }

            if (criteria.StreamSpec is not null && criteria.StreamSpec is SearchInChannelCriterion cc)
            {
                channelWheres.Add("(c.channeltype = 'C' and lower(c.title) = @chantitle)");

                var prmMyCharNameLower = new SqliteParameter("@chantitle", SqliteType.Text);
                prmMyCharNameLower.Value = cc.ChannelTitle.ToLower();
                channelWheresParams.Add(prmMyCharNameLower);
            }
            else if (criteria.StreamSpec is not null && criteria.StreamSpec is SearchPrivateMessagesWithCriterion pmc)
            {
                channelWheres.Add(@"(c.channeltype = 'P' 
                    and c.mycharacterid = (select id from character cx where cx.namelower = @mycharacternamelower)
                    and c.interlocutorcharacterid = (select id from character cx where cx.namelower = @interlocutornamelower))");

                var prmMyCharNameLower = new SqliteParameter("@mycharacternamelower", SqliteType.Text);
                prmMyCharNameLower.Value = pmc.MyCharacterName.ToLower();
                channelWheresParams.Add(prmMyCharNameLower);
                var prmInterlocutorNameLower = new SqliteParameter("@interlocutornamelower", SqliteType.Text);
                prmInterlocutorNameLower.Value = pmc.InterlocutorCharacterName.ToLower();
                channelWheresParams.Add(prmInterlocutorNameLower);
            }

            if (channelWheres.Count > 1)
            {
                channelMessageWheres.Add("cm.channelid in (select id from matchedchannels)");
            }
            if (criteria.TextSpec is not null && criteria.TextSpec is SearchContainsTextCriterion sct)
            {
                sb.Append($@"
                    with textmatches as (
                        select ftss.rowid
                        from fts_strings(@txtsearch) ftss
                    ), 
                    matchedchannels as (
                        select c.id
                        from channel c
                        where {String.Join(" AND ", channelWheres)}
                    ),
                    matchedmessages as (
                        select cm.*
                        from channelmessage cm
                        where {String.Join(" AND ", channelMessageWheres)}
                            and cm.textstringid in (select rowid from textmatches)
                    )");
                var prmTxtSearch = new SqliteParameter("@txtsearch", SqliteType.Text);
                prmTxtSearch.Value = sct.SearchText;
                parameters.Add(prmTxtSearch);
                parameters.AddRange(channelWheresParams);
                parameters.AddRange(channelMessageWheresParams);
            }
            else
            {
                sb.Append($@"
                    with matchedchannels as (
                        select c.id
                        from channel c
                        where {String.Join(" AND ", channelWheres)}
                    ),
                    matchedmessages as (
                        select cm.*
                        from channelmessage cm
                        where {String.Join(" AND ", channelMessageWheres)}
                    )");
                parameters.AddRange(channelWheresParams);
                parameters.AddRange(channelMessageWheresParams);
            }

            return (sb.ToString(), parameters);
        }

        public Task<long> GetLogFileSizeAsync(CancellationToken cancellationToken)
        {
            return _logWriter.GetLogFileSizeAsync(cancellationToken);
        }

        public async Task<int> GetSearchResultCountAsync(SearchCriteria criteria, CancellationToken cancellationToken)
        {
            var result = await RunWithDisposeCancellation(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    var bq = GetBaseQuery(criteria);

                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = bq.Query + @"
                        select count(1)
                        from matchedmessages";
                    cmd.Parameters.AddRange(bq.parameters);

                    var ctObj = await cmd.ExecuteScalarAsync(cancellationToken);
                    var ct = Convert.ToInt32(ctObj);
                    return ct;
                });
            return result;
        }

        public async Task<IReadOnlyList<long>> GetSearchResultIdsAsync(
            SearchCriteria criteria, int skip, int take,
            CancellationToken cancellationToken)
        {
            var result = await RunWithDisposeCancellation(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    var bq = GetBaseQuery(criteria);

                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = bq.Query + @"
                                    select mm.id
                                    from matchedmessages mm
                                    order by mm.timestamp asc
                                    limit @take offset @skip";
                    cmd.Parameters.AddRange(bq.parameters);
                    cmd.Parameters.Add("@take", SqliteType.Integer).Value = take;
                    cmd.Parameters.Add("@skip", SqliteType.Integer).Value = skip;

                    var results = new List<long>();
                    using (var dr = await cmd.ExecuteReaderAsync(cancellationToken))
                    {
                        while (await dr.ReadAsync(cancellationToken))
                        {
                            var tid = Convert.ToInt64(dr["id"]);
                            results.Add(tid);
                        }
                    }

                    return results.ToArray();
                });
            return result;
        }

        public async Task<IReadOnlyList<SearchResultItem>> GetSearchResultSubsetAsync(
            SearchCriteria criteria, int skip, int take, CancellationToken cancellationToken)
        {
            var ids = await GetSearchResultIdsAsync(criteria, skip, take, cancellationToken);
            var result = await GetSearchResultsForIdsAsync(ids, cancellationToken);
            return result;
        }

        public async Task<IReadOnlyList<SearchResultItem>> GetSearchResultsForIdsAsync(IReadOnlyList<long> ids, CancellationToken cancellationToken)
        {
            var result = await RunWithDisposeCancellation(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = $@"
                        select cm.id, c.name, c.title, myc.name as mycharactername, ilc.name interlocutorcharactername,
	                        spc.name as speakingcharactername, cm.messagetype, s.value as text, cm.genderid, cm.onlinestatusid, cm.timestamp
                        from channelmessage cm
                        inner join channel c on c.id = cm.channelid
                        left outer join character myc on myc.id = c.mycharacterid
                        left outer join character ilc on ilc.id = c.interlocutorcharacterid
                        inner join character spc on spc.id = cm.speakingcharacterid
                        inner join strings s on s.id = cm.textstringid
                        where cm.id in ({ String.Join(",", ids.Select(i => i.ToString())) })";

                    var results = new List<SearchResultItem>();
                    using (var dr = await cmd.ExecuteReaderAsync(cancellationToken))
                    {
                        while (await dr.ReadAsync(cancellationToken))
                        {
                            var sri = new SearchResultItem()
                            {
                                MessageId = Convert.ToInt64(dr["id"]),
                                ChannelName = MaybeConvert<string>(dr["name"]),
                                ChannelTitle = MaybeConvert<string>(dr["title"]),
                                MyCharacterName = MaybeConvert<string>(dr["mycharactername"]),
                                InterlocutorCharacterName = MaybeConvert<string>(dr["interlocutorcharactername"]),
                                SpeakingCharacterName = MaybeConvert<string>(dr["speakingcharactername"]),
                                MessageType = Convert.ToInt32(dr["messagetype"]),
                                Text = Convert.ToString(dr["text"])!,
                                GenderId = Convert.ToInt32(dr["genderid"]),
                                OnlineStatusId = Convert.ToInt32(dr["onlinestatusid"])
                            };
                            results.Add(sri);
                        }
                    }

                    return results;
                });
            return result;
        }

        private T? MaybeConvert<T>(object value)
        {
            if (value is not null && value is not DBNull)
            {
                return (T?)Convert.ChangeType(value, typeof(T));
            }
            else
            {
                return default;
            }
        }

        public async Task<IReadOnlyList<string>> GetChannelNamesAsync(CancellationToken cancellationToken)
        {
            var chanTitlesSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            await RunWithDisposeCancellation(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = @"
                        select distinct ch.title
                        from channel ch
                        where ch.channeltype = 'C'";

                    using (var dr = await cmd.ExecuteReaderAsync(cancellationToken))
                    {
                        while (await dr.ReadAsync(cancellationToken))
                        {
                            var chanTitle = Convert.ToString(dr["title"])!;
                            chanTitlesSet.Add(chanTitle);
                        }
                    }

                    return 0;
                });

            var result = chanTitlesSet.OrderBy(cn => cn).ToList();

            return result;
        }

        public async Task<IReadOnlyList<LogCharacterInfo>> GetMyCharacterInfosAsync(CancellationToken cancellationToken)
        {
            var charsSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var asd = _appSettingsManager.GetAppSettingsData();
            foreach (var scs in asd.SavedChatStates)
            {
                charsSet.Add(scs.CharacterName);
            }

            await RunWithDisposeCancellation(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = @"
                        select distinct c.name
                        from character c
                        where exists (select 1 from channel where channeltype = 'P' and mycharacterid = c.id)";

                    using (var dr = await cmd.ExecuteReaderAsync(cancellationToken))
                    {
                        while (await dr.ReadAsync(cancellationToken))
                        {
                            var charName = Convert.ToString(dr["name"])!;
                            charsSet.Add(charName);
                        }
                    }

                    return 0;
                });

            var result = charsSet.OrderBy(cn => cn).Select(cn => new LogCharacterInfo()
            {
                CharacterName = cn,
                CharacterGender = 0
            }).ToList();

            return result;
        }

        public async Task<IReadOnlyList<LogCharacterInfo>> GetInterlocutorInfosAsync(
            string? myCharacterName, CancellationToken cancellationToken)
        {
            var charsSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            await RunWithDisposeCancellation(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    using var cmd = connection.CreateCommand();
                    if (myCharacterName is null)
                    {
                        cmd.CommandText = @"
                            select distinct ilc.name
                            from channel c
                            inner join character ilc on ilc.id = c.interlocutorcharacterid
                            where c.channeltype = 'P'";
                    }
                    else
                    {
                        cmd.CommandText = @"
                            select distinct ilc.name
                            from channel c
                            inner join character myc on myc.id = c.mycharacterid
                            inner join character ilc on ilc.id = c.interlocutorcharacterid
                            where myc.namelower = @mynamelower and c.channeltype = 'P'";
                        cmd.Parameters.Add("@mynamelower", SqliteType.Text).Value = myCharacterName.ToLower();
                    }

                    using (var dr = await cmd.ExecuteReaderAsync(cancellationToken))
                    {
                        while (await dr.ReadAsync(cancellationToken))
                        {
                            var charName = Convert.ToString(dr["name"])!;
                            charsSet.Add(charName);
                        }
                    }

                    return 0;
                });

            var result = charsSet.OrderBy(cn => cn).Select(cn => new LogCharacterInfo()
            {
                CharacterName = cn,
                CharacterGender = 0
            }).ToList();

            return result;
        }

        public async Task<bool> ValidateChannelInLogsAsync(string channelName, CancellationToken cancellationToken)
        {
            var result = await RunWithDisposeCancellation(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    try
                    {
                        using var cmd = connection.CreateCommand();
                        cmd.CommandText = @"
                            select 1
                            from channel c
                            where c.channeltype = 'C' and c.name = @channame
                        ";
                        cmd.Parameters.Add("@channame", SqliteType.Text).Value = channelName;
                        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync(cancellationToken));
                        return count > 0;
                    }
                    catch (Exception)
                    {
                        return false;
                    }
                });

            return result;
        }

        public async Task<bool> ValidatePMConvoInLogsAsync(
            string myCharacterName, string interlocutorName, CancellationToken cancellationToken)
        {
            var result = await RunWithDisposeCancellation(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    try
                    {
                        using var cmd = connection.CreateCommand();
                        cmd.CommandText = @"
                            select count(*)
                            from channel c
                            inner join character myc on myc.id = c.mycharacterid
                            inner join character ilc on ilc.id = c.interlocutorcharacterid
                            where c.channeltype = 'P' and myc.namelower = @mynamelower and ilc.namelower = @interlocutornamelower
                        ";
                        cmd.Parameters.Add("@mynamelower", SqliteType.Text).Value = myCharacterName.ToLower();
                        cmd.Parameters.Add("@interlocutornamelower", SqliteType.Text).Value = interlocutorName.ToLower();
                        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync(cancellationToken));
                        return count > 0;
                    }
                    catch (Exception)
                    {
                        return false;
                    }
                });

            return result;
        }

        public async Task<IList<RecentConversationInfo>> GetRecentConversationsAsync(
            string myCharacterName, int resultLimit, CancellationToken cancellationToken)
        {
            var result = await RunWithDisposeCancellation(
                cancellationToken: cancellationToken,
                func: async (connection, cancellationToken) =>
                {
                    try
                    {
                        using var cmd = connection.CreateCommand();
                        cmd.CommandText = $@"
                            select c.id as channelid, ilocchar.name as interlocutorname,
	                            (select max(timestamp) from channelmessage cm where cm.channelid = c.id) as lastmessageat
                            from channel c
                            inner join character mychar on mychar.id = c.mycharacterid
                            inner join character ilocchar on ilocchar.id = c.interlocutorcharacterid
                            where channeltype = 'P' and mychar.namelower = @MyCharacterName
                            order by lastmessageat desc
                            limit {resultLimit}
                        ";
                        cmd.Parameters.Add("@MyCharacterName", SqliteType.Text).Value = myCharacterName.ToLower();

                        var result = new List<RecentConversationInfo>();

                        using var dr = await cmd.ExecuteReaderAsync(cancellationToken);
                        while (await dr.ReadAsync(cancellationToken))
                        {
                            var channelId = Convert.ToInt64(dr["channelid"]);
                            var interlocutorName = Convert.ToString(dr["interlocutorname"])!;
                            var lastMessageAt = Convert.ToInt64(dr["lastmessageat"]);
                            result.Add(new RecentConversationInfo() 
                            { 
                                ChannelId = channelId,
                                InterlocutorName = interlocutorName,
                                LastMessageAt = lastMessageAt
                            });
                        }

                        return result;
                    }
                    catch (Exception)
                    {
                        return new List<RecentConversationInfo>();
                    }
                });

            return result;
        }
    }
}
