using Microsoft.AspNetCore.Components.Forms;
using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;

namespace XarChat.Backend.Features.ChatLogging.PlainText.LogLineTypes
{
    internal abstract class LogLineBase
    {
        private static Regex LogLinePattern =
            new Regex(@"^(?<linetype>[CPDMARS])(?<time>\d{9})\?(?<payload>.+)$", RegexOptions.Compiled | RegexOptions.ExplicitCapture);

        public static bool TryDeserialize(
            DateOnly logFileDate,
            string? logLine, 
            [NotNullWhen(true)] out LogLineBase? result)
        {
            result = default;
            if (logLine is null || logLine.Length == 0) { return false; }

            var m = LogLinePattern.Match(logLine);
            if (!m.Success) { return false; }

            var lineType = m.Groups["linetype"].Value;
            var timeStr = m.Groups["time"].Value;
            var payloadStr = m.Groups["payload"].Value;

            if (!DateTime.TryParseExact(
                "20260101" + timeStr, 
                "yyyyMMddHHmmssfff", 
                null, 
                System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal,
                out var timestamp))
            {
                return false;
            }
            var logLineTime = TimeOnly.FromDateTime(timestamp);

            try
            {
                switch (lineType)
                {
                    case "C":
                        {
                            var r = ChannelHeaderLogLine.TryParsePayload(new LogLinePayload(payloadStr), out var res);
                            result = res;
                            return r;
                        }
                    case "P":
                        {
                            var r = PMConversationHeaderLogLine.TryParsePayload(new LogLinePayload(payloadStr), out var res);
                            result = res;
                            return r;
                        }
                    case "D":
                        {
                            var r = DefineCharacterLogLine.TryParsePayload(new LogLinePayload(payloadStr), out var res);
                            result = res;
                            return r;
                        }
                    case "M":
                        {
                            var r = ChatMessageLogLine.TryParsePayload(new LogLinePayload(payloadStr), out var res);
                            result = res;
                            return r;
                        }
                    case "A":
                        {
                            var r = AdMessageLogLine.TryParsePayload(new LogLinePayload(payloadStr), out var res);
                            result = res;
                            return r;
                        }
                    case "R":
                        {
                            var r = DiceRollLogLine.TryParsePayload(new LogLinePayload(payloadStr), out var res);
                            result = res;
                            return r;
                        }
                    case "S":
                        {
                            var r = BottleSpinLogLine.TryParsePayload(new LogLinePayload(payloadStr), out var res);
                            result = res;
                            return r;
                        }
                    default:
                        return false;
                }
            }
            finally
            {
                if (result is not null)
                {
                    result.Timestamp = new DateTime(logFileDate, logLineTime, DateTimeKind.Utc);
                }
            }
        }

        public static string Serialize(
            LogLineBase logLine)
        {
            var serData = logLine.GetSerializedData();
            var serDataStr = serData.Serialize();

            var sb = new StringBuilder(serDataStr.Length + 1 + 1 + 9);
            sb.Append(logLine.LogLineTypeChar);
            sb.Append(TimeOnly.FromDateTime(logLine.Timestamp).ToString("HHmmssfff"));
            sb.Append('?');
            sb.Append(serDataStr);
            return sb.ToString();
        }

        public abstract char LogLineTypeChar { get; }

        public DateTime Timestamp { get; set; }

        protected abstract LogLinePayload GetSerializedData();
    }

    internal class LogLinePayload : List<KeyValuePair<string, string>>
    {
        public LogLinePayload()
        {
        }

        public LogLinePayload(string serializedPayload)
        {
            foreach (var serializedPair in serializedPayload.Split('&'))
            {
                var eqPos = serializedPair.IndexOf('=');
                if (eqPos > 0)
                {
                    var keyEncoded = serializedPair.Substring(0, eqPos);
                    var valueEncoded = serializedPair.Substring(eqPos + 1);

                    var key = HttpUtility.UrlDecode(keyEncoded);
                    var value = HttpUtility.UrlDecode(valueEncoded);
                    this.Add(new(key, value));
                }
            }
        }

        public void Add(string key, string value)
            => this.Add(new(key, value));

        public bool ContainsKey(string key)
        {
            foreach (var kvp in this)
            {
                if (kvp.Key == key)
                {
                    return true; 
                }
            }
            return false;
        }

        public bool TryGetByKey(string key, [NotNullWhen(true)] out string? value)
        {
            foreach (var kvp in this)
            {
                if (kvp.Key == key)
                {
                    value = kvp.Value;
                    return true;
                }
            }
            value = null;
            return false;
        }

        public string Serialize()
        {
            var sb = new StringBuilder();
            foreach (var kvp in this)
            {
                if (sb.Length > 0)
                {
                    sb.Append('&');
                }
                sb.Append(HttpUtility.UrlEncode(kvp.Key));
                sb.Append('=');
                sb.Append(HttpUtility.UrlEncode(kvp.Value));
            }
            return sb.ToString();
        }
    }

