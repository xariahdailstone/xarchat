using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Windows.Wdk;
using Windows.Win32.Globalization;

namespace XarChat.Native.Win32
{
    public static class WinNLS
    {
        public static List<string> EnumSystemLocalesEx()
        {
            var result = new List<string>();

            Windows.Win32.PInvoke.EnumUILanguages(
                lpUILanguageEnumProc: (param0, param1) =>
                {
                    var languageName = param0.ToString();
                    result.Add(languageName);
                    return true;
                },
                dwFlags: MUI_LANGUAGE_KIND.MUI_LANGUAGE_NAME,
                lParam: 0);

            //Windows.Win32.PInvoke.EnumSystemLocalesEx(
            //    lpLocaleEnumProcEx: (dwLocaleName, flags, param) => 
            //    {
            //        result.Add(dwLocaleName.ToString());
            //        return true;
            //    }, 
            //    dwFlags: LOCALETYPE.LOCALE_ALL, 
            //    lParam: 0);

            return result;
        }

        public static class MUI_LANGUAGE_KIND
        {
            public const uint MUI_LANGUAGE_ID = 0x4; // enumerate all named based locales
            public const uint MUI_LANGUAGE_NAME = 0x8; // enumerate all named based locales

        }
        //public static class LOCALETYPE
        //{
        //    public const uint LOCALE_ALL = 0x00000000; // enumerate all named based locales
        //    public const uint LOCALE_WINDOWS = 0x00000001; // shipped locales and/or replacements for them
        //    public const uint LOCALE_SUPPLEMENTAL = 0x00000002; // supplemental locales only
        //    public const uint LOCALE_ALTERNATE_SORTS = 0x00000004; // alternate sort locales
        //    public const uint LOCALE_NEUTRALDATA = 0x00000010; // Locales that are "neutral" (language only, region data is default)
        //    public const uint LOCALE_SPECIFICDATA = 0x00000020; // Locales that contain language and region data
        //}
    }
}
