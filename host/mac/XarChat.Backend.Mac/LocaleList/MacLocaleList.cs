using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.LocaleList;

namespace XarChat.Backend.Mac.LocaleList
{
    internal class MacLocaleList : ILocaleList
    {
        public async Task<List<LocaleInfo>> EnumerateAvailableLocalesAsync(CancellationToken cancellationToken)
        {
            // TODO:
            return [];
        }
    }
}
