using System.Diagnostics.CodeAnalysis;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.File
{
    internal class DbLogFileSwarm : IDisposable, IAsyncDisposable
    {
        private readonly SemaphoreSlim _dictSem = new SemaphoreSlim(1);
        private readonly Dictionary<string, Task<SingleDbLogFile>> _existingDbLogFiles
            = new Dictionary<string, Task<SingleDbLogFile>>();

        private readonly CancellationTokenSource _disposedCTS = new CancellationTokenSource();

        public DbLogFileSwarm(string baseDirectory)
        {
            this.BaseDirectory = baseDirectory;
        }

        public void Dispose()
        {
            DisposeAsync().AsTask().GetAwaiter().GetResult();
        }

        public async ValueTask DisposeAsync()
        {
            if (!_disposedCTS.IsCancellationRequested)
            {
                _disposedCTS.Cancel();

                await _dictSem.WaitAsync();
                try
                {
                    foreach (var x in _existingDbLogFiles.Values)
                    {
                        try
                        {
                            await (await x).DisposeAsync();
                        }
                        catch { }
                    }
                    _existingDbLogFiles.Clear();
                }
                finally
                {
                    _dictSem.Release();
                }
            }
        }

        public string BaseDirectory { get; }

        private string GetRelativeFilename(string characterName, int year, int month)
        {
            return $"log!{characterName}!{year:0000}!{month:00}.db";
        }

        private static readonly Regex FilenameParsePattern
            = new Regex(@"^log\!(?<name>.+?)\!(?<year>\d{4})\!(?<month>\d{2})\.db$", RegexOptions.IgnoreCase | RegexOptions.ExplicitCapture);

        private bool TryParseRelativeFilename(
            string filename, 
            [NotNullWhen(true)] out (string CharacterName, int Year, int Month)? result)
        {
            var m = FilenameParsePattern.Match(filename);
            try
            {
                if (m.Success)
                {
                    var charName = m.Groups["name"].Value;
                    var year = Convert.ToInt32(m.Groups["year"].Value);
                    var month = Convert.ToInt32(m.Groups["month"].Value);
                    result = (charName, year, month);
                    return true;
                }
            }
            catch { }

            result = null;
            return false;
        }

        public async IAsyncEnumerable<SingleDbLogFile> EnumerateAllLogFiles(
            string? forCharacterName = null,
            (int Year, int Month)? forYearMonth = null,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            foreach (var fn in Directory.GetFiles(this.BaseDirectory, "*.db"))
            {
                if (TryParseRelativeFilename(Path.GetFileName(fn), out var tuple))
                {
                    if (forCharacterName != null
                        && !String.Equals(forCharacterName, tuple.Value.CharacterName, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    if (forYearMonth != null && (tuple.Value.Year != forYearMonth.Value.Year || 
                        tuple.Value.Month != forYearMonth.Value.Month))
                    {
                        continue;
                    }

                    Task<SingleDbLogFile> result;

                    await _dictSem.WaitAsync(cancellationToken);
                    try
                    {
                        if (_existingDbLogFiles.TryGetValue(fn, out var existingLog))
                        {
                            result = existingLog;
                        }
                        else
                        {
                            result = SingleDbLogFile.OpenExistingAsync(
                                tuple.Value.CharacterName, tuple.Value.Year, tuple.Value.Month, fn, _disposedCTS.Token);
                            _existingDbLogFiles.Add(fn, result);
                        }
                    }
                    finally
                    {
                        _dictSem.Release();
                    }

                    var xresult = await result;
                    yield return xresult;
                }
            }
        }

        public async Task<SingleDbLogFile?> TryGetExistingLogFileAsync(
            string characterName, int year, int month, CancellationToken cancellationToken)
        {
            try
            {
                var fn = GetRelativeFilename(characterName, year, month);
                var ffn = Path.Combine(this.BaseDirectory, fn);

                Task<SingleDbLogFile?> existingLogTask;
                await _dictSem.WaitAsync(cancellationToken);
                try
                {
                    if (_existingDbLogFiles.TryGetValue(ffn, out var existingLog))
                    {
                        existingLogTask = existingLog!;
                    }
                    else if (System.IO.File.Exists(ffn))
                    {
                        var xx = SingleDbLogFile.OpenExistingAsync(
                            characterName, year, month, ffn, _disposedCTS.Token);
                        _existingDbLogFiles.Add(ffn, xx);
                        existingLogTask = xx!;
                    }
                    else
                    {
                        existingLogTask = Task.FromResult<SingleDbLogFile?>(null);
                    }
                }
                finally
                {
                    _dictSem.Release(); 
                }

                var result = await existingLogTask;
                return result;
            }
            catch { }

            return null;
        }

        public async Task<SingleDbLogFile> GetOrCreateLogFileAsync(
            string characterName, int year, int month, CancellationToken cancellationToken)
        {
            var result = await TryGetExistingLogFileAsync(characterName, year, month, cancellationToken);
            if (result != null)
            {
                return result;
            }

            var fn = GetRelativeFilename(characterName, year, month);
            var ffn = Path.Combine(this.BaseDirectory, fn);

            Task<SingleDbLogFile> tsk;
            await _dictSem.WaitAsync(cancellationToken);
            try
            {
                var xx = SingleDbLogFile.CreateNewAsync(
                    characterName, year, month, ffn, _disposedCTS.Token);
                _existingDbLogFiles.Add(ffn, xx);
                tsk = xx;
            }
            finally
            {
                _dictSem.Release();
            }

            result = await tsk;
            return result;
        }
    }
}
