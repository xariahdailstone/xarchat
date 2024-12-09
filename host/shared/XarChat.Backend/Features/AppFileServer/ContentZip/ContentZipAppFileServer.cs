using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.MimeTypeMapper;

namespace XarChat.Backend.Features.AppFileServer.ContentZip
{
    internal class ContentZipAppFileServer : IAppFileServer
    {
        private const string _resourceName = "content.dat";

        private readonly IMimeTypeMapper _mimeTypeMapper;

        private readonly Assembly _entryAssembly;
        private readonly string _resourceFullName;

        public ContentZipAppFileServer(
            IMimeTypeMapper mimeTypeMapper)
        {
            _mimeTypeMapper = mimeTypeMapper;

            _entryAssembly = Assembly.GetEntryAssembly()!;

            var q =
               from r in _entryAssembly.GetManifestResourceNames()
               where r.EndsWith(_resourceName, StringComparison.OrdinalIgnoreCase)
               select r;
            _resourceFullName = q.First();
        }

        private ZipArchive GetZipArchive()
        {
            var stream = _entryAssembly.GetManifestResourceStream(_resourceFullName)!;
            var za = new ZipArchive(new XorStream(stream));
            return za;
        }

        public async Task<IResult> HandleRequestAsync(string relPath, CancellationToken cancellationToken)
        {
            var za = GetZipArchive();

            ZipArchiveEntry? zae = null;
            foreach (var nameToTry in new string[] {
                relPath.Replace("/", "\\"),
                relPath.Replace("\\", "/"),
                "./" + relPath.Replace("\\", "/"),
                ".\\" + relPath.Replace("/", "\\"),
            })
            {
                zae = za.GetEntry(nameToTry);
                if (zae != null) 
                {
                    break;
                }
                else
                {
                    Console.WriteLine("got zip resource: " + nameToTry);
                }
            }

            //var zae = za.GetEntry(relPath.Replace("/", "\\"));
            if (zae != null)
            {
                var stream = zae.Open();

                var ext = Path.GetExtension(relPath).ToLower();
                var mimeType = _mimeTypeMapper.GetMimeType(ext);

                //var ms = new MemoryStream();
                //await stream.CopyToAsync(ms);
                //ms.Seek(0, SeekOrigin.Begin);

                var fresult = Results.File(
                    fileStream: stream,
                    //fileStream: ms,
                    contentType: mimeType,
                    fileDownloadName: null,
                    lastModified: DateTimeOffset.UtcNow,
                    entityTag: new Microsoft.Net.Http.Headers.EntityTagHeaderValue(GetETag(relPath), false),
                    enableRangeProcessing: true);
                var result = new CompletingResult(fresult, () => { stream.Dispose(); za.Dispose(); });
                return result;
            }
            else
            {
                Console.WriteLine("no zip resource: " + relPath);
                return Results.NotFound();
            }
        }

        public Task<IEnumerable<string>> ListFilesAsync(CancellationToken cancellationToken)
        {
            var za = GetZipArchive();
            var results = new List<string>();
            foreach (var entry in za.Entries)
            {
                var ename = entry.FullName.Replace("\\", "/");
                results.Add(ename);
            }
            return Task.FromResult<IEnumerable<string>>(results);
        }

        public async Task<string> GetFileContentAsStringAsync(string relPath, CancellationToken cancellationToken)
        {
            var za = GetZipArchive();
            
            ZipArchiveEntry? zae = null;
            foreach (var nameToTry in new string[] {
                relPath.Replace("/", "\\"),
                relPath.Replace("\\", "/"),
                "./" + relPath.Replace("\\", "/"),
                ".\\" + relPath.Replace("/", "\\"),
            })
            {
                zae = za.GetEntry(nameToTry);
                if (zae != null) 
                {
                    break;
                }
            }

            if (zae != null)
            {
                using var stream = zae.Open();
                using var ms = new MemoryStream();

                await stream.CopyToAsync(ms);
                //ms.Seek(0, SeekOrigin.Begin);

                var result = System.Text.Encoding.UTF8.GetString(ms.ToArray());
                return result;
            }
            else
            {
                return "";
            }
        }

        private class CompletingResult : IResult
        {
            private readonly IResult _inner;
            private readonly Action _onComplete;

            public CompletingResult(IResult inner, Action onComplete)
            {
                _inner = inner;
                _onComplete = onComplete;
            }

            public async Task ExecuteAsync(HttpContext httpContext)
            {
                await _inner.ExecuteAsync(httpContext);
                _onComplete?.Invoke();
            }
        }

        private string GetETag(string relPath)
        {
            const int LEN = 8;

            var hasher = SHA256.Create();
            var hash = hasher.ComputeHash(System.Text.Encoding.UTF8.GetBytes(relPath));
            var sb = new StringBuilder(LEN * 2 + 2);
            sb.Append('"');
            for (var i = 0; i < LEN; i++)
            {
                sb.Append(hash[i].ToString("x2"));
            }
            sb.Append('"');
            return sb.ToString();
        }
    }

    internal class XorStream : Stream
    {
        private readonly Stream _inner;

        public XorStream(Stream inner)
        {
            _inner = inner;
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            _inner.Dispose();
        }

        public override async ValueTask DisposeAsync()
        {
            await base.DisposeAsync();
            await _inner.DisposeAsync();
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

        public override int Read(byte[] buffer, int offset, int count)
        {
            var bytesRead = _inner.Read(buffer, offset, count);
            for (var i = 0; i < bytesRead; i++)
            {
                buffer[i] = (byte)(buffer[i] ^ (byte)69);
            }
            return bytesRead;
        }

        public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
        {
            var bytesRead = await _inner.ReadAsync(buffer, offset, count, cancellationToken);
            for (var i = 0; i < bytesRead; i++)
            {
                buffer[i] = (byte)(buffer[i] ^ (byte)69);
            }
            return bytesRead;
        }

        public override long Seek(long offset, SeekOrigin origin) => _inner.Seek(offset, origin);

        public override void SetLength(long value) => _inner.SetLength(value);

        public override void Write(byte[] buffer, int offset, int count)
        {
            var xorBuf = new byte[count];
            Array.Copy(buffer, offset, xorBuf, 0, count);
            for (var i = 0; i < xorBuf.Length; i++)
            {
                xorBuf[i] = (byte)(buffer[i] ^ (byte)69);
            }
            _inner.Write(xorBuf, 0, count);
        }
    }
}
