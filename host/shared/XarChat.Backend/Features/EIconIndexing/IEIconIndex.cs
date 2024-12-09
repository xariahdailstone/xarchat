using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.EIconIndexing
{
    internal interface IEIconIndex
    {
        Task InitializeAsync(CancellationToken cancellationToken);

        Task<IEIconSearchResults> SearchEIconsAsync(string searchTerm, CancellationToken cancellationToken);

        Task<IEIconInfoExtended?> GetEIconInfoExtendedAsync(string eiconName, CancellationToken cancellationToken);
    }

    internal interface IEIconSearchResults
    {
        IReadOnlyList<IEIconInfo> Results { get; }

        IReadOnlyDictionary<string, long> SearchTimings { get; }
	}

    internal interface IEIconInfo
    {
        string Name { get; }

        DateTime AddedAt { get; }
    }

    internal interface IEIconInfoExtended : IEIconInfo
    {
        string ETag { get; }

        long ContentLength { get; }
    }
}
