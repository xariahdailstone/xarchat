namespace XarChat.UI.Abstractions
{
    public interface IApplication
    {
        event EventHandler<EventArgs>? OnRunning;

        IWebViewWindow CreateWebViewWindow();

        SynchronizationContext SynchronizationContext { get; }

        bool NeedInvoke { get; }

        void Run();

        void Exit();
    }

    public static class IApplicationExtensions
    {
        public static Task InvokeAsync(this IApplication application, Action action)
        {
            TaskCompletionSource tcs = new TaskCompletionSource();

            application.SynchronizationContext.Post((tcsObj) => 
            {
                var tcs = (TaskCompletionSource)tcsObj!;
                try
                {
                    action();
                    tcs.SetResult();
                }
                catch (Exception ex)
                {
                    tcs.SetException(ex);
                }
            }, tcs);

            return tcs.Task;
        }
    }
}
