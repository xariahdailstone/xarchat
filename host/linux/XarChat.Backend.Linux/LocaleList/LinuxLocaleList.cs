using System;
using System.Collections.Generic;
using System.Text;
using XarChat.Backend.Features.LocaleList;

namespace XarChat.Backend.Linux.LocaleList
{
    internal class LinuxLocaleList : ILocaleList
    {
        public async Task<List<LocaleInfo>> EnumerateAvailableLocalesAsync(CancellationToken cancellationToken)
        {
            // TODO:
            return [];
        }
    }
}