    internal abstract class HeaderLogLineBase : LogLineBase
    {
        public int FileVersion { get; set; }

        public DateOnly LogFileDate { get; set; }

        protected static bool TryParsePayload<T>(LogLinePayload payload, [NotNullWhen(true)] out T? result)
            where T : HeaderLogLineBase, new()
        {
            if (payload.TryGetByKey("v", out var vStr) 
                && payload.TryGetByKey("d", out var dStr)
                && Int32.TryParse(vStr, out var vInt)
                && DateOnly.TryParseExact(dStr, "yyyyMMdd", null, System.Globalization.DateTimeStyles.None, out var dDate))
            {
                result = new T();
                result.FileVersion = vInt;
                result.LogFileDate = dDate;
                return true;
            }
            else
            {
                result = default;
                return false;
            }
        }

        protected override LogLinePayload GetSerializedData()
        {
            return [
                new ("v", this.FileVersion.ToString()),
                new ("d", this.LogFileDate.ToString("yyyyMMdd"))
            ];
        }
    }

    internal class ChannelHeaderLogLine : HeaderLogLineBase
    {
        public static bool TryParsePayload(LogLinePayload payload, [NotNullWhen(true)] out ChannelHeaderLogLine? logLine)
        {
            if (HeaderLogLineBase.TryParsePayload<ChannelHeaderLogLine>(payload, out logLine))
            {
                if (payload.TryGetByKey("cn", out var cnStr)
                    && payload.TryGetByKey("ct", out var ctStr))
                {
                    logLine.ChannelName = cnStr;
                    logLine.ChannelTitle = ctStr;
                    return true;
                }
            }

            logLine = default;
            return false;
        }

        public override char LogLineTypeChar => 'C';

        public string ChannelName { get; set; } = "";

        public string ChannelTitle { get; set; } = "";

        protected override LogLinePayload GetSerializedData()
        {
            var result = base.GetSerializedData();
            result.Add(new("cn", this.ChannelName));
            result.Add(new("ct", this.ChannelTitle));
            return result;
        }
    }

    internal class PMConversationHeaderLogLine : HeaderLogLineBase
    {
        public static bool TryParsePayload(LogLinePayload payload, [NotNullWhen(true)] out PMConversationHeaderLogLine? logLine)
        {
            if (HeaderLogLineBase.TryParsePayload<PMConversationHeaderLogLine>(payload, out logLine))
            {
                if (payload.TryGetByKey("pm", out var pmStr)
                    && payload.TryGetByKey("pt", out var ptStr))
                {
                    logLine.MyCharacterName = pmStr;
                    logLine.TheirCharacterName = ptStr;
                    return true;
                }
            }

            logLine = default;
            return false;
        }

        public override char LogLineTypeChar => 'P';

        public string MyCharacterName { get; set; } = "";

        public string TheirCharacterName { get; set; } = "";

        protected override LogLinePayload GetSerializedData()
        {
            var result = base.GetSerializedData();
            result.Add(new("pm", this.MyCharacterName));
            result.Add(new("pt", this.TheirCharacterName));
            return result;
        }
    }

    internal class DefineCharacterLogLine : LogLineBase
    {
        public static bool TryParsePayload(LogLinePayload payload, [NotNullWhen(true)] out DefineCharacterLogLine? logLine)
        {
            if (payload.TryGetByKey("c", out var cStr)
                && payload.TryGetByKey("g", out var gStr))
            {
                logLine = new DefineCharacterLogLine();
                logLine.ShortCode = cStr;
                logLine.Gender = gStr;

                if (payload.TryGetByKey("n", out var nStr))
                {
                    logLine.CharacterName = nStr;
                }

                return true;
            }

            logLine = default;
            return false;
        }

        public override char LogLineTypeChar => 'D';

        public string ShortCode { get; set; } = "";

        public string? CharacterName { get; set; }

        public string Gender { get; set; } = "";

        protected override LogLinePayload GetSerializedData()
        {
            LogLinePayload result = [
                new ("c", this.ShortCode),
                new ("g", this.Gender)
            ];
            if (this.CharacterName is not null)
            {
                result.Add("n", this.CharacterName);
            }
            return result;
        }
    }

    internal abstract class MessageLogLine : LogLineBase
    {
        protected static bool TryParsePayload<T>(LogLinePayload payload, [NotNullWhen(true)] out T? result)
            where T : MessageLogLine, new()
        {
            if (payload.TryGetByKey("s", out var sStr))
            {
                result = new T();
                result.SpeakerShortCode = sStr;
                return true;
            }

            result = default;
            return false;
        }

