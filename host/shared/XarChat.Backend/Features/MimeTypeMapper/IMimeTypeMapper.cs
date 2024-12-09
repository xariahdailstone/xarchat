using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.MimeTypeMapper
{
    public interface IMimeTypeMapper
    {
        string GetMimeType(string filename);
    }
}
