using System.Text.Json;

namespace DSRSave.Editors.NpcStatus
{
    public class NpcStatusWarning : Exception
    {
        public NpcStatusWarning(string message) : base(message) { }
    }

    public class NpcStatusService
    {
        private readonly Character _character;
        private readonly int _baseOffset;

        public NpcStatusCollection Data { get; }

        public NpcStatusService(Character character, string jsonPath)
        {
            _character = character;

            var patternOffsets = character.FindPattern1().ToList();
            if (patternOffsets.Count == 0)
                throw new Exception("pattern1 not found in this character's save data.");
            _baseOffset = patternOffsets.Last();

            string json = File.ReadAllText(jsonPath);
            Data = JsonSerializer.Deserialize<NpcStatusCollection>(json)
                   ?? throw new Exception($"Failed to parse '{jsonPath}'.");
        }

        public NpcDefinition? Find(string name) =>
            Data.Npcs.FirstOrDefault(n => n.Name.Equals(name, StringComparison.OrdinalIgnoreCase));

        // ---------- reading ----------

        private bool ReadBit(FlagRef flag)
        {
            int offset = _baseOffset + flag.Offset!.Value;
            byte b = _character[offset];
            return ((b >> flag.Bit!.Value) & 1) != 0;
        }

        /// <summary>True = alive, False = dead, Unknown = positions disagree or none are known.</summary>
        public TriState GetAliveStatus(NpcDefinition npc)
        {
            var known = npc.Positions.Where(p => p.Death.IsKnown).ToList();
            if (known.Count == 0) return TriState.Unknown;

            bool? allDead = null;
            foreach (var p in known)
            {
                bool dead = ReadBit(p.Death);
                if (allDead == null) allDead = dead;
                else if (allDead != dead) return TriState.Unknown; // positions disagree
            }
            return allDead!.Value ? TriState.False : TriState.True;
        }

        public TriState GetAggroStatus(NpcDefinition npc)
        {
            if (npc.Aggro.Status == FlagStatus.NotApplicable) return TriState.False;
            var known = npc.Aggro.Bits.Where(b => b.IsKnown).ToList();
            if (known.Count == 0) return TriState.Unknown;
            // Any known bit set => treated as aggro'd (these are OR-style triggers in every traced case).
            return known.Any(ReadBit) ? TriState.True : TriState.False;
        }

        /// <summary>Highest confirmed/candidate stage whose flag reads set, plus whether an unresolved
        /// ("open") stage exists above it that could mean the real progress is further along.</summary>
        public (QuestStage? current, bool anyUnknownAbove) GetQuestStage(NpcDefinition npc)
        {
            QuestStage? current = null;
            bool unknownAbove = false;

            foreach (var s in npc.QuestStages.OrderBy(s => s.Order))
            {
                if (!s.Flag.IsKnown)
                {
                    if (current != null) unknownAbove = true;
                    continue;
                }
                if (ReadBit(s.Flag)) current = s;
            }
            return (current, unknownAbove);
        }

        // ---------- writing ----------

        private void WriteBit(FlagRef flag, bool value)
        {
            int offset = _baseOffset + flag.Offset!.Value;
            byte current = _character[offset];
            byte mask = (byte)(1 << flag.Bit!.Value);
            _character[offset] = value ? (byte)(current | mask) : (byte)(current & ~mask);
        }

        /// <summary>Sets every known position's death flag. Returns the labels of any positions
        /// that could NOT be changed because their flag is unknown ("???").</summary>
        public List<string> SetAlive(NpcDefinition npc, bool alive)
        {
            var skipped = new List<string>();
            foreach (var p in npc.Positions)
            {
                if (!p.Death.IsKnown) { skipped.Add(p.Label); continue; }
                WriteBit(p.Death, !alive); // death bit convention: 1 = dead/triggered
            }
            return skipped;
        }

        public void SetAggro(NpcDefinition npc, bool aggro)
        {
            if (npc.Aggro.Status == FlagStatus.NotApplicable)
                throw new NpcStatusWarning($"{npc.Name}: no hostility mechanism exists for this NPC — nothing to set.");

            var known = npc.Aggro.Bits.Where(b => b.IsKnown).ToList();
            if (known.Count == 0)
                throw new NpcStatusWarning($"{npc.Name}: aggro mechanism is unknown (???) — can't be set yet.");

            foreach (var b in known) WriteBit(b, aggro);
        }

        /// <summary>Moves this NPC's OWN quest-stage ladder to targetOrder: every stage with
        /// order &lt;= targetOrder is set true, every stage with order &gt; targetOrder is set false.
        /// Stages with an unknown flag are skipped (reported back), never guessed.
        /// Cross-NPC dependencies are never touched — only returned as warning strings.</summary>
        public (List<string> skipped, List<string> dependencyWarnings) SetQuestStage(NpcDefinition npc, int targetOrder)
        {
            var skipped = new List<string>();
            foreach (var s in npc.QuestStages)
            {
                if (!s.Flag.IsKnown) { skipped.Add(s.Name); continue; }
                WriteBit(s.Flag, s.Order <= targetOrder);
            }
            return (skipped, new List<string>(npc.Dependencies));
        }
    }
}
