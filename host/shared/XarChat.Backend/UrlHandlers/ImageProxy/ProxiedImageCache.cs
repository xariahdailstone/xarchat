using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppDataFolder;

namespace XarChat.Backend.UrlHandlers.ImageProxy
{
    public interface IProxiedImageCache
    {
        bool Enabled { get; }

        Task PutAsync(string cacheKey, Dictionary<string, string> headers, Stream data, TimeSpan cacheDuration, CancellationToken cancellationToken);

        Task<FindResult?> FindAsync(string cacheKey, CancellationToken cancellationToken);
    }

    public interface IProxiedImageCache2
    {
        Task<FindResult> GetOrCreateAsync(
            string cacheKey,
            Func<Task<(Dictionary<string, string> Headers, Stream Data, TimeSpan CacheDuration)>> createFuncAsync,
            CancellationToken cancellationToken);
    }

    public class FindResult
    {
        public FindResult(Dictionary<string, string> headers, Stream stream)
        {
            this.Headers = headers;
            this.Stream = stream;
        }

        public Dictionary<string, string> Headers { get; }

        public Stream Stream { get; }
    }

	public class NullProxiedImageCache : IProxiedImageCache
	{
        public bool Enabled => false;

        public Task<FindResult?> FindAsync(string cacheKey, CancellationToken cancellationToken)
            => Task.FromResult<FindResult?>(null);

        public Task PutAsync(string cacheKey, Dictionary<string, string> headers, Stream data, TimeSpan cacheDuration, CancellationToken cancellationToken)
            => Task.CompletedTask;
	}

    public class SimplerProxiedImageCache : IProxiedImageCache2, IDisposable
    {
        private readonly ILogger<ProxiedImageCache> _logger;
        private readonly IMemoryCache _memoryCache;

        private readonly SemaphoreSlim _mcPopLock = new SemaphoreSlim(1);

		private readonly string _cacheDirectory;

        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();

		public SimplerProxiedImageCache(
            IAppDataFolder appDataFolder,
            ILogger<ProxiedImageCache> logger,
            IMemoryCache memoryCache)
        {
            _logger = logger;
            _memoryCache = memoryCache;

            _cacheDirectory = Path.Combine(appDataFolder.GetAppDataFolder(), "imageproxycache");
            Task.Run(() =>
            {
                CleanCacheDirectory(true);
            });
        }

        public void Dispose()
        {
            if (!_disposeCTS.IsCancellationRequested)
            {
                _disposeCTS.Cancel();
				CleanCacheDirectory(false);
			}
		}

        private record struct CacheKey(SimplerProxiedImageCache cache, string ck);

        public async Task<FindResult> GetOrCreateAsync(
            string cacheKey,
            Func<Task<(Dictionary<string, string> Headers, Stream Data, TimeSpan CacheDuration)>> createFuncAsync,
            CancellationToken cancellationToken)
        {
            using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
            cancellationToken = combinedCTS.Token;

            var cck = new CacheKey(this, cacheKey);
            
            bool TryGetFromMemoryCache([NotNullWhen(true)] out Task<CacheEntryInfo>? cei)
            {
                if (_memoryCache.TryGetValue<Task<CacheEntryInfo>>(cacheKey, out var cachedEntryTask) && cachedEntryTask is not null)
                {
                    try
                    {
                        cei = cachedEntryTask;
                        return true;
                    }
                    catch { }
                }
                cei = null;
                return false;
            }

            TRYAGAIN:
            if (!TryGetFromMemoryCache(out var ceiTask))
            {
                await _mcPopLock.WaitAsync(cancellationToken);
                try
                {
                    if (!TryGetFromMemoryCache(out ceiTask))
                    {
                        ceiTask = Task.Run(async () =>
                        {
							var cfr = await createFuncAsync();

                            var fn = Path.Combine(_cacheDirectory, $"{_myRunGuid.ToString()}-{Interlocked.Increment(ref _nextPutId)}.dat");
                            using (var fs = File.Create(fn))
                            {
                                await cfr.Data.CopyToAsync(fs);
                            }

                            var cei = new CacheEntryInfo(fn, cfr.Headers);
                            var mceo = new MemoryCacheEntryOptions()
                            {
                                AbsoluteExpirationRelativeToNow = cfr.CacheDuration
                            };
                            mceo.RegisterPostEvictionCallback((_, _, _, _) =>
                            {
                                _ = Task.Run(async () =>
                                {
                                    await Task.Delay(1000);
                                    var retriesRemaining = 10;
                                    while (retriesRemaining > 0)
                                    {
                                        try 
                                        { 
                                            File.Delete(cei.Filename);
                                            break;
                                        }
                                        catch 
                                        {
                                            retriesRemaining--;
                                            await Task.Delay(1000);
                                        }
                                    }
                                });
                            });
                            _ = _memoryCache.Set(cck, ceiTask, mceo);
                            return cei;
						});

                        _ = _memoryCache.Set(cck, ceiTask);
                    }
                }
                finally
                {
                    _mcPopLock.Release();
                }
			}

            try
            {
                var cei = await ceiTask;
                var fs = File.OpenRead(cei.Filename);
                return new FindResult(cei.Headers, fs);
            }
            catch
            {
                goto TRYAGAIN;
            }
        }

