using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppFileServer.ContentZip;
using XarChat.Backend.Features.MimeTypeMapper;

namespace XarChat.Backend.Features.AppFileServer.FileSystem
{
    internal class FileSystemAppFileServer : IAppFileServer
    {
        private readonly IMimeTypeMapper _mimeTypeMapper;
        private readonly string _baseDirectory;

        public FileSystemAppFileServer(
            IMimeTypeMapper mimeTypeMapper,
            string baseDirectory)
        {
            _mimeTypeMapper = mimeTypeMapper;
            _baseDirectory = baseDirectory;
        }

        public Task<IEnumerable<string>> ListFilesAsync(CancellationToken cancellationToken)
        {
            var baseDirFullName = new DirectoryInfo(_baseDirectory).FullName;

            var results = new List<string>();
            foreach (var filename in Directory.GetFiles(_baseDirectory, "*", SearchOption.AllDirectories))
            {
                var relPath = filename
                    .Substring(baseDirFullName.Length)
                    .TrimStart(new char[] { '/', '\\' })
                    .Replace('\\', '/');
                results.Add(relPath);
            }

            return Task.FromResult<IEnumerable<string>>(results);
        }

        public async Task<IResult> HandleRequestAsync(string relPath, CancellationToken cancellationToken)
        {
            var targetFn = Path.Combine(_baseDirectory, relPath);
            var fi = new FileInfo(targetFn);
            if (!fi.Exists ||
                !fi.FullName.StartsWith(_baseDirectory, StringComparison.OrdinalIgnoreCase)) 
            {
                return Results.NotFound();
            }

            Stream s = File.OpenRead(fi.FullName);
            s = await ContentZipAppFileServer.MaybeFixupStreamAsync(relPath, s, cancellationToken);

            return Results.File(s,
                contentType: _mimeTypeMapper.GetMimeType(fi.FullName),
                fileDownloadName: null,
                lastModified: fi.LastWriteTimeUtc);
        }

        public async Task<string> GetFileContentAsStringAsync(string relPath, CancellationToken cancellationToken)
        {
            var targetFn = Path.Combine(_baseDirectory, relPath);
            var fi = new FileInfo(targetFn);
            if (!fi.Exists ||
                !fi.FullName.StartsWith(_baseDirectory, StringComparison.OrdinalIgnoreCase))
            {
                return "";
            }
            else
            {
                using var fs = File.OpenRead(fi.FullName);
                using var ms = new MemoryStream();
                await fs.CopyToAsync(ms, cancellationToken);
                var result = System.Text.Encoding.UTF8.GetString(ms.ToArray());
                return result;
            }
        }
    }
}
