using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.UpdateChecking;

namespace XarChat.Backend.Features.ChatLogging.FChat3
{
    internal class FChat3LogSearch : IChatLogSearch
    {
        // Base directory locations:
        //   Windows = %appdata%/fchat/data
        private readonly string _baseDirectoryName;

        public FChat3LogSearch(string baseDirectoryName)
        {
            _baseDirectoryName = baseDirectoryName;
        }

        public Task<IReadOnlyList<string>> GetChannelNamesAsync(CancellationToken cancellationToken)
        {
            var results = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var charLogDir in this.EnumerateMyCharacterLogDirectories())
            {
                foreach (var ffn in Directory.EnumerateFiles(charLogDir.LogDirectoryBase))
                {
                    var fn = Path.GetFileName(ffn);

                    if (!fn.StartsWith("#"))
                    {
                        continue;
                    }
                    results.Add(fn);
                }
            }
            return Task.FromResult<IReadOnlyList<string>>(results
                .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
                .ToList());
        }

        public Task<IReadOnlyList<LogCharacterInfo>> GetInterlocutorInfosAsync(string? myCharacterName, CancellationToken cancellationToken)
        {
            var results = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var charLogDir in this.EnumerateMyCharacterLogDirectories())
            {
                foreach (var ffn in Directory.EnumerateFiles(charLogDir.LogDirectoryBase))
                {
                    var fn = Path.GetFileName(ffn);

                    if (fn.StartsWith("#") || fn.EndsWith(".idx") || !IsValidCharacterName(fn))
                    {
                        continue;
                    }
                    results.Add(fn);
                }
            }

            return Task.FromResult<IReadOnlyList<LogCharacterInfo>>(results
                .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
                .Select(n => new LogCharacterInfo() { CharacterName = n, CharacterGender = 0 })
                .ToList());
        }

        public Task<IReadOnlyList<LogCharacterInfo>> GetMyCharacterInfosAsync(CancellationToken cancellationToken)
        {
            var results = new List<LogCharacterInfo>();
            foreach (var charLogDir in this.EnumerateMyCharacterLogDirectories())
            {
                results.Add(new LogCharacterInfo() { CharacterName = charLogDir.MyCharacterName, CharacterGender = 0 });
            }
            return Task.FromResult<IReadOnlyList<LogCharacterInfo>>(results
                .OrderBy(n => n.CharacterName, StringComparer.OrdinalIgnoreCase)
                .ToList());
        }

        private bool IsValidCharacterName(string characterName)
        {
            if (string.IsNullOrEmpty(characterName)) { return false; }
            if (characterName != characterName.Trim()) { return false; }

            if (!(characterName[0] >= 'A' && characterName[0] <= 'Z') ||
                 (characterName[0] >= 'a' && characterName[0] <= 'z') ||
                 (characterName[0] >= '0' && characterName[0] <= '9'))
            {
                return false;
            }

            var prevSpace = false;
            foreach (var ch in characterName)
            {
                if (ch >= 'A' && ch <= 'Z') { continue; }
                if (ch >= 'a' && ch <= 'z') { continue; }
                if (ch >= '0' && ch <= '9') { continue; }
                if (ch == '_' || ch == '-') { continue; }
                if (ch == ' ') 
                {
                    if (!prevSpace)
                    {
                        prevSpace = true;
                        continue;
                    }
                }
                else
                {
                    prevSpace = false;
                }
                return false;
            }

            return true;
        }

        private IEnumerable<(string MyCharacterName, string LogDirectoryBase)> EnumerateMyCharacterLogDirectories()
        {
            foreach (var subdirname in Directory.EnumerateDirectories(_baseDirectoryName))
            {
                var bn = Path.GetFileName(subdirname);
                if (!IsValidCharacterName(bn)) { continue; }

                var logDir = Path.Combine(subdirname, "logs");
                if (!Directory.Exists(logDir)) { continue; }

                yield return (bn, logDir);
            }
        }

        private async IAsyncEnumerable<FChat3SourcedMessage> EnumerateSearchResultsAsync(
            SearchCriteria criteria, 
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            IEnumerable<(string MyCharacterName, string LogDirectoryBase)> dirs;
            {
                if (criteria.StreamSpec is SearchPrivateMessagesWithCriterion spmc)
                {
                    dirs = this.EnumerateMyCharacterLogDirectories()
                        .Where(charLogDir => String.Equals(charLogDir.MyCharacterName, spmc.MyCharacterName, StringComparison.OrdinalIgnoreCase));
                }
                else
                {
                    dirs = this.EnumerateMyCharacterLogDirectories();
                }
            }

            IEnumerable<MultiLogFileSource> logFiles;
            {
                if (criteria.StreamSpec is SearchPrivateMessagesWithCriterion spmc)
                {
                    logFiles =
                        from charLogDir in dirs
                        from d in Directory.EnumerateFiles(charLogDir.LogDirectoryBase)
                        where Path.GetFileName(d).Equals(spmc.InterlocutorCharacterName, StringComparison.OrdinalIgnoreCase)
                        select new MultiLogFileSource(charLogDir.MyCharacterName, d, Path.GetFileName(d));
                }
                else if (criteria.StreamSpec is SearchInChannelCriterion sicc)
                {
                    var hashChannelTitle = "#" + sicc.ChannelTitle;
                    logFiles =
                        from charLogDir in dirs
                        from d in Directory.EnumerateFiles(charLogDir.LogDirectoryBase)
                        where Path.GetFileName(d).Equals(hashChannelTitle, StringComparison.OrdinalIgnoreCase)
                        select new MultiLogFileSource(charLogDir.MyCharacterName, d, Path.GetFileName(d));
                }
                else
                {
                    logFiles =
                        from charLogDir in dirs
                        from d in Directory.EnumerateFiles(charLogDir.LogDirectoryBase)
                        select new MultiLogFileSource(charLogDir.MyCharacterName, d, Path.GetFileName(d));
                }
            }

            var mlf = new FChat3MultiLogFile(logFiles.ToArray());
            foreach (var sr in mlf.EnumerateMessages(
                criteria.TimeSpec?.After ?? DateTime.MinValue, criteria.TimeSpec?.Before ?? DateTime.MaxValue))
            {
                if (criteria.TextSpec is SearchContainsTextCriterion ctc)
                {
                    if (!sr.Text.Contains(ctc.SearchText, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                }

                yield return sr;
            }
        }

        public Task<int> GetSearchResultCountAsync(SearchCriteria criteria, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<IReadOnlyList<long>> GetSearchResultIdsAsync(SearchCriteria criteria, int skip, int take, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<IReadOnlyList<SearchResultItem>> GetSearchResultsForIdsAsync(IReadOnlyList<long> ids, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<IReadOnlyList<SearchResultItem>> GetSearchResultSubsetAsync(SearchCriteria criteria, int skip, int take, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<bool> ValidateChannelInLogsAsync(string channelName, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<bool> ValidatePMConvoInLogsAsync(string myCharacterName, string interlocutorName, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }
    }
}
