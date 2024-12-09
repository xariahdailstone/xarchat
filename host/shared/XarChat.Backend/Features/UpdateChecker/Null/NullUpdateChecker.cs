using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common;

namespace XarChat.Backend.Features.UpdateChecker.Null
{
    public class NullUpdateChecker : IUpdateChecker
    {
        public UpdateCheckerState State => UpdateCheckerState.NoUpdatesAvailable;

        public IDisposable OnStateChange(Action action)
        {
            return new ActionDisposable(() => { });
        }

        public void IndicateRelaunchOnExit()
        {
        }

        public void IndicateSuccessfulLogin()
        {
        }
    }
}
