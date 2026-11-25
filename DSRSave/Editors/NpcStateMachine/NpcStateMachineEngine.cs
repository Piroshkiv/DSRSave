using System.Text.Json;

namespace DSRSave.Editors.NpcStateMachine
{
    public class NpcStateMachineException : Exception
    {
        public NpcStateMachineException(string message) : base(message) { }
    }

    /// <summary>C# port of tools/npc-state-machine/cli.py (schema_version 2). Reads/writes
    /// the generic per-NPC flag/CHR-blob state machine described in npc_state_machine.json:
    /// jump an NPC to a quest stage ("rollback"), or flip just its alive/hostile axis
    /// ("revive"/"kill"/"aggro"/"calm") without moving the quest stage. See that Python
    /// file's own docstring and the project's memory notes for the methodology this
    /// schema encodes (EventFlag address formula, CHR-blob forced-state blob, the
    /// "always_clear_traps" one-shot-flag sweep, dependent_enemies, npc_groups).</summary>
    public class NpcStateMachineEngine
    {
        public StateMachineSchema Schema { get; }

        public NpcStateMachineEngine(string jsonPath)
        {
            string json = File.ReadAllText(jsonPath);
            Schema = JsonSerializer.Deserialize<StateMachineSchema>(json)
                     ?? throw new NpcStateMachineException($"Failed to parse '{jsonPath}'.");
        }

        private static int GetBit(Character c, int offset, int bit) => (c[offset] >> bit) & 1;

        private static void SetBit(Character c, int offset, int bit, int value)
        {
            byte b = c[offset];
            if (value != 0) b |= (byte)(1 << bit);
            else b &= (byte)~(1 << bit);
            c[offset] = b;
        }

        /// <summary>A flag key is normally a decimal EventFlag id, resolved via the k-table
        /// formula (FlagAddr.Addr). Some bits (so far: exactly one, Gwynevere's 0x16D77
        /// bit7) were live-bisected to a real pattern1-relative byte+bit in a past session
        /// but never resolved to an actual EventFlag id despite repeated attempts -- for
        /// those, the key is the string "raw:&lt;hex_offset&gt;:&lt;bit&gt;" (e.g.
        /// "raw:0x16D77:7"), addressed directly as pattern1+offset, bypassing the
        /// k-table/buffer_start formula entirely. This mirrors how the OLD npc_data.json/
        /// NpcStatusService system addresses every flag -- use it only when a flag id
        /// genuinely can't be found, not as a shortcut.</summary>
        private static (int offset, int bit) ResolveAddr(FlagAddr fa, int p1, string key)
        {
            if (key.StartsWith("raw:"))
            {
                var parts = key.Split(':');
                int off = Convert.ToInt32(parts[1], 16);
                int bit = int.Parse(parts[2]);
                return (p1 + off, bit);
            }
            return fa.Addr(long.Parse(key));
        }

        private static void SetFlags(FlagAddr fa, int p1, Character c, Dictionary<string, int> flagValues)
        {
            foreach (var (key, val) in flagValues)
            {
                var (off, bit) = ResolveAddr(fa, p1, key);
                SetBit(c, off, bit, val);
            }
        }

        private static void SetFlags(FlagAddr fa, Character c, IEnumerable<long> flagIds, int value)
        {
            foreach (var fid in flagIds)
            {
                var (off, bit) = fa.Addr(fid);
                SetBit(c, off, bit, value);
            }
        }

        /// <summary>Every flag id this NPC's definition ever reads or writes -- used both
        /// to print a full status dump and as the "universe" swept to 0 on a key_stage jump.</summary>
        private static List<long> AllFlagIds(NpcEntry npc)
        {
            var ids = new HashSet<long>();
            if (npc.KeyStages != null)
                foreach (var st in npc.KeyStages.Values) ids.UnionWith(st.FlagsOn);
            if (npc.NonKeyStages != null)
                foreach (var st in npc.NonKeyStages.Values) { ids.UnionWith(st.FlagsOnAdd); ids.UnionWith(st.FlagsOff); }
            if (npc.StatusAxes != null)
                foreach (var axis in npc.StatusAxes.Values)
                    foreach (var st in axis.PerStage.Values)
                    {
                        ids.UnionWith(st.SetTrue.Keys.Where(k => !k.StartsWith("raw:")).Select(long.Parse));
                        ids.UnionWith(st.SetFalse.Keys.Where(k => !k.StartsWith("raw:")).Select(long.Parse));
                        ids.UnionWith(st.AlwaysClearTraps);
                    }
            if (npc.TransitionTrapsAlwaysClear != null) ids.UnionWith(npc.TransitionTrapsAlwaysClear);
            if (npc.PersonalFlagRange is { Count: 2 } pfr)
                for (long f = pfr[0]; f <= pfr[1]; f++) ids.Add(f);
            return ids.OrderBy(x => x).ToList();
        }

