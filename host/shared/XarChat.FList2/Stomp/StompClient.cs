using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Web;
using System.Xml.Linq;

namespace XarChat.FList2.Stomp
{
    internal class StompClient : IDisposable
    {
        public static async Task<StompClient> CreateAsync(
            Uri uri, 
            CookieContainer cookieContainer,
            Dictionary<string, string> connectHeaders, CancellationToken cancellationToken)
        {
            var ws = new ClientWebSocket();

            var cookieHdrValue = new StringBuilder();
            foreach (Cookie cookie in cookieContainer.GetCookies(uri))
            {
                if (cookieHdrValue.Length > 0)
                {
                    cookieHdrValue.Append("; ");
                }
                cookieHdrValue.Append($"{HttpUtility.UrlEncode(cookie.Name)}={HttpUtility.UrlEncode(cookie.Value)}");
            }
            ws.Options.AddSubProtocol("v12.stomp");
            ws.Options.AddSubProtocol("v11.stomp");
            ws.Options.AddSubProtocol("v10.stomp");
            ws.Options.SetRequestHeader("Cookie", cookieHdrValue.ToString());
            ws.Options.SetRequestHeader("Origin", "https://test.f-list.net");
            try
            {
                await ws.ConnectAsync(uri, cancellationToken);

                var pConnectHeaders = new Dictionary<string, string>(connectHeaders, StringComparer.OrdinalIgnoreCase);
                pConnectHeaders["accept-version"] = "1.2,1.1,1.0";
                pConnectHeaders["heart-beat"] = "10000,10000";
                var connectFrame = new StompFrame()
                {
                    Command = "CONNECT",
                    Headers = pConnectHeaders,
                    Body = null
                };
                var sendBuffer = connectFrame.ToBuffer();
                await ws.SendAsync(sendBuffer, WebSocketMessageType.Binary, true, cancellationToken);

                var sf = await ReadStompFrameAsync(ws, cancellationToken);
                if (sf.Command != "CONNECTED") { throw new ApplicationException("STOMP did not receive CONNECTED"); }
                return new StompClient(ws, sf);
            }
            catch (Exception ex)
            {
                Debug.WriteLine(ex.ToString());
                ws.Dispose();
                throw;
            }
        }

        private readonly ClientWebSocket _cws;
        private StompFrame? _connectedFrame;
        private bool _disposed = false;

        private StompClient(ClientWebSocket cws, StompFrame connectedFrame)
        {
            this._cws = cws;
            this._connectedFrame = connectedFrame;
        }

        public void Dispose()
        {
            if (!this._disposed)
            {
                this._disposed = true;
                this._cws.Dispose();
            }
        }

        public void Test_DropWebSocket()
        {
            this._cws.Dispose();
        }

        public async Task<StompFrame?> ReadAsync(CancellationToken cancellationToken)
        {
            if (this._disposed) { throw new ObjectDisposedException(this.GetType().Name); }

            if (this._connectedFrame is not null)
            {
                var result = this._connectedFrame;
                this._connectedFrame = null;
                return result;
            }

            try
            {
                while (true)
                {
                    var readFrame = await ReadStompFrameAsync(_cws, cancellationToken);
                    //if (readFrame is not null && readFrame.Command == "")
                    //{
                    //    await _sendSem.WaitAsync(cancellationToken);
                    //    try
                    //    {
                    //        Console.WriteLine("## bounceback sent");
                    //        await _cws.SendAsync(new byte[] { 10 }, WebSocketMessageType.Text, true, cancellationToken);
                    //    }
                    //    finally
                    //    {
                    //        _sendSem.Release();
                    //    }
                    //}
                    //else
                    //{
                        return readFrame;
                    //}
                }
            }
            catch
            {
                this.Dispose();
                return null;
            }
        }

        private readonly SemaphoreSlim _sendSem = new SemaphoreSlim(1);

        public async Task WriteRawAsync(ArraySegment<byte> data, WebSocketMessageType mtype, bool endOfMessage, CancellationToken cancellationToken)
        {
            if (this._disposed) { throw new ObjectDisposedException(this.GetType().Name); }

            await _sendSem.WaitAsync(cancellationToken);
            try
            {
                if (this._disposed) { throw new ObjectDisposedException(this.GetType().Name); }

                try
                {
                    await _cws.SendAsync(data, WebSocketMessageType.Binary, true, cancellationToken);
                }
                catch
                {
                    this.Dispose();
                    throw;
                }
            }
            finally
            {
                _sendSem.Release();
            }
        }

        public async Task WriteAsync(StompFrame frame, CancellationToken cancellationToken)
        {
            await WriteRawAsync(frame.ToBuffer(), WebSocketMessageType.Binary, true, cancellationToken);
        }

