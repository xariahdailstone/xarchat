using System.Diagnostics.CodeAnalysis;
using System.Numerics;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace XarChat.FList2.Common.StrongTypes
{
    [JsonSerializable(typeof(decimal?))]
    public partial class StronglyTypedValueJsonSerializerContext : JsonSerializerContext
    {

    }

    public abstract class StronglyTypedValue<TType, TUnderlyingType> :
        IEquatable<TType>
        where TType : StronglyTypedValue<TType, TUnderlyingType>, ICreatable<TUnderlyingType, TType>
        where TUnderlyingType : notnull
    {
        public class JsonConverter : JsonConverter<TType>
        {
            public override TType ReadAsPropertyName(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            {
                var str = reader.GetString();
                var udata = (TUnderlyingType)Convert.ChangeType(str, typeof(TUnderlyingType))!;
                var result = TType.Create(udata);
                return result;
            }

            public override void WriteAsPropertyName(Utf8JsonWriter writer, [DisallowNull] TType value, JsonSerializerOptions options)
            {
                writer.WritePropertyName(value.SerializationValue.ToString());
            }

            public override TType? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            {
                if (IsNumberType(typeof(TUnderlyingType)))
                {
                    var udata = JsonSerializer.Deserialize<decimal?>(ref reader, StronglyTypedValueJsonSerializerContext.Default.Options);
                    return udata is not null ? TType.Create((TUnderlyingType)Convert.ChangeType(udata, typeof(TUnderlyingType))) : null;
                }
                else
                {
                    var udata = JsonSerializer.Deserialize<TUnderlyingType>(ref reader, options);
                    return udata is not null ? TType.Create(udata) : null;
                }
            }

            private bool IsNumberType(Type type)
            {
                return type == typeof(int);
            }

            public override void Write(Utf8JsonWriter writer, TType value, JsonSerializerOptions options)
            {
                if (value is not null)
                {
                    JsonSerializer.Serialize(writer, value.SerializationValue, options);
                }
                else
                {
                    writer.WriteNullValue();
                }
            }
        }

        protected StronglyTypedValue(TUnderlyingType value)
        {
            this.UnderlyingValue = value;
        }

        protected TUnderlyingType UnderlyingValue { get; }

        protected virtual TUnderlyingType SerializationValue => UnderlyingValue;

        public override bool Equals(object? obj)
        {
            if (!(obj is TType t)) { return false; }
            return Equals(t);
        }

        public bool Equals(TType? other)
        {
            if (other is null) { return false; }
            if (this.UnderlyingValue is null && other.UnderlyingValue is null) { return true; }
            if (this.UnderlyingValue is null || other.UnderlyingValue is null) { return false; }
            return this.UnderlyingValue.Equals(other.UnderlyingValue);
        }

        public override string? ToString() => UnderlyingValue?.ToString();

        public override int GetHashCode() => UnderlyingValue?.GetHashCode() ?? 0;

        public static explicit operator StronglyTypedValue<TType, TUnderlyingType>(TUnderlyingType underlyingValue) => TType.Create(underlyingValue);

        public static explicit operator TUnderlyingType(StronglyTypedValue<TType, TUnderlyingType> value) => value.UnderlyingValue;


        public static bool operator ==(
            StronglyTypedValue<TType, TUnderlyingType>? left, StronglyTypedValue<TType, TUnderlyingType>? right)
        {
            if (left is null && right is null) { return true; }
            if (left is null || right is null) { return false; }
            return Object.Equals(left.UnderlyingValue, right.UnderlyingValue);
        }

        public static bool operator !=(StronglyTypedValue<TType, TUnderlyingType>? left, StronglyTypedValue<TType, TUnderlyingType>? right)
            => !(left == right);
    }
}