		public async Task<FindResult?> FindAsync(string cacheKey, CancellationToken cancellationToken)
		{
			using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _disposeCTS.Token);
			cancellationToken = combinedCTS.Token;

			var cck = new CacheKey(this, cacheKey);
            if (_memoryCache.TryGetValue<Task<CacheEntryInfo>>(cck, out var cachedValueTask) && cachedValueTask is not null)
            {
                try
                {
                    var cei = await cachedValueTask;
                    var fs = File.OpenRead(cei.Filename);
                    return new FindResult(cei.Headers, fs);
                }
                catch
                {
                    return null;
                }
            }
            else
            {
                return null;
            }
		}

        private readonly Guid _myRunGuid = Guid.NewGuid();
        private int _nextPutId = 0;

		private void CleanCacheDirectory(bool onlyMismatches)
		{
			if (!Directory.Exists(_cacheDirectory))
			{
				Directory.CreateDirectory(_cacheDirectory);
			}

			foreach (var fn in Directory.GetFiles(_cacheDirectory))
			{
                if (onlyMismatches && Path.GetFileName(fn).StartsWith(_myRunGuid.ToString()))
                {
                    continue;
                }

                var tfn = fn;

                try
                {
                    File.Delete(fn);
                }
                catch
                {
                    Task.Run(async () =>
                    {
                        int retriesRemaining = 10;
                        while (retriesRemaining > 0)
                        {
                            try
                            {
                                File.Delete(tfn);
                                break;
                            }
                            catch
                            {
                                retriesRemaining--;
                                await Task.Delay(50);
                            }
                        }
                    });
                }
			}
		}

