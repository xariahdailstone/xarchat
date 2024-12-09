using XarChat.Backend.Common;
using XarChat.Backend.Features.IdleDetection;

namespace XarChat.Backend.Linux.IdleDetectionManager
{
    public class LinuxIdleDetectionManagerImpl : IIdleDetectionManager
    {
        public void RegisterCallback(string name, TimeSpan idleAfter, Action<string, string> callback)
        {
        }

        public IDisposable RegisterDisposableCallback(TimeSpan idleAfter, Action<string, string> callback)
        {
            return new ActionDisposable(() => { });
        }

        public void UnregisterCallback(string name)
        {
        }
    }
}