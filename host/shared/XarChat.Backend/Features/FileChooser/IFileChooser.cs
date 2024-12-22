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
            IReadOnlyList<KeyValuePair<string, string>>? filter = null,
            string? dialogTitle = null,
            CancellationToken cancellationToken = default);
    }
}
