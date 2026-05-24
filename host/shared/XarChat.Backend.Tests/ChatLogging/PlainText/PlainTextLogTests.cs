using XarChat.Backend.Features.ChatLogging.PlainText.LogLineTypes;

namespace XarChat.Backend.Tests.ChatLogging.PlainText
{
    [TestClass]
    public sealed class PlainTextLogTests
    {
        [TestMethod]
        public async Task SimpleParse()
        {
            var cancellationToken = CancellationToken.None;

            using var testLogFile = new TempLogFile([
                "C000000000?v=1&d=20260524&cn=ADH-1234123412341234&ct=Test+Log+Channel",
                "D000001000?c=1&n=Test+Character&g=male",
                "M000001000?s=1&m=This+is+a+test+message.",
            ]);

            var lls = await TextLogFile.EnumerateAsync(testLogFile.Filename, cancellationToken).ToListAsync(cancellationToken);

            Assert.HasCount(3, lls);
            Assert.IsInstanceOfType<ResolvedChannelHeaderLogFileLine>(lls[0]);
            Assert.IsInstanceOfType<ResolvedDefineLogFileLine>(lls[1]);
            Assert.IsInstanceOfType<ResolvedChatMessageLogFileLine>(lls[2]);

            var hdrLine = (ResolvedChannelHeaderLogFileLine)lls[0];
            Assert.AreEqual(1, hdrLine.FileVersion);
            Assert.AreEqual(new DateOnly(2026, 5, 24), hdrLine.LogFileDate);
            Assert.AreEqual("ADH-1234123412341234", hdrLine.ChannelName);
            Assert.AreEqual("Test Log Channel", hdrLine.ChannelTitle);
            Assert.AreEqual(new DateTime(2026, 5, 24, 0, 0, 0, DateTimeKind.Utc), hdrLine.Timestamp);

            var defLine = (ResolvedDefineLogFileLine)lls[1];
            Assert.AreEqual("1", defLine.ShortCode);
            Assert.AreEqual("Test Character", defLine.CharacterName);
            Assert.AreEqual("male", defLine.Gender);
            Assert.AreEqual(new DateTime(2026, 5, 24, 0, 0, 1, DateTimeKind.Utc), defLine.Timestamp);

            var msgLine = (ResolvedChatMessageLogFileLine)lls[2];
            Assert.AreEqual("Test Character", msgLine.Speaker);
            Assert.AreEqual("male", msgLine.SpeakerGender);
            Assert.AreEqual("This is a test message.", msgLine.TextMessage);
            Assert.AreEqual(new DateTime(2026, 5, 24, 0, 0, 1, DateTimeKind.Utc), msgLine.Timestamp);
        }

        [TestMethod]
        public async Task SimpleCreate()
        {
            var cancellationToken = CancellationToken.None;

            var fn = Path.GetTempFileName();
            try
            {
                var testDate = new DateOnly(2026, 5, 24);
                await using (var tlf = await TextLogFile.CreateChannelLogFileAsync(fn,
                    testDate, "ADH-123412341234", "My Test Channel", cancellationToken))
                {
                    await tlf.WriteChatMessageAsync(
                        new DateTime(testDate, new TimeOnly(0, 1)),
                        "Test Speaking Char",
                        "male",
                        "This is a test message!",
                        cancellationToken);

                    await tlf.WriteChatMessageAsync(
                        new DateTime(testDate, new TimeOnly(0, 2)),
                        "Test Speaking Char",
                        "female",
                        "This is another test message!",
                        cancellationToken);
                }

                var fContentLines = await TextLogFile.EnumerateAsync(fn, cancellationToken).ToListAsync(cancellationToken);
                AssertLogLines(
                    [
                        new ResolvedChannelHeaderLogFileLine(
                            Timestamp: new DateTime(testDate, new TimeOnly(0, 0), DateTimeKind.Utc), 
                            FileVersion: 1, 
                            LogFileDate: testDate,
                            LogFileType: TextLogFileType.Channel,
                            ChannelName: "ADH-123412341234",
                            ChannelTitle: "My Test Channel"),
                        new ResolvedDefineLogFileLine(
                            Timestamp: new DateTime(testDate, new TimeOnly(0, 1), DateTimeKind.Utc),
                            ShortCode: "1",
                            CharacterName: "Test Speaking Char",
                            Gender: "male"),
                        new ResolvedChatMessageLogFileLine(
                            Timestamp: new DateTime(testDate, new TimeOnly(0, 1), DateTimeKind.Utc),
                            Speaker: "Test Speaking Char",
                            SpeakerGender: "male",
                            TextMessage: "This is a test message!"),
                        new ResolvedDefineLogFileLine(
                            Timestamp: new DateTime(testDate, new TimeOnly(0, 2), DateTimeKind.Utc),
                            ShortCode: "1",
                            CharacterName: "Test Speaking Char",
                            Gender: "female"),
                        new ResolvedChatMessageLogFileLine(
                            Timestamp: new DateTime(testDate, new TimeOnly(0, 1), DateTimeKind.Utc),
                            Speaker: "Test Speaking Char",
                            SpeakerGender: "female",
                            TextMessage: "This is another test message!"),
                    ],
                    fContentLines);
            }
            finally
            {
                TryDeleteFile(fn);
            }
        }

        private void TryDeleteFile(string filename)
        {
            try
            {
                File.Delete(filename);
            }
            catch { }
        }

        private void AssertLogLines(List<IResolvedLogFileLine> expected, List<IResolvedLogFileLine> logFileLines)
        {
            Assert.HasCount(expected.Count, logFileLines);
            for (var i = 0; i < expected.Count; i++)
            {
                var expectedEntry = expected[i];
                var logLine = logFileLines[i];

                Assert.AreEqual(expectedEntry.GetType(), logLine.GetType());
            }
        }

        private class TempLogFile : IDisposable
        {
            private readonly string _filename;

            public TempLogFile(params string[] contentLines)
            {
                _filename = Path.GetTempFileName();
                using (var w = File.CreateText(_filename))
                {
                    foreach (var contentLine in contentLines)
                    {
                        w.Write(contentLine);
                        w.Write("\n");
                    }
                }
            }

            public void Dispose()
            {
                try
                {
                    File.Delete(_filename);
                }
                catch { }
            }

            public string Filename => _filename;
        }
    }
}
