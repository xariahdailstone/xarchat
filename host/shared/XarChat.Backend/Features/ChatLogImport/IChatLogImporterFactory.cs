using System;
using System.Collections.Generic;
using System.Text;

namespace XarChat.Backend.Features.ChatLogImport
{
    public interface IChatLogImporterFactory
    {
        IList<IChatLogImporter> GetAllImporters();
    }
}
