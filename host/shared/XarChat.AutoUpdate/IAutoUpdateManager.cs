using XarChat.Backend.Features.UpdateChecker;

namespace XarChat.AutoUpdate
{
    public interface IAutoUpdateManager : IUpdateChecker, IDisposable
    {
        /// <summary>
        /// Run the most recent staged update executable; if there is one present and ready to run.
        /// </summary>
        /// <param name="cancellationToken"></param>
        /// <returns>True if a staged update was run, false otherwise.</returns>
        Task<bool> TryRunMostRecentAsync(CancellationToken cancellationToken);

        /// <summary>
        /// Start the update check background loop.
        /// </summary>
        void StartUpdateChecks();

        /// <summary>
        /// Gets the current state of the update check loop.
        /// </summary>
        AutoUpdateState AutoUpdateState { get; }

        /// <summary>
        /// Register a callback for changes to the update check loop current state.
        /// </summary>
        /// <param name="callback"></param>
        /// <returns></returns>
        IDisposable RegisterAutoUpdateStateChangedHandler(Action<AutoUpdateState> callback);

        /// <summary>
        /// Signal that the currently running executable is functional (copy it to the main
        /// executable location, if appropriate; and remove older staged versions).
        /// </summary>
        void SignalRunningSuccessfully();

        bool RelaunchOnExitRequested { get; }
    }

    public enum AutoUpdateState
    {
        Initializing,
        CheckingForUpdates,
        DownloadingUpdate,
        DownloadingUpdateRequired,
        UpdateReady,
        UpdateReadyRequired,
        UpdateAvailable,
        UpdateAvailableRequired,
        NoUpdatesWaiting
    }
}
