using System.Text.Json.Serialization;

namespace DSRSave.Editors.NpcStateMachine
{
    public class StateMachineSchema
    {
        [JsonPropertyName("schema_version")] public int SchemaVersion { get; set; }
        [JsonPropertyName("flag_address_formula")] public FlagAddressFormulaConfig FlagAddressFormula { get; set; } = new();
        [JsonPropertyName("chr_blob")] public ChrBlobConfig ChrBlob { get; set; } = new();
        [JsonPropertyName("npcs")] public Dictionary<string, NpcEntry> Npcs { get; set; } = new();
        [JsonPropertyName("npc_groups")] public Dictionary<string, NpcGroup> NpcGroups { get; set; } = new();
    }

    public class FlagAddressFormulaConfig
    {
        [JsonPropertyName("buffer_start_offset")] public string BufferStartOffsetHex { get; set; } = "0x53";
        [JsonPropertyName("k_table_by_map")] public Dictionary<string, int> KTableByMap { get; set; } = new();
        [JsonPropertyName("megabank_by_region")] public Dictionary<string, int> MegabankByRegion { get; set; } = new();
    }

    public class ChrBlobConfig
    {
        [JsonPropertyName("offset_from_pattern1")] public string OffsetFromPattern1Hex { get; set; } = "0x16D54";
    }

    public class NpcEntry
    {
        [JsonPropertyName("personal_flag_range")] public List<long>? PersonalFlagRange { get; set; }
        [JsonPropertyName("coupled_npcs")] public Dictionary<string, string>? CoupledNpcs { get; set; }
        [JsonPropertyName("transition_traps_always_clear")] public List<long>? TransitionTrapsAlwaysClear { get; set; }
        [JsonPropertyName("dependent_enemies")] public Dictionary<string, DependentEnemyGroup>? DependentEnemies { get; set; }
        [JsonPropertyName("status_axes")] public Dictionary<string, StatusAxis>? StatusAxes { get; set; }
        [JsonPropertyName("key_stages")] public Dictionary<string, KeyStage>? KeyStages { get; set; }
        [JsonPropertyName("non_key_stages")] public Dictionary<string, NonKeyStage>? NonKeyStages { get; set; }
        // key_stages exist purely for alive/hostile to pick the right per-map
        // chr_bit/trap (e.g. domhnall_of_zena's "stage" is really just which
        // of his 2 map placements he's physically at) -- UIs should still
        // detect/display it but not offer a stage-select/rollback control.
        [JsonPropertyName("stages_read_only")] public bool StagesReadOnly { get; set; }
    }

    public class StatusAxis
    {
        [JsonPropertyName("per_stage")] public Dictionary<string, AxisStageConfig> PerStage { get; set; } = new();
    }

    public class AxisStageConfig
    {
        [JsonPropertyName("set_true")] public Dictionary<string, int> SetTrue { get; set; } = new();
        [JsonPropertyName("set_false")] public Dictionary<string, int> SetFalse { get; set; } = new();
        // Optional, narrower dicts used ONLY for status detection (Describe), when an
        // NPC has more than one real native path into "true"/"false" that don't share
        // every flag SetTrue/SetFalse writes. Falls back to SetTrue/SetFalse when null
        // -- every other NPC is unaffected. See project memory, ds1-alvina.
        [JsonPropertyName("detect_true")] public Dictionary<string, int>? DetectTrue { get; set; }
        [JsonPropertyName("detect_false")] public Dictionary<string, int>? DetectFalse { get; set; }
        [JsonPropertyName("always_clear_traps")] public List<long> AlwaysClearTraps { get; set; } = new();
        [JsonPropertyName("chr_map")] public string? ChrMap { get; set; }
        [JsonPropertyName("chr_bit")] public ChrBitRef? ChrBit { get; set; }
        [JsonPropertyName("obj_bits")] public ObjBitsRef? ObjBits { get; set; }
        [JsonPropertyName("verified")] public bool Verified { get; set; }
    }

    public class ChrBitRef
    {
        [JsonPropertyName("map")] public string Map { get; set; } = "";
        [JsonPropertyName("msb_index")] public int MsbIndex { get; set; }
    }

    public class ObjBitsRef
    {
        [JsonPropertyName("map")] public string Map { get; set; } = "";
        [JsonPropertyName("indices")] public List<int> Indices { get; set; } = new();
    }

    public class KeyStage
    {
        [JsonPropertyName("flags_on")] public List<long> FlagsOn { get; set; } = new();
        [JsonPropertyName("verified")] public bool Verified { get; set; }
    }

    public class NonKeyStage
    {
        [JsonPropertyName("parent")] public string Parent { get; set; } = "";
        [JsonPropertyName("flags_on_add")] public List<long> FlagsOnAdd { get; set; } = new();
        [JsonPropertyName("flags_off")] public List<long> FlagsOff { get; set; } = new();
    }

    public class DependentEnemyGroup
    {
        [JsonPropertyName("entity_ids")] public List<long>? EntityIds { get; set; }
        [JsonPropertyName("chr_map")] public string ChrMap { get; set; } = "";
        [JsonPropertyName("msb_indices")] public List<int> MsbIndices { get; set; } = new();
        [JsonPropertyName("event_slot_flags")] public List<long>? EventSlotFlags { get; set; }
        [JsonPropertyName("revive_at_stages")] public List<string> ReviveAtStages { get; set; } = new();
        [JsonPropertyName("kill_at_stages")] public List<string> KillAtStages { get; set; } = new();
    }

    public class NpcGroup
    {
        [JsonPropertyName("members")] public List<string> Members { get; set; } = new();
        [JsonPropertyName("primary_member")] public string PrimaryMember { get; set; } = "";
        [JsonPropertyName("secondary_member")] public string? SecondaryMember { get; set; }
        [JsonPropertyName("combo_stages")] public Dictionary<string, Dictionary<string, string>>? ComboStages { get; set; }
        [JsonPropertyName("deadlock_notes")] public Dictionary<string, string>? DeadlockNotes { get; set; }
    }
}