        public string SpeakerShortCode { get; set; } = "";

        protected override LogLinePayload GetSerializedData()
        {
            return [
                new ("s", this.SpeakerShortCode)
            ];
        }
    }

    internal class ChatMessageLogLine : MessageLogLine
    {
        public static bool TryParsePayload(LogLinePayload payload, [NotNullWhen(true)] out ChatMessageLogLine? result)
        {
            if (MessageLogLine.TryParsePayload<ChatMessageLogLine>(payload, out result))
            {
                if (payload.TryGetByKey("m", out var mStr))
                {
                    result.MessageText = mStr;
                    return true;
                }
            }

            result = default;
            return false;
        }

        public override char LogLineTypeChar => 'M';

        public string MessageText { get; set; } = "";

        protected override LogLinePayload GetSerializedData()
        {
            var result = base.GetSerializedData();
            result.Add("m", this.MessageText);
            return result;
        }
    }

    internal class AdMessageLogLine : MessageLogLine
    {
        public static bool TryParsePayload(LogLinePayload payload, [NotNullWhen(true)] out AdMessageLogLine? result)
        {
            if (MessageLogLine.TryParsePayload<AdMessageLogLine>(payload, out result))
            {
                if (payload.TryGetByKey("m", out var mStr))
                {
                    result.MessageText = mStr;
                    result.IsRepeatedAd = false;
                    return true;
                }
                else if (payload.TryGetByKey("r", out var rStr) && rStr == "1")
                {
                    result.MessageText = "";
                    result.IsRepeatedAd = true;
                    return true;
                }
            }

            result = default;
            return false;
        }

        public override char LogLineTypeChar => 'M';

        public string MessageText { get; set; } = "";

        public bool IsRepeatedAd { get; set; } = false;

        protected override LogLinePayload GetSerializedData()
        {
            var result = base.GetSerializedData();
            if (this.IsRepeatedAd)
            {
                result.Add("r", "1");
            }
            else
            {
                result.Add("m", this.MessageText);
            }
            return result;
        }
    }

    internal class DiceRollLogLine : LogLineBase
    {
        public static bool TryParsePayload(LogLinePayload payload, [NotNullWhen(true)] out DiceRollLogLine? result)
        {
            if (payload.TryGetByKey("s", out var sStr)
                && payload.TryGetByKey("x", out var xStr)
                && payload.TryGetByKey("i", out var iStr)
                && payload.TryGetByKey("r", out var rStr)
                && TryParseIndividualResults(iStr, out var iList)
                && Int32.TryParse(rStr, out var rInt))
            {
                result = new DiceRollLogLine()
                {
                    SpeakerShortCode = sStr,
                    DiceExpression = xStr,
                    IndividualResults = iList,
                    EndResult = rInt
                };
                return true;
            }

            result = default;
            return false;
        }

        private static bool TryParseIndividualResults(string iStr, [NotNullWhen(true)] out List<int>? iList)
        {
            if (String.IsNullOrWhiteSpace(iStr)) 
            {
                iList = [];
                return true;
            }
            var parts = iStr.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                .Select(x =>
                {
                    var success = Int32.TryParse(x, out var value);
                    return (success, value);
                })
                .ToList();

            if (parts.Any(x => !x.success)) 
            {
                iList = default;
                return false; 
            }

            iList = parts.Select(x => x.value!).ToList();
            return true;
        }

        public override char LogLineTypeChar => 'R';

        public string SpeakerShortCode { get; set; } = "";

        public string DiceExpression { get; set; } = "";

        public List<int> IndividualResults { get; set; } = [];

        public int EndResult { get; set; } = 0;

        protected override LogLinePayload GetSerializedData()
        {
            return [
                new("s", this.SpeakerShortCode),
                new("x", this.DiceExpression),
                new("i", String.Join(",", this.IndividualResults.Select(x => x.ToString()))),
                new("r", this.EndResult.ToString())
            ];
        }
    }

    internal class BottleSpinLogLine : LogLineBase
    {
        public static bool TryParsePayload(LogLinePayload payload, [NotNullWhen(true)] out BottleSpinLogLine? result)
        {
            if (payload.TryGetByKey("s", out var sStr)
                && payload.TryGetByKey("t", out var tStr))
            {
                result = new BottleSpinLogLine()
                {
                    SpinnerShortCode = sStr,
                    TargetShortCode = tStr
                };
                return true;
            }

            result = default;
            return false;
        }

        public override char LogLineTypeChar => 'S';

        public string SpinnerShortCode { get; set; } = "";

        public string TargetShortCode { get; set; } = "";

        protected override LogLinePayload GetSerializedData()
        {
            return [
                new ("s", this.SpinnerShortCode),
                new ("t", this.TargetShortCode)
            ];
        }
    }
}
