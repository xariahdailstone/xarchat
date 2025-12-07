using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace XarChat.FList2.FList2Api.Entities
{
    [JsonConverter(typeof(CharacterStatus.CharacterStatusJsonConverter))]
    public record CharacterStatus(string CodeValue)
    {
        public static CharacterStatus OFFLINE = new CharacterStatus("OFFLINE", "Offline");
        public static CharacterStatus ONLINE = new CharacterStatus("ONLINE", "Online");
        public static CharacterStatus AWAY = new CharacterStatus("AWAY", "Away");
        public static CharacterStatus BUSY = new CharacterStatus("BUSY", "Busy");
        public static CharacterStatus LOOKING = new CharacterStatus("LOOKING", "Looking");
        public static CharacterStatus DND = new CharacterStatus("DND", "Do Not Disturb");

        public static CharacterStatus[] DefinedValues = [
            OFFLINE, ONLINE, AWAY, BUSY, LOOKING, DND
        ];

        public static CharacterStatus Parse(string codeStr)
        {
            foreach (var defV in DefinedValues)
            {
                if (String.Equals(defV.CodeValue, codeStr, StringComparison.OrdinalIgnoreCase))
                {
                    return defV;
                }
            }

            return new CharacterStatus(codeStr, codeStr);
        }

        public CharacterStatus(string codeValue, string displayName)
            : this(codeValue)
        {
            this.DisplayName = displayName;
        }

        public string DisplayName
        {
            get => field ?? this.CodeValue;
            private set => field = value;
        }

        public class CharacterStatusJsonConverter : JsonConverter<CharacterStatus>
        {
            public override CharacterStatus? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            {
                var str = reader.GetString();
                var pi = str is not null
                    ? typeof(CharacterStatus).GetProperty(str, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)
                    : null;
                if (pi is not null)
                {
                    return (CharacterStatus)pi.GetValue(null)!;
                }
                else if (str is not null)
                {
                    return CharacterStatus.Parse(str);
                }
                else
                {
                    return null;
                }
            }

            public override void Write(Utf8JsonWriter writer, CharacterStatus value, JsonSerializerOptions options)
            {
                writer.WriteStringValue(value.CodeValue);
            }
        }
    }

    [JsonConverter(typeof(CharacterGender.CharacterGenderJsonConverter))]
    public record CharacterGender(string CodeValue)
    {
        public const string UnknownGenderColor = "#7676BB";

        public static CharacterGender MALE = new CharacterGender("male", "Male", "#6699FF");
        public static CharacterGender FEMALE = new CharacterGender("female", "Female", "#FF6699");
        public static CharacterGender TRANSGENDER = new CharacterGender("transgender", "Transgender", "#EE8822");
        public static CharacterGender HERM = new CharacterGender("herm", "Herm", "#9B30FF");
        public static CharacterGender MALEHERM = new CharacterGender("maleherm", "Male Herm", "#007FFF");
        public static CharacterGender CUNTBOY = new CharacterGender("cuntboy", "Cuntboy", "#00CC66");
        public static CharacterGender SHEMALE = new CharacterGender("shemale", "Shemale", "#CC66FF");
        public static CharacterGender MALETRANS = new CharacterGender("maletrans", "Male Trans", "#5BCEFA");
        public static CharacterGender FEMALETRANS = new CharacterGender("femaletrans", "Female Trans", "#F5A9BA");
        public static CharacterGender INTERSEX = new CharacterGender("intersex", "Intersex", "#AE9487");
        public static CharacterGender NONBINARY = new CharacterGender("nonbinary", "Nonbinary", "#16B78E");
        public static CharacterGender UNKNOWN = new CharacterGender("Unknown", "Unknown", UnknownGenderColor);

        public static CharacterGender[] PredefinedValues = [
            MALE, FEMALE, TRANSGENDER, HERM, MALEHERM, CUNTBOY, SHEMALE, MALETRANS, FEMALETRANS, INTERSEX, NONBINARY, UNKNOWN
        ];

        public static CharacterGender Parse(string codeStr)
        {
            foreach (var x in PredefinedValues)
            {
                if (String.Equals(x.CodeValue, codeStr, StringComparison.OrdinalIgnoreCase)
                    || String.Equals(x.GenderColor, codeStr, StringComparison.OrdinalIgnoreCase))
                {
                    return x;
                }
            }
            return UNKNOWN;
        }

        public CharacterGender(string codeValue, string displayName, string genderColor)
            : this(codeValue)
        {
            this.DisplayName = displayName;
            this.GenderColor = genderColor;
        }

        public string DisplayName
        {
            get => field ?? this.CodeValue;
            private set => field = value;
        }

        public string GenderColor
        {
            get => field ?? UnknownGenderColor;
            private set => field = value;
        }

        public class CharacterGenderJsonConverter : JsonConverter<CharacterGender>
        {
            public override CharacterGender? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            {
                var str = reader.GetString();
                var pi = str is not null
                    ? typeof(CharacterGender).GetProperty(str, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)
                    : null;
                if (pi is not null)
                {
                    return (CharacterGender)pi.GetValue(null)!;
                }
                else if (str is not null)
                {
                    return new CharacterGender(str);
                }
                else
                {
                    return null;
                }
            }

            public override void Write(Utf8JsonWriter writer, CharacterGender value, JsonSerializerOptions options)
            {
                writer.WriteStringValue(value.CodeValue);
            }
        }
    }
}