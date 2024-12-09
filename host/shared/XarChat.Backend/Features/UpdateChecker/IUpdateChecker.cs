using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.UpdateChecker
{
    public interface IUpdateChecker
    {
        UpdateCheckerState State { get; }

        IDisposable OnStateChange(Action action);

        void IndicateRelaunchOnExit();

        void IndicateSuccessfulLogin();
    }

    public enum UpdateCheckerState
    {
        CheckingForUpdates,
        NoUpdatesAvailable,
        DownloadingUpdate,
        DownloadingUpdateMustUpdate,
        UpdateReady,
        UpdateReadyMustUpdate,
        UpdateAvailable,
        UpdateAvailableRequired
    }
}
