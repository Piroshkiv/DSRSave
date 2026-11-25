using System.Text.Json;
using System.Text.Json.Serialization;

namespace DSRSave.Editors.NpcStatus
{
    [JsonConverter(typeof(FlagStatusJsonConverter))]
    public enum FlagStatus
    {
        Confirmed,
        Candidate,
        Open,
        NotApplicable
    }

    public class FlagStatusJsonConverter : JsonConverter<FlagStatus>
    {
        public override FlagStatus Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            return reader.GetString() switch
            {
                "confirmed" => FlagStatus.Confirmed,
                "candidate" => FlagStatus.Candidate,
                "not_applicable" => FlagStatus.NotApplicable,
                _ => FlagStatus.Open,
            };
        }

        public override void Write(Utf8JsonWriter writer, FlagStatus value, JsonSerializerOptions options)
        {
            writer.WriteStringValue(value switch
            {
                FlagStatus.Confirmed => "confirmed",
                FlagStatus.Candidate => "candidate",
                FlagStatus.NotApplicable => "not_applicable",
                _ => "open",
            });
        }
    }

    public enum TriState
    {
        True,
        False,
        Unknown
    }

    public class FlagRef
    {
        [JsonPropertyName("offset")]
        public string? OffsetHex { get; set; }

        [JsonPropertyName("bit")]
        public int? Bit { get; set; }

        [JsonPropertyName("status")]
        public FlagStatus Status { get; set; } = FlagStatus.Open;

        [JsonPropertyName("note")]
        public string? Note { get; set; }

        [JsonIgnore]
        public int? Offset => OffsetHex == null ? null : Convert.ToInt32(OffsetHex, 16);

        [JsonIgnore]
        public bool IsKnown => Status != FlagStatus.Open && Offset != null && Bit != null;
    }

    public class NpcPosition
    {
        [JsonPropertyName("label")]
        public string Label { get; set; } = "";

        [JsonPropertyName("death")]
        public FlagRef Death { get; set; } = new();
    }

    public class AggroInfo
    {
        [JsonPropertyName("status")]
        public FlagStatus Status { get; set; } = FlagStatus.Open;

        [JsonPropertyName("note")]
        public string? Note { get; set; }

        [JsonPropertyName("bits")]
        public List<FlagRef> Bits { get; set; } = new();
    }

    public class QuestStage
    {
        [JsonPropertyName("order")]
        public int Order { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("flag")]
        public FlagRef Flag { get; set; } = new();

        [JsonPropertyName("note")]
        public string? Note { get; set; }
    }

    public class NpcDefinition
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("category")]
        public string Category { get; set; } = "npc";

        [JsonPropertyName("positions")]
        public List<NpcPosition> Positions { get; set; } = new();

        [JsonPropertyName("aggro")]
        public AggroInfo Aggro { get; set; } = new();

        [JsonPropertyName("questStages")]
        public List<QuestStage> QuestStages { get; set; } = new();

        [JsonPropertyName("dependencies")]
        public List<string> Dependencies { get; set; } = new();
    }

    public class NpcStatusCollection
    {
        [JsonPropertyName("npcs")]
        public List<NpcDefinition> Npcs { get; set; } = new();
    }
}
