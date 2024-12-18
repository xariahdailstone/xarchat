using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.FListApi
{
    public interface IFalsifiedClientTicketManager
    {
        string GetFalsifiedClientTicket(string account);

        bool TryVerifyFalsifiedClientTicket(string account, string ticket);
    }

    public class FalsifiedClientTicketManager : IFalsifiedClientTicketManager
    {
        public string GetFalsifiedClientTicket(string account)
        {
            var hashBytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(account + "___faketicket"));
            var sb = new StringBuilder(hashBytes.Length / 2);
            foreach (var b in hashBytes)
            {
                sb.Append(b.ToString("x2"));
            }

            return $"faketicket_" + sb.ToString();
        }

        public bool TryVerifyFalsifiedClientTicket(string account, string ticket)
        {
            var tkt = GetFalsifiedClientTicket(account);
            return ticket == tkt;
        }
    }
}
