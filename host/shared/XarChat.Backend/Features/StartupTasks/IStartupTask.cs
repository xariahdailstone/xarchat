using Microsoft.AspNetCore.DataProtection.KeyManagement;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common;
using static System.Collections.Specialized.BitVector32;

namespace XarChat.Backend.Features.StartupTasks
{
    public interface IStartupTask
    {
        StartupTaskStatus Status { get; }

        IDisposable OnStatusChange(Action action);
    }

    public record struct StartupTaskStatus(bool IsComplete, string CurrentStatus, Exception? FailureException);

    public class StartupTask : IStartupTask
    {
        public StartupTask(string initialStatus)
        {
            _currentStatus = new StartupTaskStatus(false, initialStatus, null);
        }

        private StartupTaskStatus _currentStatus;
        private readonly Dictionary<object, Action> _registeredListeners
            = new Dictionary<object, Action>();

        public void UpdateStatus(bool isComplete, string currentStatus, Exception? failureException)
        {
            _currentStatus = new StartupTaskStatus(isComplete, currentStatus, failureException);

            Action[] toFire;
            lock (_registeredListeners)
            {
                toFire = _registeredListeners.Values.ToArray();
            }

            foreach (var listener in toFire)
            {
                try { listener(); }
                catch { }
            }
        }

        public IDisposable OnStatusChange(Action action)
        {
            var myKey = new object();
            lock (_registeredListeners)
            {
                _registeredListeners.Add(myKey, action);
            }

            try { action(); }
            catch { }

            return new ActionDisposable(() =>
            {
                lock (_registeredListeners)
                {
                    _registeredListeners.Remove(myKey);
                }
            });
        }

        public StartupTaskStatus Status => _currentStatus;
    }
}