        private static async Task<StompFrame> ReadStompFrameAsync(ClientWebSocket ws, CancellationToken cancellationToken)
        {
            var buf = new byte[65536];
            ArraySegment<byte> totalMsg = new ArraySegment<byte>(buf, 0, 0);

            WebSocketMessageType msgType;
            while (true)
            {
                var rresp = await ws.ReceiveAsync(buf, cancellationToken);
                msgType = rresp.MessageType;
                if (rresp.EndOfMessage)
                {
                    if (totalMsg.Count == 0)
                    {
                        totalMsg = new ArraySegment<byte>(buf, 0, rresp.Count);
                        break;
                    }
                    else
                    {
                        var combinedBuf = new byte[totalMsg.Count + rresp.Count];
                        Array.Copy(totalMsg.Array!, totalMsg.Offset, combinedBuf, 0, totalMsg.Count);
                        Array.Copy(buf, 0, combinedBuf, totalMsg.Count, rresp.Count);
                        totalMsg = new ArraySegment<byte>(combinedBuf, 0, combinedBuf.Length);
                        break;
                    }
                }
                else
                {
                    var combinedBuf = new byte[totalMsg.Count + rresp.Count];
                    Array.Copy(totalMsg.Array!, totalMsg.Offset, combinedBuf, 0, totalMsg.Count);
                    Array.Copy(buf, 0, combinedBuf, totalMsg.Count, rresp.Count);
                    totalMsg = new ArraySegment<byte>(combinedBuf, 0, combinedBuf.Length);
                }
            }

            if (totalMsg.Count == 1 && msgType == WebSocketMessageType.Text)
            {
                return new StompFrame() { Command = "", Headers = new Dictionary<string, string>(), Body = null };
            }

            var result = StompFrame.ParseBuffer(totalMsg);
            return result;
        }
    }

    internal class StompFrame
    {
        public static StompFrame ParseBuffer(ArraySegment<byte> buffer)
        {
            if (buffer.Count == 0) 
            {
                Console.WriteLine("!!! Got empty STOMP frame");
                throw new ApplicationException("STOMP frame is empty"); 
            }
            if (buffer[0] == '\n') 
            {
                Console.WriteLine("!!! Got non command STOMP frame");
                return new StompFrame() { Command = "", Headers = new(), Body = null }; 
            }

            ArraySegment<byte> remainingBuffer = buffer;

            string fromUtf8(ArraySegment<byte> buf) => System.Text.Encoding.UTF8.GetString(buf);

            ArraySegment<byte> ConsumeUntil(byte b)
            {
                var result = new ArraySegment<byte>(remainingBuffer.Array, remainingBuffer.Offset, 0);
                while (true)
                {
                    if (remainingBuffer.Count == 0) { throw new ApplicationException("STOMP end of buffer"); }

                    var thisCh = remainingBuffer.Array![remainingBuffer.Offset];
                    remainingBuffer = new ArraySegment<byte>(remainingBuffer.Array!, remainingBuffer.Offset + 1, remainingBuffer.Count - 1);

                    if (thisCh == b)
                    {
                        return result;
                    }
                    else
                    {
                        result = new ArraySegment<byte>(result.Array!, result.Offset, result.Count + 1);
                    }
                }
            }

            var commandBytes = fromUtf8(ConsumeUntil((byte)'\n')).TrimEnd('\r');
            var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            while (true)
            {
                var tline = fromUtf8(ConsumeUntil((byte)'\n')).TrimEnd('\r');
                if (tline == "") { break; }
                var colonPos = tline.IndexOf(':');
                var headerName = tline.Substring(0, colonPos);
                var headerValue = tline.Substring(colonPos + 1);
                if (!headers.ContainsKey(headerName))
                {
                    headers[headerName] = headerValue;
                }
            }

            var bodyBytes = ConsumeUntil(0);

            Console.WriteLine("-- Got STOMP frame = " + System.Text.Encoding.UTF8.GetString(buffer));
            return new StompFrame()
            {
                Command = commandBytes,
                Headers = headers,
                Body = (bodyBytes.Count > 0) ? bodyBytes.ToArray() : null
            };
        }

        public required string Command { get; init; }

        public required Dictionary<string, string> Headers { get; init; }

        public required byte[]? Body { get; init; }

        private int GetTotalLengthNeeded()
        {
            int result = 0;
            result += System.Text.Encoding.UTF8.GetByteCount(Command);
            result += 1; // \n
            foreach (var kvp in Headers)
            {
                result += System.Text.Encoding.UTF8.GetByteCount(kvp.Key);
                result += 1; // :
                result += System.Text.Encoding.UTF8.GetByteCount(kvp.Value);
                result += 1; // \n
            }
            result += 1; // \n
            result += (Body?.Length ?? 0);
            result += 1; // nul
            return result;
        }

        public byte[] ToBuffer()
        {
            if (Body is not null)
            {
                Headers["content-length"] = Body.Length.ToString();
            }
            else
            {
                if (Headers.ContainsKey("content-length"))
                {
                    Headers.Remove("content-length");
                }
            }

            byte[] utf8(string str) { return System.Text.Encoding.UTF8.GetBytes(str); }

            using var ms = new MemoryStream(GetTotalLengthNeeded());
            ms.Write(utf8(Command));
            ms.WriteByte((byte)'\n');
            foreach (var kvp in Headers)
            {
                ms.Write(utf8(kvp.Key));
                ms.WriteByte((byte)':');
                ms.Write(utf8(kvp.Value));
                ms.WriteByte((byte)'\n');
            }
            ms.WriteByte((byte)'\n');
            if (Body is not null)
            {
                ms.Write(Body);
            }
            ms.WriteByte((byte)0);

            return ms.ToArray();
        }
    }
}
