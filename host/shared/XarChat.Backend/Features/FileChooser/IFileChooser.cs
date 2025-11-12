using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.FileChooser
{
    public interface IFileChooser
    {
        Task<string?> SelectLocalFileAsync(
            string? initialFile = null,
            IReadOnlyList<SelectLocalFileFilterEntry>? filters = null,
            string? dialogTitle = null,
            CancellationToken cancellationToken = default);
    }

    public record struct SelectLocalFileFilterEntry(string Name, IEnumerable<string> Extensions);
}
