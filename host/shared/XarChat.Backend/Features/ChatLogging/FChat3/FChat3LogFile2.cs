using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.ChatLogging.FChat3
{
    public record FChat3Message(DateTime Timestamp, FChat3MessageType Type, string Sender, string Text)
    {
        public override string ToString()
        {
            return $"[{Timestamp}]({Type}) {Sender}: {Text}";
        }
    }

    public record FChat3FileSourcedMessage(
        string Filename, uint FilePosition,
        DateTime Timestamp, FChat3MessageType Type, string Sender, string Text)
        : FChat3Message(Timestamp, Type, Sender, Text);

    public record FChat3SourcedMessage(
        string Filename, uint FilePosition,
        string MyCharacterName, string LogTarget, DateTime Timestamp, 
        FChat3MessageType Type, string Sender, string Text)
    {
        public override string ToString()
        {
            return $"[{Timestamp}]({Type}) {Sender}: {Text}";
        }
    }

    public enum FChat3MessageType : byte
    {
        Message = 0,
        Action = 1,
        Ad = 2,
        Roll = 3,
        Warn = 4,
        Event = 5,
        Broadcast = 6
    }

    public record struct FChat3LogIndexEntry(DateTime Date, uint FileOffset)
    {
        public override string ToString()
        {
            return $"[{Date.ToShortDateString()}, @{FileOffset}]";
        }
    }

    public class FChat3LogIndex : IDisposable
    {
        private readonly Stream _stream;

        public FChat3LogIndex(string filename)
            : this(File.OpenRead(filename))
        {
        }

        public FChat3LogIndex(Stream stream)
        {
            _stream = stream;

            _stream.Seek(0, SeekOrigin.Begin);
            var nameLength = _stream.ReadByte();
            var nameBytes = new byte[nameLength];
            _stream.ReadExactly(nameBytes, 0, nameLength);

            this.Name = System.Text.Encoding.UTF8.GetString(nameBytes);
            _recordsStartAt = _stream.Position;
        }

        public void Dispose()
        {
            _stream.Dispose();
        }

        public string Name { get; }

        private long _recordsStartAt;

        // The index file is a file with the following format:
        //
        // HEADER (at start of file)
        // 1 byte -> offset
        // (offset) bytes -> name (in UTF-8 encoding)
        //
        // RECORD (7 byte length)
        // 2 bytes -> uint16 date (unix timestamp / 86400)
        // 4 bytes -> uint32 offset (byte offset into main file)

        public IEnumerable<FChat3LogIndexEntry> EnumerateLogIndexEntries()
        {
            _stream.Seek(_recordsStartAt, SeekOrigin.Begin);

            var fileLen = _stream.Length;
            while (_stream.Position + 7 <= fileLen)
            {
                var recordBytes = new byte[7];
                _stream.ReadExactly(recordBytes, 0, recordBytes.Length);
                var keyValue = BinaryPrimitives.ReadUInt16LittleEndian(new ReadOnlySpan<byte>(recordBytes, 0, 2));
                var offsetValue = BinaryPrimitives.ReadUInt32LittleEndian(new ReadOnlySpan<byte>(recordBytes, 2, 4));
                yield return new FChat3LogIndexEntry(
                    DateTimeOffset.FromUnixTimeSeconds(keyValue * 86400).Date,
                    offsetValue);
            }
        }
    }

    public enum EnumerationDirection
    {
        Forward,
        Backward
    }

    public class FChat3LogFile2 : IDisposable
    {
        private readonly Stream _stream;

        public FChat3LogFile2(string filename)
            : this(File.OpenRead(filename))
        {
        }

        public FChat3LogFile2(Stream stream)
        {
            _stream = stream;
        }

        public void Dispose()
        {
            _stream.Dispose();
        }

        public IEnumerable<FChat3Message> EnumerateMessages(EnumerationDirection enumerationDirection,
            uint? startAt = null)
        {
            if (startAt == null)
            {
                switch (enumerationDirection)
                {
                    default:
                    case EnumerationDirection.Forward:
                        startAt = 0;
                        break;
                    case EnumerationDirection.Backward:
                        startAt = (uint)_stream.Length;
                        break;
                }
            }

            _stream.Position = (long)startAt;
            switch (enumerationDirection)
            {
                default:
                case EnumerationDirection.Forward:
                    return EnumerateForward();
                case EnumerationDirection.Backward:
                    return EnumerateBackward();
            }
        }

        private IEnumerable<FChat3Message> EnumerateForward()
        {
            var streamLength = _stream.Length;
            while (_stream.Position < streamLength)
            {
                var time = ReadUInt32();
                var type = ReadByte();
                var sender = ReadBytePrefixedString();
                var message = ReadUInt16PrefixedString();
                var recordLength = ReadUInt16();
                yield return new FChat3Message(
                    DateTimeOffset.FromUnixTimeSeconds(time).DateTime, (FChat3MessageType)type, sender, message);
            }
        }


        private IEnumerable<FChat3Message> EnumerateBackward()
        {
            while (_stream.Position > 2)
            {
                var spos = _stream.Position;

                _stream.Position = spos - 2;
                var recordLength = ReadUInt16();

                _stream.Position = spos - recordLength - 2;
                var time = ReadUInt32();
                var type = ReadByte();
                var sender = ReadBytePrefixedString();
                var message = ReadUInt16PrefixedString();

                _stream.Position = spos - recordLength - 2;

                yield return new FChat3Message(
                    DateTimeOffset.FromUnixTimeSeconds(time).DateTime, (FChat3MessageType)type, sender, message);
            }
        }

        private byte ReadByte()
        {
            return (byte)_stream.ReadByte();
        }

        private string ReadBytePrefixedString()
        {
            var len = ReadByte();
            var buf = new byte[len];
            _stream.ReadExactly(buf, 0, len);
            return System.Text.Encoding.UTF8.GetString(buf);
        }

        private string ReadUInt16PrefixedString()
        {
            var len = ReadUInt16();
            var buf = new byte[len];
            _stream.ReadExactly(buf, 0, len);
            return System.Text.Encoding.UTF8.GetString(buf);
        }

        private ushort ReadUInt16()
        {
            var buf = new byte[2];
            _stream.ReadExactly(buf, 0, 2);
            return BinaryPrimitives.ReadUInt16LittleEndian(buf);
        }

        private uint ReadUInt32()
        {
            var buf = new byte[4];
            _stream.ReadExactly(buf, 0, 4);
            return BinaryPrimitives.ReadUInt32LittleEndian(buf);
        }
    }

    public class FChat3LogFilePair
    {
        private readonly string _logFileBaseName;

        public FChat3LogFilePair(string logFileBaseName)
        {
            _logFileBaseName = logFileBaseName;
        }

        private FChat3LogIndex OpenIndex()
        {
            return new FChat3LogIndex(_logFileBaseName + ".idx");
        }

        private FChat3LogFile2 OpenDataFile()
        {
            return new FChat3LogFile2(_logFileBaseName);
        }

        public IEnumerable<FChat3Message> EnumerateMessages(DateTime startAt, DateTime endAt)
        {
            if (endAt > startAt)
            {
                return EnumerateMessagesForward(startAt, endAt);
            }
            else
            {
                return EnumerateMessagesBackward(endAt, startAt);
            }
        }

        private IEnumerable<FChat3Message> EnumerateMessagesForward(DateTime startAt, DateTime endAt)
        {
            long readFrom = -1;
            using (var idx = OpenIndex())
            {
                foreach (var idxEntry in idx.EnumerateLogIndexEntries())
                {
                    if (idxEntry.Date == startAt.Date)
                    {
                        readFrom = idxEntry.FileOffset;
                        break;
                    }
                }
            }
            if (readFrom == -1)
            {
                yield break;
            }

            using (var df = OpenDataFile())
            {
                foreach (var msg in df.EnumerateMessages(EnumerationDirection.Forward, (uint)readFrom))
                {
                    if (msg.Timestamp < startAt.Date) { continue; }
                    if (msg.Timestamp >= endAt.Date) { break; }

                    yield return msg;
                }
            }
        }

        private IEnumerable<FChat3Message> EnumerateMessagesBackward(DateTime startAt, DateTime endAt)
        {
            long readFrom = -1;
            using (var idx = OpenIndex())
            {
                foreach (var idxEntry in idx.EnumerateLogIndexEntries())
                {
                    if (idxEntry.Date > endAt.Date)
                    {
                        readFrom = idxEntry.FileOffset;
                        break;
                    }
                }
            }
            if (readFrom <= 0)
            {
                yield break;
            }

            using (var df = OpenDataFile())
            {
                foreach (var msg in df.EnumerateMessages(EnumerationDirection.Backward, (uint)readFrom))
                {
                    if (msg.Timestamp > startAt.Date) { continue; }
                    if (msg.Timestamp <= endAt.Date) { break; }

                    yield return msg;
                }
            }
        }
    }
}
