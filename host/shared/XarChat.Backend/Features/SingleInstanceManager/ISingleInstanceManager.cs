using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.SingleInstanceManager
{
	public interface ISingleInstanceManager
	{
		bool TryBecomeSingleInstance(
			[NotNullWhen(true)] out IAcquiredSingleInstance? acquiredInstanceDisposable);
	}

	public interface IAcquiredSingleInstance : IDisposable
	{
		Task GetActivationRequestAsync(CancellationToken cancellationToken);
	}
}
