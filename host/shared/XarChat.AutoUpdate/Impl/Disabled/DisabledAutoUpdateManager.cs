using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.UpdateChecker;

namespace XarChat.AutoUpdate.Impl.Disabled
{
    public class DisabledAutoUpdateManager : IAutoUpdateManager
    {
        public void Dispose()
        {
        }

        public Task<bool> TryRunMostRecentAsync(CancellationToken cancellationToken)
            => Task.FromResult(false);

        public void StartUpdateChecks()
        {
        }

        public bool RelaunchOnExitRequested => false;

        public AutoUpdateState AutoUpdateState => AutoUpdateState.NoUpdatesWaiting;

        UpdateCheckerState IUpdateChecker.State => UpdateCheckerState.NoUpdatesAvailable;

        public IDisposable RegisterAutoUpdateStateChangedHandler(Action<AutoUpdateState> callback)
        {
            callback(AutoUpdateState.NoUpdatesWaiting);
            return new ActionDisposable(() => { });
        }

        public void SignalRunningSuccessfully()
        {
        }

        IDisposable IUpdateChecker.OnStateChange(Action action)
        {
            return RegisterAutoUpdateStateChangedHandler((x) => action());
        }

        void IUpdateChecker.IndicateRelaunchOnExit()
        {
        }

        void IUpdateChecker.IndicateSuccessfulLogin()
        {
        }
    }
}
