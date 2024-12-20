//using Microsoft.Data.Sqlite;
//using System;
//using System.Collections.Generic;
//using System.Linq;
//using System.Text;
//using System.Threading.Tasks;

//namespace XarChat.Backend.Features.ChatLogging.Sqlite.Search
//{
//    internal class SqliteChatLogSearch : IChatLogSearch, IDisposable
//    {
//        private readonly SqliteConnection _connection;

//        private readonly SemaphoreSlim _sem = new SemaphoreSlim(1);
//        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();
//        private bool _disposed = false;

//        public SqliteChatLogSearch(SqliteConnection connection)
//        {
//            _connection = connection;
//        }

//        public void Dispose()
//        {
//            if (!_disposed)
//            {
//                _disposeCTS.Cancel();
//                _connection.Dispose();
//            }
//        }

//        private void ThrowIfDisposed()
//        {
//            if (_disposed)
//            {
//                throw new ObjectDisposedException(GetType().FullName);
//            }
//        }

//        private async Task<T> RunWithDisposeCancellation<T>(
//            Func<CancellationToken, Task<T>> func, 
//            CancellationToken cancellationToken)
//        {
//            using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
//            try
//            {
//                await _sem.WaitAsync(combinedCTS.Token);
//                try
//                {
//                    var ctoken = combinedCTS.Token;
//                    var result = await func(ctoken);
//                    return result;
//                }
//                finally
//                {
//                    _sem.Release();
//                }
//            }
//            catch when (_disposeCTS.IsCancellationRequested)
//            {
//                throw new ObjectDisposedException(GetType().FullName);
//            }
//            catch when (cancellationToken.IsCancellationRequested)
//            {
//                throw new OperationCanceledException(cancellationToken);
//            }
//        }

//        private (string Query, SqliteParameter parameters) GetBaseQuery(SearchCriteria criteria)
//        {
//            var sb = new StringBuilder();
//            var parameters = new List<SqliteParameter>();

//            var channelMessageWheres = new List<string>();
//            channelMessageWheres.Add("1 = 1");
//            if (criteria.TimeSpec is not null)
//            {
//                if (criteria.TimeSpec.After is not null && criteria.TimeSpec.Before is not null)
//                {
//                    channelMessageWheres.Add("cm.timestamp between @timeafter and @timebefore");
//                    var prmAfter = new SqliteParameter("@timeafter", SqliteType.Integer);
//                    prmAfter.Value = new DateTimeOffset(criteria.TimeSpec.After.Value, TimeSpan.Zero).ToUnixTimeMilliseconds();
//                    var prmBefore = new SqliteParameter("@timebefore", SqliteType.Integer);
//                    prmBefore.Value = new DateTimeOffset(criteria.TimeSpec.Before.Value, TimeSpan.Zero).ToUnixTimeMilliseconds();
//                    parameters.Add(prmAfter);
//                    parameters.Add(prmBefore);
//                }
//                else if (criteria.TimeSpec.After is not null)
//                {
//                    channelMessageWheres.Add("cm.timestamp >= @timeafter");
//                    var prmAfter = new SqliteParameter("@timeafter", SqliteType.Integer);
//                    prmAfter.Value = new DateTimeOffset(criteria.TimeSpec.After.Value, TimeSpan.Zero).ToUnixTimeMilliseconds();
//                    parameters.Add(prmAfter);
//                }
//                else if (criteria.TimeSpec.Before is not null)
//                {
//                    channelMessageWheres.Add("cm.timestamp <= @timebefore");
//                    var prmBefore = new SqliteParameter("@timebefore", SqliteType.Integer);
//                    prmBefore.Value = new DateTimeOffset(criteria.TimeSpec.Before.Value, TimeSpan.Zero).ToUnixTimeMilliseconds();
//                    parameters.Add(prmBefore);
//                }
//            }


//            if (criteria.TextSpec is not null && criteria.TextSpec is SearchContainsTextCriterion sct)
//            {
//                sb.Append($@"
//                    with textmatches as (
//                        select ftss.rowid
//                        from fts_strings(@txtsearch) ftss
//                    ), matchedmessages as (
//                        select cm.*
//                        from channelmessage cm
//                        where {String.Join(" AND ", channelMessageWheres)}
//                            and cm.textstringid in (select rowid from matchingstrings)
//                    )");
//                var prmTxtSearch = new SqliteParameter("@txtsearch", SqliteType.Text);
//                prmTxtSearch.Value = sct.SearchText;
//                parameters.Add(prmTxtSearch);
//            }
//        }

//        public async Task<int> GetSearchResultCountAsync(SearchCriteria criteria, CancellationToken cancellationToken)
//        {
//            var result = await RunWithDisposeCancellation(
//                cancellationToken: cancellationToken,
//                func: async (cancellationToken) =>
//                {
//                    using var cmd = _connection.CreateCommand();
//                    cmd.CommandText = 
//                });
//            return result;
//        }

//        public Task<int[]> GetSearchResultIdsAsync(SearchCriteria criteria, CancellationToken cancellationToken)
//        {
//            throw new NotImplementedException();
//        }

//        public Task<SearchResultItem[]> GetSearchResultsAsync(SearchCriteria criteria, CancellationToken cancellationToken)
//        {
//            throw new NotImplementedException();
//        }

//        public Task<SearchResultItem[]> GetSearchResultsForIdsAsync(IReadOnlyList<int> ids, CancellationToken cancellationToken)
//        {
//            throw new NotImplementedException();
//        }
//    }
//}
