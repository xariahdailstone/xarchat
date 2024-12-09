using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.AppSettings;

namespace XarChat.Backend.Win32.DataProtection
{
    internal class Win32AppSettingsDataProtectionManager : IAppSettingsDataProtectionManager
    {
        static byte[] _additionalEntropy = { 9, 8, 7, 6, 5 };

        public string? Decode(string? encodedValue)
        {
            if (encodedValue == null) return null;
            try
            {
                var protectedData = Convert.FromBase64String(encodedValue);
                var rawData = ProtectedData.Unprotect(protectedData, _additionalEntropy, DataProtectionScope.CurrentUser);
                var rawStr = System.Text.Encoding.UTF8.GetString(rawData);
                return rawStr;
            }
            catch
            {
                return null;
            }
        }

        public string? Encode(string? rawValue)
        {
            if (rawValue == null) return null;

            var rawData = System.Text.Encoding.UTF8.GetBytes(rawValue);
            var protectedData = ProtectedData.Protect(rawData, _additionalEntropy, DataProtectionScope.CurrentUser);
            return Convert.ToBase64String(protectedData);
        }
    }
}
