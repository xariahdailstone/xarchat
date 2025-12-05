using System.Numerics;

namespace XarChat.UI.Abstractions
{
    public record struct Rectangle<T>(Point<T> Location, Size<T> Size)
        where T : INumber<T>
    {
        public Rectangle(T x, T y, Size<T> size)
            : this(new Point<T>(x, y), size)
        {
        }

        public Rectangle(Point<T> location, T width, T height)
            : this(location, new Size<T>(width, height))
        {
        }

        public Rectangle(T x, T y, T width, T height)
            : this(new Point<T>(x, y), new Size<T>(width, height))
        {
        }

        public T X => this.Location.X;
        public T Y => this.Location.Y;
        public T Width => this.Size.Width;
        public T Height => this.Size.Height;
    }
}
