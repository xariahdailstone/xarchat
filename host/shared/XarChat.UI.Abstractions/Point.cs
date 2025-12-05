using System.Numerics;

namespace XarChat.UI.Abstractions
{
    public record struct Point<T>(T X, T Y)
        where T: INumber<T>;
}
