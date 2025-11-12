using System.Security.Cryptography;
using XarChat.Backend.Features.AppSettings;

namespace XarChat.Backend.Mac.AppSettingsDataProtectionManager
{
    public class MacAppSettingsDataProtectionManager : IAppSettingsDataProtectionManager
    {
        public MacAppSettingsDataProtectionManager()
        {
            var key = System.Environment.UserName + "@" + System.Environment.MachineName;
            _encHash = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(key));
        }

        private readonly byte[] _encHash;

        private byte[] GetStringHash(byte[] iv, string v)
        {
            var strBytes = System.Text.Encoding.UTF8.GetBytes(v);
            var xbuf = new byte[iv.Length + strBytes.Length];
            Array.Copy(iv, xbuf, iv.Length);
            Array.Copy(strBytes, 0, xbuf, iv.Length, strBytes.Length);

            var hash = SHA256.HashData(xbuf);
            return new ArraySegment<byte>(hash, 0, sizeof(long)).ToArray();
        }

        public string? Decode(string? encodedValue)
        {
            if (encodedValue is null) { return null; }

            try
            {
                var encryptedBytes = Convert.FromBase64String(encodedValue);
                using var ms = new MemoryStream(encryptedBytes);
                var ivLength = ms.ReadByte();
                var iv = new byte[ivLength];
                ms.ReadExactly(iv, 0, ivLength);
                Console.WriteLine($"iv={Convert.ToBase64String(iv)}");

                var dataHashBytes = new byte[sizeof(long)];
                ms.ReadExactly(dataHashBytes, 0, sizeof(long));
                Console.WriteLine($"read expected hash: {BitConverter.ToInt64(dataHashBytes)}");

                using var aes = Aes.Create();
                using var cryptoStream = new CryptoStream(ms, aes.CreateDecryptor(_encHash, iv), CryptoStreamMode.Read);
                using var streamReader = new StreamReader(cryptoStream);
                var plainText = streamReader.ReadToEnd();

                var expectDataHashBytes = GetStringHash(iv, plainText);
                if (BitConverter.ToInt64(expectDataHashBytes) != BitConverter.ToInt64(dataHashBytes))
                {
                    Console.WriteLine($"hash mismatch; expected={BitConverter.ToInt64(expectDataHashBytes)} got={BitConverter.ToInt64(dataHashBytes)}");
                    Console.WriteLine($"had plaintext={plainText}");
                    return null;
                }

                return plainText;
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.ToString());
                return null;
            }
        }

        public string? Encode(string? rawValue)
        {
            if (rawValue == null) return null;

            using var aes = Aes.Create();
            aes.GenerateIV();

            Console.WriteLine($"iv={Convert.ToBase64String(aes.IV)}");

            using var ms = new MemoryStream();
            ms.WriteByte((byte)aes.IV.Length);
            ms.Write(aes.IV, 0, aes.IV.Length);

            var stringHash = GetStringHash(aes.IV, rawValue!);
            ms.Write(stringHash);
            Console.WriteLine($"Wrote string hash={BitConverter.ToInt64(stringHash)}");

            {
                using var cryptoStream = new CryptoStream(ms, aes.CreateEncryptor(_encHash, aes.IV), CryptoStreamMode.Write);
                using var streamWriter = new StreamWriter(cryptoStream);
                streamWriter.Write(rawValue!);
            }

            var encodedBytes = ms.ToArray();
            return Convert.ToBase64String(encodedBytes);
        }
    }
}