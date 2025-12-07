
using System.Text.Json.Serialization;

namespace XarChat.FList2.Common.StrongTypes
{
    [JsonConverter(typeof(CharacterName.JsonConverter))]
    public sealed class CharacterName : StronglyTypedComparableValue<CharacterName, string>, 
        ICreatable<string, CharacterName>, 
        IHasWeakReference<CharacterName>,
        IHasComparer<string>
    {
        public static IComparer<string> Comparer => StringComparer.OrdinalIgnoreCase;

        private static ObjectPool<CharacterName, string> _pool = new ObjectPool<CharacterName, string>(StringComparer.OrdinalIgnoreCase);

        public static CharacterName Create(string value)
        {
            var cn = _pool.GetOrCreate(value,
                createFunc: (value) => new CharacterName(value),
                maybeUpgradeFunc: (characterName, value) => characterName.MaybeUpgrade(value));
            return cn;
        }

        private CharacterName(string value) 
            : base(value.ToLower()) 
        {
            MaybeUpgrade(value);
            this.WeakReference = new WeakReference<CharacterName>(this);
        }

        private bool _isUpgraded = false;

        public string CanonicalValue => this.UnderlyingValue;

        public string Value { get; private set; } = null!;

        protected override string SerializationValue => this.Value;

        public WeakReference<CharacterName> WeakReference { get; }

        private void MaybeUpgrade(string value)
        {
            if (!_isUpgraded)
            {
                this.Value = value;
                _isUpgraded = (this.Value != this.UnderlyingValue);
            }
        }
    }
}
