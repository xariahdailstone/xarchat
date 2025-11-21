using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.LocaleList;
using XarChat.Native.Win32;

namespace XarChat.Backend.Win32.LocaleList
{
    internal class Win32LocaleList : ILocaleList
    {
        public Task<List<LocaleInfo>> EnumerateAvailableLocalesAsync(CancellationToken cancellationToken)
        {
            var result = new List<LocaleInfo>();
            foreach (var locale in WinNLS.EnumSystemLocalesEx())
            {
                var nativeName = WinNLS.GetLocaleInfoEx(locale, WinNLS.LocaleInfoType.NativeDisplayName);
                result.Add(new LocaleInfo() { Code = locale, NativeName = nativeName });
            }
            return Task.FromResult(result);
        }
    }
}
