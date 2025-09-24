using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using XarChat.Backend.Common;

namespace XarChat.Backend.Features.SingleInstanceManager.ProfileLockFile
{
	public class ProfileLockFileSingleInstanceManager : ISingleInstanceManager
	{
		private readonly string _profileDir;
		private readonly string _lockFileName;

		public ProfileLockFileSingleInstanceManager(string profileDir)
        {
			_profileDir = profileDir;
			_lockFileName = Path.Combine(_profileDir, "instance.lock");
		}

        public bool TryBecomeSingleInstance(
			[NotNullWhen(true)] out IAcquiredSingleInstance? acquiredInstanceDisposable)
		{
			var attemptsRemaining = 10;
			while (attemptsRemaining > 0)
			{
				try
				{
					if (File.Exists(_lockFileName) && TryCheckExistingInstance(out var nasi) && nasi.Signal())
					{
						acquiredInstanceDisposable = default;
						return false;
					}
					else if (TrySetupInstance(out var setupInstance))
					{
						acquiredInstanceDisposable = setupInstance;
						return true;
					}
				}
				catch { }

				attemptsRemaining--;
				if (attemptsRemaining > 0)
				{
					Thread.Sleep(100);
				}
			}

			throw new ApplicationException("unable to acquire instance lock");
		}

		private bool TrySetupInstance(
			[NotNullWhen(true)] out IAcquiredSingleInstance? acquiredSingleInstance)
		{
			try 
			{
				int port;
				TcpListener? listener = null;

				var r = new Random();
				while (true)
				{
					try
					{
						port = r.Next(20000, 29999);
						listener = new TcpListener(new IPEndPoint(IPAddress.Loopback, port));
						listener.Start();
						break;
					}
					catch 
					{
						try { listener?.Dispose(); }
						catch { }
					}
				}

				using var p = System.Diagnostics.Process.GetCurrentProcess();

				var f = new FileStream(_lockFileName, FileMode.CreateNew, FileAccess.ReadWrite, 
					FileShare.ReadWrite | FileShare.Delete, 4096,
					FileOptions.DeleteOnClose);
				try
				{
					var fd = new LockFileData()
					{
						Pid = p.Id,
						Timestamp = new DateTimeOffset(p.StartTime.ToUniversalTime() , TimeSpan.Zero).ToUnixTimeSeconds(),
						Port = port,
					};
					var jsonStr = JsonSerializer.Serialize(fd, LockFileSerializerContext.Default.LockFileData);
					f.Write(System.Text.Encoding.UTF8.GetBytes(jsonStr));
					f.Flush();

					acquiredSingleInstance = new AcquiredSingleInstance(listener, f, _lockFileName);
					return true;
				}
				catch
				{
					f.Dispose();
				}
			}
			catch { }

			acquiredSingleInstance = default;
			return false;
		}

		private bool TryCheckExistingInstance(
			[NotNullWhen(true)] out NonAcquiredSingleInstance? nonAcquiredSingleInstance)
		{
			try
			{
				using var fs = new FileStream(_lockFileName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
				using var lockFileStream = new StreamReader(fs);
				var jsonStr = lockFileStream.ReadToEnd();
				var lockFileObj = JsonSerializer.Deserialize<LockFileData>(jsonStr, LockFileSerializerContext.Default.LockFileData)!;
				using var existingProcess = System.Diagnostics.Process.GetProcessById(lockFileObj.Pid);
				if (new DateTimeOffset(existingProcess.StartTime.ToUniversalTime(), TimeSpan.Zero).ToUnixTimeSeconds() == lockFileObj.Timestamp)
				{
					var nasi = new NonAcquiredSingleInstance(lockFileObj.Port);
					nonAcquiredSingleInstance = nasi;
					return true;
				}
			}
			catch
			{
			}

			try
			{
				FileSystemUtil.Delete(_lockFileName);
			}
			catch { }
			nonAcquiredSingleInstance = default;
			return false;
		}
	}

	internal class AcquiredSingleInstance : IAcquiredSingleInstance
	{
		private readonly TcpListener _activationListener;
		private readonly FileStream _lockFileStream;
		private readonly string _lockFileName;

		private bool _disposed = false;

		public AcquiredSingleInstance(TcpListener activationListener, FileStream lockFileStream, string lockFileName)
        {
			_activationListener = activationListener;
			_lockFileStream = lockFileStream;
			_lockFileName = lockFileName;
		}

        public void Dispose()
		{
			if (!_disposed)
			{
				_activationListener.Dispose();
				_lockFileStream.Dispose();
				Thread.Sleep(250);
				try { FileSystemUtil.Delete(_lockFileName); }
				catch { }
			}
		}

		public async Task GetActivationRequestAsync(CancellationToken cancellationToken)
		{
			var buf = new byte[1024];

			while (true)
			{
				using var cli = await _activationListener.AcceptTcpClientAsync(cancellationToken);
				using var s = cli.GetStream();
				using var sr = new StreamReader(s);
				var cts = new CancellationTokenSource(TimeSpan.FromSeconds(1));
				var line = await sr.ReadLineAsync(cancellationToken);
				if (line == "signal")
				{
					return;
				}
			}
		}
	}

	internal class NonAcquiredSingleInstance
	{
		private readonly int _port;

        public NonAcquiredSingleInstance(int port)
        {
			_port = port;    
        }

        public bool Signal()
		{
			try
			{
				using var tcpClient = new TcpClient();
				tcpClient.Connect(new System.Net.IPEndPoint(System.Net.IPAddress.Loopback, _port));
				using var stream = tcpClient.GetStream();
				stream.Write(System.Text.Encoding.UTF8.GetBytes("signal\n"));
				return true;
			}
			catch { }
			return false;
		}
	}

	[JsonSerializable(typeof(LockFileData))]
	internal partial class LockFileSerializerContext : JsonSerializerContext
	{
	}

	public class LockFileData
	{
		[JsonPropertyName("pid")]
		public int Pid { get; set; }

		[JsonPropertyName("timestamp")]
		public long Timestamp { get; set; }

		[JsonPropertyName("port")]
		public int Port { get; set; }
	}
}
