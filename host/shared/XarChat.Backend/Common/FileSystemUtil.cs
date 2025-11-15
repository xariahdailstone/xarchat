using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Common
{
    public static class FileSystemUtil
    {
        public static void Delete(string filename, int? retryCount = null, TimeSpan? retryDelay = null)
        {
            int myRetryCount = retryCount ?? 5;
            TimeSpan myRetryDelay = retryDelay ?? TimeSpan.FromMilliseconds(250);

            Exception lastException = null!;
            while (myRetryCount > 0)
            {
                if (File.Exists(filename))
                {
                    try
                    {
                        File.Delete(filename);
                        return;
                    }
                    catch (Exception ex) 
                    {
                        lastException = ex;
                    }
                    myRetryCount--;
                    if (myRetryCount > 0)
                    {
                        Thread.Sleep(myRetryDelay);
                    }
                }
                else
                {
                    return;
                }
            }
            throw lastException;
        }

        public static async Task DeleteAsync(string filename, int? retryCount = null, TimeSpan? retryDelay = null)
        {
            int myRetryCount = retryCount ?? 5;
            TimeSpan myRetryDelay = retryDelay ?? TimeSpan.FromMilliseconds(250);

            Exception lastException = null!;
            while (myRetryCount > 0)
            {
                if (File.Exists(filename))
                {
                    try
                    {
                        File.Delete(filename);
                        return;
                    }
                    catch (Exception ex)
                    {
                        lastException = ex;
                    }
                    myRetryCount--;
                    if (myRetryCount > 0)
                    {
                        await Task.Delay(myRetryDelay);
                    }
                }
            }
            throw lastException;
        }
    }
}
