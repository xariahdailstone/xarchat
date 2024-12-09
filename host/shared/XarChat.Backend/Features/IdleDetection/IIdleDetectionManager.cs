using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.IdleDetection
{
    public interface IIdleDetectionManager
    {
        IDisposable RegisterDisposableCallback(TimeSpan idleAfter, Action<string, string> callback);

        void RegisterCallback(string name, TimeSpan idleAfter, Action<string, string> callback);

        void UnregisterCallback(string name);
    }
}
