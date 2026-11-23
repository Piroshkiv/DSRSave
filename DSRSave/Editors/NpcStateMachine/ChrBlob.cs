namespace DSRSave.Editors.NpcStateMachine
{
    public class ChrBlobEntry
    {
        public string Map = "";
        public uint MapId;
        public int Pos;
        public int EntrySize;
        public uint ChrCount;

        public override string ToString() =>
            $"{{map={Map}, map_id={MapId}, pos={Pos}, entry_size={EntrySize}, chr_count={ChrCount}}}";
    }

    /// <summary>Per-map "forced CHR state" blob embedded in the save. Each map entry
    /// carries a chr_count word (0xFFFFFFFF defangs the whole map's forced-dead state)
    /// plus a per-character bitmask keyed by MSB index (see project memory
    /// project_ds1_chr_obj_blob_mechanism / project_ds1_npc_state_machine_tool for how
    /// this was reverse engineered). Port of cli.py's ChrBlob class.</summary>
    public class ChrBlob
    {
        private readonly byte[] _buf;
        private readonly int _off;

        public ChrBlob(StateMachineSchema schema, int p1, byte[] buf)
        {
            _buf = buf;
            _off = p1 + Convert.ToInt32(schema.ChrBlob.OffsetFromPattern1Hex, 16);
        }

        public List<ChrBlobEntry> Entries()
        {
            var list = new List<ChrBlobEntry>();
            int p = _off + 4 + 4 + 4;
            while (true)
            {
                uint mapId = BitConverter.ToUInt32(_buf, p);
                if (mapId == 0xFFFFFFFFu) break;
                int entrySize = BitConverter.ToInt32(_buf, p + 4);
                uint chrCount = BitConverter.ToUInt32(_buf, p + 8);
                byte[] b4 = BitConverter.GetBytes(mapId);
                string mapName = $"m{b4[3]:D2}_{b4[2]:D2}_00_00";
                list.Add(new ChrBlobEntry { Map = mapName, MapId = mapId, Pos = p, EntrySize = entrySize, ChrCount = chrCount });
                p += entrySize;
            }
            return list;
        }

        /// <summary>Blunt edit: defangs the WHOLE map's CHR-blob entry (corrupts chr_count
        /// so the game ignores every forced-kill bit in it). Prefer SetBits when other
        /// characters in the same map must keep their own state untouched.</summary>
        public bool DefangMap(string? mapShortName)
        {
            if (string.IsNullOrEmpty(mapShortName)) return false;
            string targetFull = $"{mapShortName}_00_00";
            bool changed = false;
            foreach (var e in Entries())
            {
                if (e.Map == targetFull)
                {
                    BitConverter.GetBytes(0xFFFFFFFFu).CopyTo(_buf, e.Pos + 8);
                    Console.WriteLine($"  CHR blob: defanged {e.Map} entry (chr_count {e.ChrCount} -> 0xFFFFFFFF)");
                    changed = true;
                }
            }
            return changed;
        }

        /// <summary>Precise per-character edit: flips specific MSB-index bits within one
        /// map's bitmask, instead of corrupting chr_count for the whole map.</summary>
        public bool SetBits(string? mapShortName, IEnumerable<int> msbIndices, int value)
        {
            if (string.IsNullOrEmpty(mapShortName)) return false;
            string targetFull = $"{mapShortName}_00_00";
            bool changed = false;
            var indices = msbIndices.ToList();
            foreach (var e in Entries())
            {
                if (e.Map == targetFull)
                {
                    int bitmaskStart = e.Pos + 12;
                    foreach (var idx in indices)
                    {
                        int byteOff = bitmaskStart + idx / 8;
                        int bit = idx % 8;
                        if (value != 0) _buf[byteOff] |= (byte)(1 << bit);
                        else _buf[byteOff] &= (byte)~(1 << bit);
                    }
                    Console.WriteLine($"  CHR blob: set bits [{string.Join(",", indices)}] to {value} in {e.Map} entry (chr_count={e.ChrCount})");
                    changed = true;
                }
            }
            if (!changed)
                Console.WriteLine($"  CHR blob: no entry for {targetFull} present in this save -- nothing to edit");
            return changed;
        }

        /// <summary>Read-only: current forced-dead bit for one character at one map
        /// placement. Returns 0 if that map has no CHR-blob entry yet (never backread
        /// this session) -- same as "not forced dead", the safe default.</summary>
        public int GetBit(string? mapShortName, int msbIndex)
        {
            if (string.IsNullOrEmpty(mapShortName)) return 0;
            string targetFull = $"{mapShortName}_00_00";
            foreach (var e in Entries())
            {
                if (e.Map == targetFull)
                {
                    int byteOff = e.Pos + 12 + msbIndex / 8;
                    return (_buf[byteOff] >> (msbIndex % 8)) & 1;
                }
            }
            return 0;
        }
    }
}
