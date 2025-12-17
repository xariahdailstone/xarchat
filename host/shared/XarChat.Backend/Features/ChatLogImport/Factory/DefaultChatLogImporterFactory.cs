using System;
using System.Collections.Generic;
using System.Text;
using XarChat.Backend.Features.ChatLogImport.FChat3;

namespace XarChat.Backend.Features.ChatLogImport.Factory
{
    internal class DefaultChatLogImporterFactory : IChatLogImporterFactory
    {
        public DefaultChatLogImporterFactory()
        {
            
        }

        public IList<IChatLogImporter> GetAllImporters()
        {
            return new List<IChatLogImporter>()
            {
                new FChat3ChatLogImporter()
            };
        }
    }
}
