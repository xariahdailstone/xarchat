using XarChat.Backend.Features.AppSettings;

namespace XarChat.Backend.Linux.AppSettingsDataProtectionManager
{
    public class LinuxAppSettingsDataProtectionManager : IAppSettingsDataProtectionManager
    {
        public string? Decode(string? encodedValue)
        {
            // TODO:
            return encodedValue;
        }

        public string? Encode(string? rawValue)
        {
            // TODO:
            return rawValue;
        }
    }
}