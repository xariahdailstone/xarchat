using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.MimeTypeMapper.Impl
{
    public class MimeTypeMapperImpl : IMimeTypeMapper
    {
        private static readonly Dictionary<string, string> MimeTypeMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { ".js", "text/javascript" },
            { ".css", "text/css" },
            { ".html", "text/html" },
            { ".jpg", "image/jpeg" },
            { ".jpeg", "image/jpeg" },
            { ".gif", "image/gif" },
            { ".png", "image/png" },
            { ".svg", "image/svg+xml" },
            { ".mp3", "audio/mpeg" }
        };

        public string GetMimeType(string filename)
        {
            var ext = Path.GetExtension(filename);
            if (MimeTypeMap.TryGetValue(ext, out var mimeType))
            {
                return mimeType;
            }
            else
            {
                return "application/octet-stream";
            }
        }
    }
}
