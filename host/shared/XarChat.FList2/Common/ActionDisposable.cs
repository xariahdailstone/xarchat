namespace XarChat.FList2.Common
{
    internal class ActionDisposable : IDisposable, IAsyncDisposable
    {
        public static ActionDisposable Empty { get; } = new ActionDisposable();

        private Action? _onDispose;
        private Func<ValueTask>? _onDisposeAsync;

        private bool _disposed = false;

        public ActionDisposable(
            Action? onDispose = null,
            Func<ValueTask>? onDisposeAsync = null)
        {
            _onDispose = onDispose;
            _onDisposeAsync = onDisposeAsync;
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _disposed = true;
                try { 
                    if (this._onDispose is not null)
                    {
                        this._onDispose();
                    }
                    else if (this._onDisposeAsync is not null)
                    {
                        this._onDisposeAsync().AsTask().Wait();
                    }
                }
                catch { }
                this._onDispose = null;
                this._onDisposeAsync = null;
            }
        }

        public async ValueTask DisposeAsync()
        {
            if (!_disposed)
            {
                _disposed = true;
                try
                {
                    if (this._onDisposeAsync is not null)
                    {
                    }
                    else if (this._onDispose is not null)
                    {
                        this._onDispose();
                    }
                }
                catch { }
                this._onDispose = null;
                this._onDisposeAsync = null;
            }
        }
    }
}
