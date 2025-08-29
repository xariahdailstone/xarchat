using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.LocaleList
{
    public interface ILocaleList
    {
        Task<List<LocaleInfo>> EnumerateAvailableLocalesAsync(CancellationToken cancellationToken);
    }

    public class LocaleInfo
    {
        public required string Code { get; set; }

        public required string NativeName { get; set; }
    }
}
