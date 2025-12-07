using System.Numerics;

namespace XarChat.FList2.Common.StrongTypes
{
    public abstract class StronglyTypedNumberValue<TType, TUnderlyingType> : StronglyTypedComparableValue<TType, TUnderlyingType>,
        IEqualityOperators<StronglyTypedNumberValue<TType, TUnderlyingType>, StronglyTypedNumberValue<TType, TUnderlyingType>, bool>
        where TType : StronglyTypedNumberValue<TType, TUnderlyingType>, ICreatable<TUnderlyingType, TType>, IHasComparer<TUnderlyingType>
        where TUnderlyingType : notnull, INumber<TUnderlyingType>
    {
        protected StronglyTypedNumberValue(TUnderlyingType value) : base(value) { }

        public TUnderlyingType Value => this.UnderlyingValue;

        public override bool Equals(object? obj) => base.Equals(obj);

        public override int GetHashCode() => base.GetHashCode();

        public static bool operator ==(
            StronglyTypedNumberValue<TType, TUnderlyingType>? left, StronglyTypedNumberValue<TType, TUnderlyingType>? right)
            => (left as StronglyTypedValue<TType, TUnderlyingType>) == (right as StronglyTypedValue<TType, TUnderlyingType>);

        public static bool operator !=(StronglyTypedNumberValue<TType, TUnderlyingType>? left, StronglyTypedNumberValue<TType, TUnderlyingType>? right)
            => !(left == right);
    }

    public interface IHasComparer<T>
    {
        abstract static IComparer<T> Comparer { get; }
    }

    public abstract class StronglyTypedComparableValue<TType, TUnderlyingType> : StronglyTypedValue<TType, TUnderlyingType>,
        IComparable<StronglyTypedComparableValue<TType, TUnderlyingType>>,
        IComparisonOperators<StronglyTypedComparableValue<TType, TUnderlyingType>, StronglyTypedComparableValue<TType, TUnderlyingType>, bool>
        where TType : StronglyTypedComparableValue<TType, TUnderlyingType>, ICreatable<TUnderlyingType, TType>, IHasComparer<TUnderlyingType>
        where TUnderlyingType : notnull, IComparable<TUnderlyingType>
    {
        protected StronglyTypedComparableValue(TUnderlyingType value) : base(value) { }

        public TUnderlyingType Value => this.UnderlyingValue;

        public int CompareTo(StronglyTypedComparableValue<TType, TUnderlyingType>? other)
            => Compare(this, other);

        public override bool Equals(object? obj) => base.Equals(obj);

        public override int GetHashCode() => base.GetHashCode();

        private static int Compare(
            StronglyTypedComparableValue<TType, TUnderlyingType>? left,
            StronglyTypedComparableValue<TType, TUnderlyingType>? right)
        {
            return TType.Comparer.Compare(
                left is not null ? left.UnderlyingValue : default,
                right is not null ? right.UnderlyingValue : default);
        }

        public static bool operator ==(
            StronglyTypedComparableValue<TType, TUnderlyingType>? left, StronglyTypedComparableValue<TType, TUnderlyingType>? right)
            => Compare(left, right) == 0;

        public static bool operator !=(
            StronglyTypedComparableValue<TType, TUnderlyingType>? left, StronglyTypedComparableValue<TType, TUnderlyingType>? right)
            => !(left == right);

        public static bool operator <(StronglyTypedComparableValue<TType, TUnderlyingType> left, StronglyTypedComparableValue<TType, TUnderlyingType> right)
            => Compare(left, right) < 0;

        public static bool operator >(StronglyTypedComparableValue<TType, TUnderlyingType> left, StronglyTypedComparableValue<TType, TUnderlyingType> right)
            => Compare(left, right) > 0;

        public static bool operator <=(StronglyTypedComparableValue<TType, TUnderlyingType> left, StronglyTypedComparableValue<TType, TUnderlyingType> right)
            => Compare(left, right) <= 0;

        public static bool operator >=(StronglyTypedComparableValue<TType, TUnderlyingType> left, StronglyTypedComparableValue<TType, TUnderlyingType> right)
            => Compare(left, right) >= 0;
    }
}
