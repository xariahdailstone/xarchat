using XarChat.Backend.Features.AppSettings;

namespace XarChat.Backend.Mac.AppSettingsDataProtectionManager
{
    public class MacAppSettingsDataProtectionManager : IAppSettingsDataProtectionManager
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