using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.CommandableWindows
{
	public interface ICommandableWindowRegistry
	{
		int GetNewWindowId();

		void RegisterWindow(int id, ICommandableWindow window);

		void UnregisterWindow(int id);

		bool TryGetWindowById(int id, [NotNullWhen(true)] out ICommandableWindow? window);
	}

	public interface ICommandableWindow
	{
		Task<JsonObject> ExecuteCommandAsync(JsonObject commandObject, CancellationToken cancellationToken);
	}

	internal class CommandableWindowRegistry : ICommandableWindowRegistry
	{
		private int _nextWindowId = 1;

		private readonly Dictionary<int, ICommandableWindow> _registeredWindows
			= new Dictionary<int, ICommandableWindow>();

		public int GetNewWindowId()
		{
			lock (_registeredWindows)
			{
				return _nextWindowId++;
			}
		}

		public void RegisterWindow(int id, ICommandableWindow window)
		{
			lock (_registeredWindows)
			{
				_registeredWindows.Add(id, window);
			}
		}

		public bool TryGetWindowById(int id, [NotNullWhen(true)] out ICommandableWindow? window)
		{
			lock (_registeredWindows)
			{
				if (_registeredWindows.TryGetValue(id, out window))
				{
					return true;
				}

				window = null;
				return false;
			}
		}

		public void UnregisterWindow(int id)
		{
			lock (_registeredWindows)
			{
				_registeredWindows.Remove(id);
			}
		}
	}
}
