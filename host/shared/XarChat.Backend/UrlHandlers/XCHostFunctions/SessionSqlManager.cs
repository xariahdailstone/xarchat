using System;
using System.Collections.Generic;
using System.Data;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions
{
    //internal class SessionSqlManager
    //{
    //    private int _nextConnectionId = 1;
    //    private int _nextCommandId = 1;

    //    private Dictionary<string, ConnectionInfo> _connectionsByConnectionId = new Dictionary<string, ConnectionInfo>();
    //    private Dictionary<string, ConnectionInfo> _connectionsByCommandId = new Dictionary<string, ConnectionInfo>();

    //    public string RegisterNewConnection(IDbConnection dbConnection)
    //    {
    //        var myConnectionId = "cnn" + (_nextConnectionId++).ToString();
    //        var result = new ConnectionInfo(this, myConnectionId, dbConnection);
    //        return myConnectionId;
    //    }

    //    private bool TryGetConnectionInfoByConnectionId(string connectionId, [NotNullWhen(true)] out ConnectionInfo? connectionInfo)
    //    {
    //        lock (_connectionsByConnectionId)
    //        {
    //            if (_connectionsByConnectionId.TryGetValue(connectionId, out var ci))
    //            {
    //                connectionInfo = ci;
    //                return true;
    //            }
    //        }
    //        connectionInfo = default;
    //        return false;
    //    }

    //    public void DisposeConnection(string connectionId)
    //    {
    //        if (TryGetConnectionInfoByConnectionId(connectionId, out var ci))
    //        {
    //            ci.Dispose();
    //        }
    //    }

    //    private class ConnectionInfo : IDisposable
    //    {
    //        private readonly SessionSqlManager _owner;

    //        public ConnectionInfo(SessionSqlManager owner, string connectionId, IDbConnection dbConnection)
    //        {
    //            _owner = owner;
    //            this.ConnectionId = connectionId;
    //            this.Connection = dbConnection;

    //            lock (_owner._connectionsByCommandId)
    //            {
    //                _owner._connectionsByCommandId[this.ConnectionId] = this;
    //            }
    //        }

    //        public void Dispose()
    //        {
    //            lock (_owner._connectionsByCommandId)
    //            {
    //                _owner._connectionsByCommandId.Remove(this.ConnectionId);
    //            }
    //            this.Connection.Dispose();
    //        }

    //        public string ConnectionId { get; }

    //        public IDbConnection Connection { get; }
    //    }
    //}
}
