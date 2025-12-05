using System.Numerics;

namespace XarChat.UI.Abstractions
{
    public record struct Size<T>(T Width, T Height)
        where T : INumber<T>;
}