        private static void ApplyStageFlagsOn(FlagAddr fa, Character c, List<long> idsUniverse, IEnumerable<long> flagsOn)
        {
            var onSet = new HashSet<long>(flagsOn);
            foreach (var fid in idsUniverse)
            {
                var (off, bit) = fa.Addr(fid);
                SetBit(c, off, bit, onSet.Contains(fid) ? 1 : 0);
            }
        }

        /// <summary>Resolves either a key_stage id or a non_key_stage id into its full flags_on list.</summary>
        private static (List<long> flagsOn, bool verified) ResolveStageFlagsOn(NpcEntry npc, string stageId)
        {
            if (npc.KeyStages != null && npc.KeyStages.TryGetValue(stageId, out var ks))
                return (ks.FlagsOn, ks.Verified);
            if (npc.NonKeyStages != null && npc.NonKeyStages.TryGetValue(stageId, out var nk))
            {
                var parent = npc.KeyStages![nk.Parent];
                var flagsOn = new HashSet<long>(parent.FlagsOn);
                flagsOn.UnionWith(nk.FlagsOnAdd);
                flagsOn.ExceptWith(nk.FlagsOff);
                return (flagsOn.OrderBy(x => x).ToList(), parent.Verified);
            }
            throw new KeyNotFoundException($"'{stageId}' is not a key_stage or non_key_stage");
        }

