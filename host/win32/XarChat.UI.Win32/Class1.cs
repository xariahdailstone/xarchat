using XarChat.UI.Abstractions;

namespace XarChat.UI.Win32
{
    public class Win32Application : IApplication
    {
        public bool SupportsMultipleWindows => true;

        public SynchronizationContext SynchronizationContext => throw new NotImplementedException();

        public bool NeedInvoke => throw new NotImplementedException();

        public event EventHandler<EventArgs>? OnRunning;

        public IWebViewWindow CreateWebViewWindow()
        {
            throw new NotImplementedException();
        }

        public void Exit()
        {
            throw new NotImplementedException();
        }

        public void Run()
        {
            throw new NotImplementedException();
        }
    }
}
