namespace XarChat.UI.Abstractions
{
    public interface IWindow
    {
        IApplication Application { get; }

        string Title { get; set; }

        Rectangle<int> Bounds { get; set; }

        event EventHandler<EventArgs>? SizeChanged;

        BackgroundForegroundColors? BackgroundColor { get; set; }

        BackgroundForegroundColors? TitlebarColor { get; set; }

        void Show();

        event EventHandler<EventArgs>? Shown;
    }
}