        /// <summary>Normalizes one status axis (alive/hostile) to the given target for a
        /// specific stage, using that stage's own per_stage config. No-op if the NPC/stage
        /// has no definition for this axis.</summary>
        private void ApplyAxisForStage(FlagAddr fa, Character c, int p1, NpcEntry npc, string axisName, bool targetTrue, string stageId)
        {
            if (npc.StatusAxes == null || !npc.StatusAxes.TryGetValue(axisName, out var axis)) return;
            // Fall back to a "default" entry if this axis isn't repeated per named stage
            // (e.g. a hostile flag that's the same regardless of which map placement is
            // active) -- otherwise rollback would silently skip normalizing this axis for
            // any stage id other than literally "default".
            if (!axis.PerStage.TryGetValue(stageId, out var axisCfg) && !axis.PerStage.TryGetValue("default", out axisCfg))
                return;

            var toSet = targetTrue ? axisCfg.SetTrue : axisCfg.SetFalse;
            Console.WriteLine($"  normalizing {axisName}={targetTrue}: {{{string.Join(", ", toSet.Select(kv => $"\"{kv.Key}\": {kv.Value}"))}}}");
            SetFlags(fa, p1, c, toSet);

            if (axisCfg.AlwaysClearTraps.Count > 0)
                SetFlags(fa, c, axisCfg.AlwaysClearTraps, 0);

            if (axisName == "alive")
            {
                ApplyChrObjBits(p1, c.GetRawData(), axisCfg, targetTrue);
                if (targetTrue)
                    SweepSiblingChrBitsAlive(p1, c.GetRawData(), npc);
            }
        }

        /// <summary>Revive-only safety net for multi-placement NPCs that can end up with a
        /// STALE duplicate body left over from a native engine race (e.g. trusty_patches +
        /// Rhea's flag 1173, see project memory) -- if the player killed one of the two
        /// simultaneously-visible copies, only ITS OWN ChrBit gets forced-dead by the native
        /// kill; a plain revive only clears the ChrBit for whichever single stage flags
        /// currently point to, leaving the OTHER placement's ChrBit stuck forced-dead. This
        /// sweeps EVERY ChrBit listed across all of this NPC's alive.PerStage entries to
        /// "not forced-dead" on every revive, regardless of which one is the currently-active
        /// stage. Safe and NOT the reverted "enforce_sibling_exclusivity" idea: this only ever
        /// CLEARS ChrBit (never forces one on), so it can't fake-kill a placement.</summary>
        private void SweepSiblingChrBitsAlive(int p1, byte[] buf, NpcEntry npc)
        {
            if (npc.StatusAxes == null || !npc.StatusAxes.TryGetValue("alive", out var axis)) return;
            var chrBlob = new ChrBlob(Schema, p1, buf);
            var seen = new HashSet<(string, int)>();
            foreach (var cfg in axis.PerStage.Values)
            {
                if (cfg.ChrBit == null) continue;
                var key = (cfg.ChrBit.Map, cfg.ChrBit.MsbIndex);
                if (!seen.Add(key)) continue;
                chrBlob.SetBits(cfg.ChrBit.Map, new[] { cfg.ChrBit.MsbIndex }, 0);
            }
        }

        /// <summary>Some NPCs' native death-watcher wipes their WHOLE PersonalFlagRange on
        /// death (e.g. trusty_patches at Firelink), erasing which location they were at.
        /// DetectCurrentStage can still recover the right stage via the CHR blob, but that
        /// recovery is read-only -- it doesn't repair the save. On revive, if the detected
        /// stage's own FlagsOn aren't actually all set (proof the location flags are still
        /// wiped/inconsistent), restore them so the save's data matches where we just
        /// determined the NPC physically is. No-op for the overwhelming majority of
        /// NPCs/stages, where FlagsOn is already satisfied (that's WHY this stage was
        /// detected).</summary>
        private void RestoreLocationFlagsIfWiped(FlagAddr fa, Character c, NpcEntry npc, List<long> ids, string stageId)
        {
            if (npc.KeyStages == null || !npc.KeyStages.TryGetValue(stageId, out var st)) return;
            bool alreadyOk = st.FlagsOn.All(fid =>
            {
                var (off, bit) = fa.Addr(fid);
                return GetBit(c, off, bit) == 1;
            });
            if (alreadyOk) return;
            ApplyStageFlagsOn(fa, c, ids, st.FlagsOn);
        }

        /// <summary>Shared by both the stage-rollback path and the plain revive/kill
        /// path (previously this logic was duplicated and the plain AxisAction path
        /// forgot ChrBit entirely -- see project memory, 'axisAction chr_bit gap').
        /// Bidirectional: revive clears the bit (0, 'not forced-dead'), kill sets it
        /// (1, 'forced-dead' -- triggers the real native kill/destroy routine on next
        /// load, matching what a genuine kill does). ChrMap blunt-defang is
        /// revive-only (no sane 'force the whole map dead' counterpart).</summary>
        private void ApplyChrObjBits(int p1, byte[] buf, AxisStageConfig axisCfg, bool targetTrue)
        {
            var chrBlob = new ChrBlob(Schema, p1, buf);
            if (targetTrue)
            {
                chrBlob.DefangMap(axisCfg.ChrMap);
                if (axisCfg.ChrBit != null)
                    chrBlob.SetBits(axisCfg.ChrBit.Map, new[] { axisCfg.ChrBit.MsbIndex }, 0);
            }
            else if (axisCfg.ChrBit != null)
            {
                chrBlob.SetBits(axisCfg.ChrBit.Map, new[] { axisCfg.ChrBit.MsbIndex }, 1);
            }

            if (axisCfg.ObjBits != null)
            {
                var objBlob = new ObjBlob(Schema, p1, buf);
                objBlob.SetBits(axisCfg.ObjBits.Map, axisCfg.ObjBits.Indices, targetTrue ? 0 : 1);
            }
        }

        /// <summary>Jumps an NPC straight to a quest stage: sets its personal flags_on, then
        /// always normalizes it to alive+not-hostile for that stage. Returns the "axis stage
        /// id" used for the alive/hostile/dependent_enemies lookup (a non_key_stage resolves
        /// to its parent key_stage id, since sub-variants don't have their own status_axes).</summary>
        private string ApplyNpcStage(FlagAddr fa, Character c, int p1, NpcEntry npc, string stageId)
        {
            var ids = AllFlagIds(npc);
            var (flagsOn, verified) = ResolveStageFlagsOn(npc, stageId);
            if (!verified)
                Console.WriteLine($"  WARNING: stage '{stageId}' is THEORETICAL / not live-verified yet. Proceeding anyway.");
            ApplyStageFlagsOn(fa, c, ids, flagsOn);

            string axisStageId = (npc.NonKeyStages != null && npc.NonKeyStages.TryGetValue(stageId, out var nk)) ? nk.Parent : stageId;
            ApplyAxisForStage(fa, c, p1, npc, "alive", true, axisStageId);
            ApplyAxisForStage(fa, c, p1, npc, "hostile", false, axisStageId);
            return axisStageId;
        }

        /// <summary>For an NPC whose quest fork depends on OTHER entities' life/death (e.g.
        /// Siegmeyer's Lost Izalith Chaos Eaters) -- brings those entities' CHR-blob bits
        /// (and, if present, their own permanent "already died once" EventFlag latch) in
        /// line with the target stage.</summary>
        private void ApplyDependentEnemies(FlagAddr fa, Character c, int p1, NpcEntry npc, string stageId, string reviveCount)
        {
            if (npc.DependentEnemies == null) return;
            var chrBlob = new ChrBlob(Schema, p1, c.GetRawData());
            foreach (var (name, cfg) in npc.DependentEnemies)
            {
                var indices = cfg.MsbIndices;
                if (cfg.ReviveAtStages.Contains(stageId))
                {
                    int n = reviveCount == "one" ? 1 : indices.Count;
                    var chosen = indices.Take(n).ToList();
                    Console.WriteLine($"  dependent enemy group '{name}': reviving {chosen.Count}/{indices.Count} (msb [{string.Join(",", chosen)}])");
                    chrBlob.SetBits(cfg.ChrMap, chosen, 0);
                    if (cfg.EventSlotFlags != null)
                    {
                        var chosenFlags = cfg.EventSlotFlags.Take(n).ToList();
                        Console.WriteLine($"  dependent enemy group '{name}': clearing permanent-death latch flags [{string.Join(",", chosenFlags)}]");
                        SetFlags(fa, c, chosenFlags, 0);
                    }
                }
                else if (cfg.KillAtStages.Contains(stageId))
                {
                    Console.WriteLine($"  dependent enemy group '{name}': killing all {indices.Count} (msb [{string.Join(",", indices)}])");
                    chrBlob.SetBits(cfg.ChrMap, indices, 1);
                    if (cfg.EventSlotFlags != null)
                    {
                        Console.WriteLine($"  dependent enemy group '{name}': setting permanent-death latch flags [{string.Join(",", cfg.EventSlotFlags)}]");
                        SetFlags(fa, c, cfg.EventSlotFlags, 1);
                    }
                }
            }
        }

        /// <summary>Picks the key_stage whose flags_on best matches the save's real flags.
        /// For each key_stage, also tries every HIDDEN non_key_stage that resolves to it
        /// (via ResolveStageFlagsOn) and keeps whichever variant mismatches least -- this is
        /// what makes a hidden sub-variant (e.g. trusty_patches' forgiven_awaiting_nito,
        /// folded into pit_pushed) detect correctly as its PARENT without relying on
        /// dictionary insertion order to break a mismatch-count tie. Returns a key_stage id,
        /// never a non_key_stage id.</summary>
        private string DetectCurrentStage(FlagAddr fa, int p1, Character c, NpcEntry npc, List<long> ids, bool announce = true)
        {
            if (npc.KeyStages == null || npc.KeyStages.Count == 0) return "default";
            var vals = new Dictionary<long, int>();
            foreach (var fid in ids)
            {
                var (off, bit) = fa.Addr(fid);
                vals[fid] = GetBit(c, off, bit);
            }
            int MismFor(IEnumerable<long> flagsOn)
            {
                var wantedOn = new HashSet<long>(flagsOn);
                return ids.Count(fid => wantedOn.Contains(fid) != (vals.GetValueOrDefault(fid) != 0));
            }
            var childrenByParent = new Dictionary<string, List<string>>();
            if (npc.NonKeyStages != null)
                foreach (var (nkId, nk) in npc.NonKeyStages)
                {
                    if (!childrenByParent.TryGetValue(nk.Parent, out var list))
                        childrenByParent[nk.Parent] = list = new List<string>();
                    list.Add(nkId);
                }
            var scores = new Dictionary<string, int>();
            foreach (var (stageId, st) in npc.KeyStages)
            {
                int mism = MismFor(st.FlagsOn);
                if (childrenByParent.TryGetValue(stageId, out var children))
                    foreach (var nkId in children)
                    {
                        var (nkFlagsOn, _) = ResolveStageFlagsOn(npc, nkId);
                        mism = Math.Min(mism, MismFor(nkFlagsOn));
                    }
                scores[stageId] = mism;
            }
            int bestMism = scores.Values.Min();
            var tied = scores.Where(kv => kv.Value == bestMism).Select(kv => kv.Key).ToList();

            string bestId = tied[0];
            if (tied.Count > 1)
            {
                // A multi-placement NPC whose native death-watcher wipes its whole
                // PersonalFlagRange on death (e.g. trusty_patches at Firelink) can leave
                // EVERY key_stage equally mismatched -- EventFlags alone can't say which
                // placement he died at. Break the tie using the CHR blob: whichever tied
                // stage's OWN ChrBit is currently forced-dead is concrete physical
                // evidence he's actually there.
                var alivePerStage = npc.StatusAxes != null && npc.StatusAxes.TryGetValue("alive", out var aliveAxis)
                    ? aliveAxis.PerStage : new Dictionary<string, AxisStageConfig>();
                var chrBlob = new ChrBlob(Schema, p1, c.GetRawData());
                var deadCandidates = tied.Where(sid =>
                    alivePerStage.TryGetValue(sid, out var cfg) && cfg.ChrBit != null &&
                    chrBlob.GetBit(cfg.ChrBit.Map, cfg.ChrBit.MsbIndex) == 1).ToList();
                if (deadCandidates.Count == 1) bestId = deadCandidates[0];
            }
            if (announce)
                Console.WriteLine($"Detected current stage: {bestId} ({bestMism} flags differ from its ideal flags_on)");
            return bestId;
        }

        private bool MatchesFlagDict(FlagAddr fa, int p1, Character c, Dictionary<string, int> dict)
        {
            foreach (var (key, want) in dict)
            {
                var (off, bit) = ResolveAddr(fa, p1, key);
                if (GetBit(c, off, bit) != want) return false;
            }
            return true;
        }

        /// <summary>Best-effort, read-only one-line summary for a menu: current best-matching
        /// stage plus alive/hostile reading for that stage (never throws -- returns "?" for
        /// anything it can't determine, so a listing never crashes on an incomplete entry).</summary>
        public (string stage, string alive, string hostile) Summarize(Character c, string npcId)
        {
            try
            {
                var npc = GetNpc(npcId);
                int p1 = c.FindPattern1().Last();
                var fa = new FlagAddr(Schema, p1);
                var ids = AllFlagIds(npc);
                string stage = DetectCurrentStage(fa, p1, c, npc, ids, announce: false);

                string Describe(string axisName)
                {
                    if (npc.StatusAxes == null || !npc.StatusAxes.TryGetValue(axisName, out var axis)) return "n/a";
                    if (!axis.PerStage.TryGetValue(stage, out var cfg) && !axis.PerStage.TryGetValue("default", out cfg)) return "?";
                    if (MatchesFlagDict(fa, p1, c, cfg.DetectTrue ?? cfg.SetTrue)) return axisName == "alive" ? "alive" : "hostile";
                    if (MatchesFlagDict(fa, p1, c, cfg.DetectFalse ?? cfg.SetFalse)) return axisName == "alive" ? "dead" : "calm";
                    return "?";
                }

                return (stage, Describe("alive"), Describe("hostile"));
            }
            catch
            {
                return ("?", "?", "?");
            }
        }

        /// <summary>All stage ids this NPC can be rolled back to, each with whether it's
        /// live-verified (vs. theoretical/data-only).</summary>
        public List<(string id, bool verified)> ListStages(string npcId)
        {
            var npc = GetNpc(npcId);
            var result = new List<(string, bool)>();
            if (npc.KeyStages != null)
                foreach (var (id, st) in npc.KeyStages) result.Add((id, st.Verified));
            if (npc.NonKeyStages != null)
                foreach (var (id, nk) in npc.NonKeyStages)
                {
                    bool verified = npc.KeyStages != null && npc.KeyStages.TryGetValue(nk.Parent, out var parent) && parent.Verified;
                    result.Add((id, verified));
                }
            return result;
        }

        // ---------- public commands ----------

        public NpcEntry GetNpc(string id)
        {
            if (!Schema.Npcs.TryGetValue(id, out var npc))
                throw new NpcStateMachineException(
                    $"Unknown npc '{id}'. Known npcs: {string.Join(", ", Schema.Npcs.Keys)}. Known groups: {string.Join(", ", Schema.NpcGroups.Keys)}");
            return npc;
        }

        public void Status(Character c, string npcId)
        {
            var npc = GetNpc(npcId);
            int p1 = c.FindPattern1().Last();
            var fa = new FlagAddr(Schema, p1);

            var ids = AllFlagIds(npc);
            var vals = new Dictionary<long, int>();
            foreach (var fid in ids)
            {
                var (off, bit) = fa.Addr(fid);
                vals[fid] = GetBit(c, off, bit);
            }
            Console.WriteLine("Flag values:");
            foreach (var fid in ids) Console.WriteLine($"  {fid,10} = {vals[fid]}");

            if (npc.KeyStages != null && npc.KeyStages.Count > 0)
            {
                var childrenByParent = new Dictionary<string, List<string>>();
                if (npc.NonKeyStages != null)
                    foreach (var (nkId, nk) in npc.NonKeyStages)
                    {
                        if (!childrenByParent.TryGetValue(nk.Parent, out var list))
                            childrenByParent[nk.Parent] = list = new List<string>();
                        list.Add(nkId);
                    }
                Console.WriteLine();
                Console.WriteLine("Best-matching key stage (fewest mismatches vs. that stage's flags_on, rest=0;"
                    + " a hidden non_key_stage's own best match is folded into its parent's count):");
                foreach (var (stageId, st) in npc.KeyStages)
                {
                    var wantedOn = new HashSet<long>(st.FlagsOn);
                    int mism = ids.Count(fid => wantedOn.Contains(fid) != (vals[fid] != 0));
                    if (childrenByParent.TryGetValue(stageId, out var children))
                        foreach (var nkId in children)
                        {
                            var (nkFlagsOn, _) = ResolveStageFlagsOn(npc, nkId);
                            var nkWantedOn = new HashSet<long>(nkFlagsOn);
                            int nkMism = ids.Count(fid => nkWantedOn.Contains(fid) != (vals[fid] != 0));
                            mism = Math.Min(mism, nkMism);
                        }
                    string tag = st.Verified ? "VERIFIED" : "theoretical";
                    Console.WriteLine($"  {stageId,-22} ({tag}): {mism} flags differ");
                }
            }

            var chrBlob = new ChrBlob(Schema, p1, c.GetRawData());
            Console.WriteLine();
            Console.WriteLine("CHR blob entries:");
            foreach (var e in chrBlob.Entries()) Console.WriteLine($"  {e}");
        }

        /// <summary>Rolls a single NPC to a quest stage: sets its key_stage flags_on, then
        /// normalizes alive=true/hostile=false for that stage, then fixes up dependent_enemies.</summary>
        public void Rollback(Character c, string npcId, string stage, string reviveCount = "all")
        {
            var npc = GetNpc(npcId);
            ResolveStageFlagsOn(npc, stage); // throws if unknown, before touching the save
            int p1 = c.FindPattern1().Last();
            var fa = new FlagAddr(Schema, p1);
            string axisStageId = ApplyNpcStage(fa, c, p1, npc, stage);
            ApplyDependentEnemies(fa, c, p1, npc, axisStageId, reviveCount);
        }

        /// <summary>Rolls an npc_group to a named combo stage, or to {primary: stage[, secondary: substage]}.</summary>
        public void RollbackGroup(Character c, string groupId, string stage, string? substage, string reviveCount = "all")
        {
            if (!Schema.NpcGroups.TryGetValue(groupId, out var group))
                throw new NpcStateMachineException($"Unknown npc_group '{groupId}'.");

            var plan = new Dictionary<string, string>();
            if (group.ComboStages != null && group.ComboStages.TryGetValue(stage, out var combo) && substage == null)
            {
                Console.WriteLine($"Group rollback '{groupId}' -> combo stage '{stage}': {{{string.Join(", ", combo.Select(kv => $"{kv.Key}: {kv.Value}"))}}}");
                plan = combo;
            }
            else
            {
                plan[group.PrimaryMember] = stage;
                if (substage != null)
                {
                    if (string.IsNullOrEmpty(group.SecondaryMember))
                        throw new NpcStateMachineException($"'{groupId}' has no secondary_member -- substage is not applicable.");
                    plan[group.SecondaryMember] = substage;
                }
                Console.WriteLine($"Group rollback '{groupId}': primary {group.PrimaryMember} -> '{stage}'" +
                    (substage != null ? $", secondary {group.SecondaryMember} -> '{substage}'" :
                     group.SecondaryMember != null ? $" ({group.SecondaryMember} left untouched)" : ""));
            }

            int p1 = c.FindPattern1().Last();
            var fa = new FlagAddr(Schema, p1);
            foreach (var (member, memberStage) in plan)
            {
                Console.WriteLine($"-- applying {member} -> {memberStage}");
                var npc = GetNpc(member);
                string axisStageId = ApplyNpcStage(fa, c, p1, npc, memberStage);
                ApplyDependentEnemies(fa, c, p1, npc, axisStageId, reviveCount);
            }
        }

        /// <summary>revive(true)/kill(false)/aggro(true)/calm(false) without moving the quest
        /// stage: auto-detects the current stage (or uses stageOverride) and flips just the
        /// requested axis for that stage's own per_stage config.</summary>
        public void AxisAction(Character c, string npcId, string axisName, bool targetTrue, string? stageOverride = null)
        {
            var npc = GetNpc(npcId);
            if (npc.StatusAxes == null || !npc.StatusAxes.ContainsKey(axisName))
                throw new NpcStateMachineException($"NPC '{npcId}' has no '{axisName}' axis.");

            int p1 = c.FindPattern1().Last();
            var fa = new FlagAddr(Schema, p1);
            var ids = AllFlagIds(npc);

            string stageId = stageOverride ?? DetectCurrentStage(fa, p1, c, npc, ids);
            var perStage = npc.StatusAxes[axisName].PerStage;
            if (!perStage.TryGetValue(stageId, out var axisCfg) && !perStage.TryGetValue("default", out axisCfg))
                throw new NpcStateMachineException($"Axis '{axisName}' has no definition for stage '{stageId}'. Aborting, no changes made.");
            if (!axisCfg.Verified)
                Console.WriteLine($"WARNING: axis '{axisName}' at stage '{stageId}' is UNVERIFIED. Proceeding anyway.");

            if (axisName == "alive" && targetTrue)
                RestoreLocationFlagsIfWiped(fa, c, npc, ids, stageId);

            var toSet = targetTrue ? axisCfg.SetTrue : axisCfg.SetFalse;
            Console.WriteLine($"Setting: {{{string.Join(", ", toSet.Select(kv => $"\"{kv.Key}\": {kv.Value}"))}}}");
            SetFlags(fa, p1, c, toSet);

            if (axisCfg.AlwaysClearTraps.Count > 0)
            {
                Console.WriteLine($"Clearing traps: [{string.Join(",", axisCfg.AlwaysClearTraps)}]");
                SetFlags(fa, c, axisCfg.AlwaysClearTraps, 0);
            }

            if (axisName == "alive")
            {
                ApplyChrObjBits(p1, c.GetRawData(), axisCfg, targetTrue);
                if (targetTrue)
                    SweepSiblingChrBitsAlive(p1, c.GetRawData(), npc);
            }
        }
    }
}
