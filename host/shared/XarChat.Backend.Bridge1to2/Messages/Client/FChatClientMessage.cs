using System;
using System.Collections.Generic;
using System.Text;

namespace XarChat.Backend.Bridge1to2.Messages.Client
{
    public abstract class FChatClientMessage : FChatMessage
    {
    }

    public class UnknownClientMessage : FChatClientMessage
    {
        public required string Code { get; set; }

        public string? Body { get; set; }
    }
}
