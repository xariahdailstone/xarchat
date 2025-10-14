using System;
using System.Collections.Generic;
using System.Dynamic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.ChatLogging.FChat3
{
    public record MultiLogFileSource(string MyCharacterName, string LogFileFullName, string LogTargetName);

    public class FChat3MultiLogFile
    {
        private readonly MultiLogFileSource[] _logFiles;

        public FChat3MultiLogFile(MultiLogFileSource[] logFiles)
        {
            _logFiles = logFiles;
        }

        private record EnumeratorTuple(string MyCharacterName, string LogTargetName, IEnumerator<FChat3Message> Enumerator);

        public IEnumerable<FChat3SourcedMessage> EnumerateMessages(DateTime startAt, DateTime endAt)
        {
            var enumeratingForward = (endAt > startAt);

            var lfPairs = new List<(string MyCharacterName, string LogTargetName, FChat3LogFilePair LogFilePair)>();
            foreach (var bn in _logFiles)
            {
                var lf = (bn.MyCharacterName, bn.LogTargetName, new FChat3LogFilePair(bn.LogFileFullName));
                lfPairs.Add(lf);
            }

            var enumerators = new HashSet<EnumeratorTuple>();
            try
            {
                foreach (var p in lfPairs)
                {
                    var etor = p.LogFilePair.EnumerateMessages(startAt, endAt).GetEnumerator();
                    if (etor.MoveNext())
                    {
                        enumerators.Add(new (p.MyCharacterName, p.LogTargetName, etor));
                    }
                    else
                    {
                        etor.Dispose();
                    }
                }

                while (enumerators.Count > 0)
                {
                    FChat3Message? currentBestMessage = null;
                    EnumeratorTuple? currentBestEnumerator = null;

                    foreach (var etor in enumerators)
                    {
                        var c = etor.Enumerator.Current;
                        if ((enumeratingForward && (currentBestMessage == null || c.Timestamp < currentBestMessage.Timestamp)) ||
                            (!enumeratingForward && (currentBestMessage == null || c.Timestamp > currentBestMessage.Timestamp)))
                        {
                            currentBestMessage = c;
                            currentBestEnumerator = etor;
                        }
                    }

                    if (currentBestMessage is not null && currentBestEnumerator is not null)
                    {
                        if (!currentBestEnumerator.Enumerator.MoveNext())
                        {
                            enumerators.Remove(currentBestEnumerator);
                        }
                        yield return new FChat3SourcedMessage(
                            currentBestEnumerator.MyCharacterName, currentBestEnumerator.LogTargetName,
                            currentBestMessage.Timestamp, currentBestMessage.Type, currentBestMessage.Sender,
                            currentBestMessage.Text);
                    }
                    else
                    {
                        yield break;
                    }
                }
            }
            finally
            {
                foreach (var p in enumerators)
                {
                    p.Enumerator.Dispose();
                }
            }
        }
    }
}
