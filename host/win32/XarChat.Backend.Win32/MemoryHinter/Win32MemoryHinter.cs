using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.MemoryHinter;

namespace XarChat.Backend.Win32.MemoryHinter
{
    internal class Win32MemoryHinter : IMemoryHinter
    {
        public void ReduceWorkingSet()
        {
            XarChat.Native.Win32.PSAPI.EmptyWorkingSet();
        }
    }
}
