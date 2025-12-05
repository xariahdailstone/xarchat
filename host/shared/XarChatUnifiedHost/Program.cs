using Wacton.Unicolour;

namespace XarChatUnifiedHost;

class Program
{
    static void Main(string[] args)
    {
        Console.WriteLine("Hello, World!");

        var app = new XarChat.UI.Gtk4.Gtk4Application("net.xariah.xarchat");

        //var app = new XarChat.UI.Photino.PhotinoApplication();

        app.OnRunning += (o, e) =>
        {
            var win = app.CreateWebViewWindow();

            win.Title = "foobarbaz";

            win.TitlebarColor = new(BackgroundColor: new Unicolour("#FF0000"), ForegroundColor: new Unicolour("#FFFFFF"));
            win.BackgroundColor = new(BackgroundColor: new Unicolour("#FF0000"), ForegroundColor: new Unicolour("#FFFFFF"));
            win.NavigateTo(new Uri("https://xariah.net/"));

            if (app.SupportsMultipleWindows)
            {
                win.Shown += (o, e) =>
                {
                    Console.WriteLine("showing second window...");
                    var win2 = app.CreateWebViewWindow();
                    win2.Title = "win2";
                    win2.NavigateTo(new Uri("https://example.com/"));
                    win2.Show();
                };
            }

            win.Show();

            // EventHandler<EventArgs> loadCompletedEvt = null!;
            // loadCompletedEvt = (o, e) =>
            // {
            //     win.LoadCompleted -= loadCompletedEvt;
            //     win.Show();
            // };
            // win.LoadCompleted += loadCompletedEvt;
        };
        app.Run();
    }
}