        private record CacheEntryInfo(string Filename, Dictionary<string, string> Headers);
	}

	public class ProxiedImageCache : IProxiedImageCache
    {
        private readonly ILogger<ProxiedImageCache> _logger;

        private readonly string _cacheDirectory;

        private readonly object _cacheLock = new object();
        private readonly Dictionary<string, CacheEntryInfo> _cacheEntries = new Dictionary<string, CacheEntryInfo>();

        public ProxiedImageCache(
            IAppDataFolder appDataFolder,
            ILogger<ProxiedImageCache> logger)
        {
            _logger = logger;

            _cacheDirectory = Path.Combine(appDataFolder.GetAppDataFolder(), "imageproxycache");
            CleanCacheDirectory();
        }

        public bool Enabled => true;

        private void CleanCacheDirectory()
        {
            if (!Directory.Exists(_cacheDirectory))
            {
                Directory.CreateDirectory(_cacheDirectory);
            }
            foreach (var fn in Directory.GetFiles(_cacheDirectory))
            {
                File.Delete(fn);
            }
        }

        public async Task PutAsync(string cacheKey, Dictionary<string, string> headers, Stream data, TimeSpan cacheDuration, CancellationToken cancellationToken)
        {
            var fn = Path.Combine(_cacheDirectory, Guid.NewGuid().ToString());
            await CacheEntryInfo.CreateAsync(this, fn, cacheKey, headers, DateTime.UtcNow + cacheDuration, data, _logger, cancellationToken);
        }

        public Task<FindResult?> FindAsync(string cacheKey, CancellationToken cancellationToken)
        {
            lock (_cacheLock)
            {
                if (_cacheEntries.TryGetValue(cacheKey, out var cei) && cei.ExpiresAt > DateTime.UtcNow)
                {
                    try
                    {
                        var result = cei.GetReadStream();
                        return Task.FromResult<FindResult?>(new FindResult(cei.Headers, result));
                    }
                    catch { }
                }
            }
            return Task.FromResult<FindResult?>(null);
        }

        private void AddCacheEntryInfo(CacheEntryInfo cei)
        {
            lock (_cacheLock)
            {
                _cacheEntries.Add(cei.CacheKey, cei);
            }
        }

        private void RemoveCacheEntryInfo(CacheEntryInfo cei)
        {
            lock (_cacheLock)
            {
                if (_cacheEntries.TryGetValue(cei.CacheKey, out var cachedCei) && cachedCei == cei) 
                {
                    _cacheEntries.Remove(cei.CacheKey);
                }
            }
        }

        private class CacheEntryInfo
        {
            public static async Task CreateAsync(ProxiedImageCache pic, string fn,
                string cacheKey, Dictionary<string, string> headers,
                DateTime expiresAt, Stream data, ILogger logger, CancellationToken cancellationToken)
            {
                try
                {
                    using var writer = File.Create(fn);
                    logger.LogInformation("Creating {fn} for {cacheKey}", fn, cacheKey);

                    var cei = new CacheEntryInfo(fn, cacheKey, headers, expiresAt, logger);
                    pic.AddCacheEntryInfo(cei);
                    try
                    {
                        _ = Task.Run(async () =>
                        {
                            var waitFor = expiresAt - DateTime.UtcNow;
                            if (waitFor > TimeSpan.Zero)
                            {
                                await Task.Delay(waitFor);
                            }
                            logger.LogInformation($"Expiring {fn}");
                            pic.RemoveCacheEntryInfo(cei);
                            await Task.Delay(TimeSpan.FromSeconds(1));
                            cei.DeleteIfNoRefs();
                        });

                        int totalLen = 0;
                        byte[] buf = new byte[4096];
                        while (true)
                        {
                            int bytesRead = await data.ReadAsync(buf, 0, buf.Length, cancellationToken);
                            if (bytesRead > 0)
                            {
                                await writer.WriteAsync(buf, 0, bytesRead, cancellationToken);
                                await writer.FlushAsync(cancellationToken);
                                totalLen += bytesRead;
                                cei.MarkProgressLength(totalLen);
                            }
                            else
                            {
                                cei.MarkComplete();
                                break;
                            }
                        }
                    }
                    catch
                    {
                        pic.RemoveCacheEntryInfo(cei);
                        cei.MarkFailed();
                    }
                }
                finally
                {
                    data?.Dispose();
                }
            }

            private readonly object _stateLock = new object();
            private readonly string _fileName;
            private bool _disposed = false;
            private int _refCount = 1;
            private bool _isComplete = false;
            private bool _isFailed = false;
            private int _pendingLength = 0;
            private List<IncompleteWrappedStream> _incompleteStreams = new List<IncompleteWrappedStream>();

            private readonly ILogger _logger;

            private CacheEntryInfo(string fn, string cacheKey, Dictionary<string, string> headers, DateTime expiresAt, ILogger logger)
            {
                _fileName = fn;
                _logger = logger;
                this.CacheKey = cacheKey;
                this.Headers = headers;
                this.ExpiresAt = expiresAt;
            }

            public string CacheKey { get; }

            public Dictionary<string, string> Headers { get; }

            public DateTime ExpiresAt { get; }

            public Stream GetReadStream()
            {
                lock (_stateLock)
                {
                    IncrementRefCount();
                    try
                    {
                        Stream resultStream;
                        if (_isComplete)
                        {
                            resultStream = File.OpenRead(this._fileName);
                        }
                        else if (_isFailed)
                        {
                            throw new ApplicationException("cache entry invalid");
                        }
                        else
                        {
                            var iws = new IncompleteWrappedStream(this, _pendingLength);
                            this._incompleteStreams.Add(iws);
                            resultStream = new DisposeWrappedStream(iws, () =>
                            {
                                lock (_stateLock)
                                {
                                    this._incompleteStreams.Remove(iws);
                                }
                            });
                        }

                        return new DisposeWrappedStream(resultStream, () =>
                        {
                            lock (_stateLock)
                            {
                                DecrementRefCount();
                            }
                        });
                    }
                    catch
                    {
                        DecrementRefCount();
                        throw;
                    }
                }
            }

            private void MarkProgressLength(int len)
            {
                _logger.LogInformation($"MarkProgressLength {len} {_fileName}");
                lock (_stateLock)
                {
                    _pendingLength = len;
                    foreach (var iws in _incompleteStreams)
                    {
                        iws.MarkProgressLength(_pendingLength);
                    }
                }
            }

            private void MarkComplete()
            {
                _logger.LogInformation($"MarkComplete {_fileName}");
                lock (_stateLock)
                {
                    _isComplete = true;
                    DecrementRefCount();
                    foreach (var iws in _incompleteStreams)
                    {
                        iws.MarkComplete();
                    }
                }
            }

            private void MarkFailed()
            {
                _logger.LogInformation($"MarkFailed {_fileName}");
                lock (_stateLock)
                {
                    _isFailed = true;
                    DecrementRefCount();
                    foreach (var iws in _incompleteStreams)
                    {
                        iws.MarkFailed();
                    }
                }
            }

            private void IncrementRefCount()
            {
                int resultingRefCount;
                lock (_stateLock)
                {
                    if (_disposed)
                        throw new ObjectDisposedException(nameof(CacheEntryInfo));

                    resultingRefCount = ++_refCount;
                }
                _logger.LogInformation($"IncRefCount {resultingRefCount} {_fileName}");
            }

            private void DecrementRefCount()
            {
                int resultingRefCount;
                lock (_stateLock)
                {
                    resultingRefCount = --_refCount;
                    DeleteIfNoRefs();
                }
                _logger.LogInformation($"DecRefCount {resultingRefCount} {_fileName}");
            }

            private void DeleteIfNoRefs()
            {
                lock (_stateLock)
                {
                    if (_refCount == 0 && this.ExpiresAt <= DateTime.UtcNow)
                    {
                        _disposed = true;
                        _logger.LogInformation($"DeleteForNoRefs {_fileName}");
                        Task.Run(async () =>
                        {
                            int retryCount = 0;
                            while (retryCount < 10)
                            {
                                retryCount++;
                                try { File.Delete(_fileName); break; }
                                catch { }
                                await Task.Delay(500);
                            }
                        });
                    }
                }
            }

            public class IncompleteWrappedStream : Stream
            {
                private readonly CacheEntryInfo _cei;
                private int _currentCompleteLen;

                private readonly object _stateLock = new object();
                private int _amountAlreadyRead = 0;
                private List<SemaphoreSlim> _readWaiters = new List<SemaphoreSlim>();
                private bool _isComplete = false;
                private bool _isFailed = false;

                public override bool CanRead => true;

                public override bool CanSeek => false;

                public override bool CanWrite => false;

                public override long Length => throw new InvalidOperationException("cannot get pending stream length");

                public override long Position { get => throw new InvalidOperationException(); set => throw new InvalidOperationException(); }

                public IncompleteWrappedStream(CacheEntryInfo cei, int initialCompleteLength)
                {
                    _cei = cei;
                    _currentCompleteLen = initialCompleteLength;
                }

                public void MarkProgressLength(int newCompletionLength)
                {
                    lock (_stateLock)
                    {
                        _currentCompleteLen = newCompletionLength;
                        AwakenWaiters();
                    }
                }

                public void MarkComplete()
                {
                    lock (_stateLock)
                    {
                        _isComplete = true;
                        AwakenWaiters();
                    }
                }

                public void MarkFailed()
                {
                    lock (_stateLock)
                    {
                        _isFailed = true;
                        AwakenWaiters();
                    }
                }

                private void AwakenWaiters()
                {
                    foreach (var x in _readWaiters)
                    {
                        x.Release();
                    }
                    _readWaiters.Clear();
                }

                public override void Flush()
                {
                }

                private int GetAvailableToRead() => _currentCompleteLen - _amountAlreadyRead;

                public override int Read(byte[] buffer, int offset, int count)
                {
                    var mem = new Memory<byte>(buffer, offset, count);
                    return ReadAsync(mem, CancellationToken.None).GetAwaiter().GetResult();
                }

                public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
                {
                    var mem = new Memory<byte>(buffer, offset, count);
                    return await ReadAsync(mem, cancellationToken);
                }

                public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
                {
                    SemaphoreSlim? waitSem = null;
                    int? amountReadable = null;

                    while (amountReadable == null)
                    {
                        lock (_stateLock)
                        {
                            var availableToRead = GetAvailableToRead();
                            if (availableToRead == 0 && _isComplete)
                            {
                                return 0;
                            }
                            if (_isFailed)
                            {
                                throw new InvalidOperationException();
                            }
                            if (availableToRead <= 0)
                            {
                                waitSem = new SemaphoreSlim(0);
                                _readWaiters.Add(waitSem);
                            }
                            else
                            {
                                amountReadable = availableToRead;
                            }
                        }
                        if (waitSem != null)
                        {
                            await waitSem.WaitAsync(cancellationToken);
                            waitSem.Dispose();
                        }
                    }

                    var amountToRead = Math.Min(amountReadable.Value, buffer.Length);
                    using (var fn = File.OpenRead(_cei._fileName))
                    {
                        int bytesRead = await fn.ReadAsync(buffer, cancellationToken);
                        lock (_stateLock)
                        {
                            _amountAlreadyRead += bytesRead;
                        }
                        return bytesRead;
                    }
                }

                public override long Seek(long offset, SeekOrigin origin) => throw new InvalidOperationException();

                public override void SetLength(long value) => throw new InvalidOperationException();

                public override void Write(byte[] buffer, int offset, int count) => throw new InvalidOperationException();
            }
        }
    }

    public class DisposeWrappedStream : Stream
    {
        private readonly Stream _inner;
        private readonly Action _onDispose;

        private bool _disposed = false;

        public DisposeWrappedStream(Stream inner, Action onDispose)
        {
            _inner = inner;
            _onDispose = onDispose;
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (!_disposed)
            {
                _disposed = true;
                _inner.Dispose();
                _onDispose.Invoke();
            }
        }

		public override async ValueTask DisposeAsync()
		{
			if (!_disposed)
			{
				_disposed = true;
				await _inner.DisposeAsync();
				_onDispose.Invoke();
			}
		}

		public override bool CanRead => _inner.CanRead;

        public override bool CanSeek => _inner.CanSeek;

        public override bool CanWrite => _inner.CanWrite;

        public override long Length => _inner.Length;

        public override long Position
        {
            get => _inner.Position;
            set => _inner.Position = value;
        }

        public override void Flush() => _inner.Flush();

        public override int Read(byte[] buffer, int offset, int count) => _inner.Read(buffer, offset, count);

        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
            => _inner.ReadAsync(buffer, offset, count, cancellationToken);

        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
            => _inner.ReadAsync(buffer, cancellationToken);

        public override long Seek(long offset, SeekOrigin origin) => _inner.Seek(offset, origin);

        public override void SetLength(long value) => _inner.SetLength(value);

        public override void Write(byte[] buffer, int offset, int count) => _inner.Write(buffer, offset, count);

        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
            => _inner.WriteAsync(buffer, offset, count, cancellationToken);

        public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default)
            => _inner.WriteAsync(buffer, cancellationToken);
    }

}
