namespace XarChat.AutoUpdate.Impl
{
    internal class ActionDisposable : IDisposable
    {
        private Action? _onDispose;

        public ActionDisposable(Action onDispose)
        {
            _onDispose = onDispose;
        }

        public void Dispose()
        {
            if (_onDispose != null)
            {
                var od = _onDispose;
                _onDispose = null;
                try { od(); } catch { }
            }
        }
    }
}
