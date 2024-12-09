using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Common
{
    public class ActionDisposable : IDisposable
    {
        private readonly Action _action;
        private bool _disposed = false;

        public ActionDisposable(Action action)
        {
            _action = action;
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _disposed = true;
                try { _action?.Invoke(); } catch { }
            }
        }
    }
}
