namespace DSRSave.Editors.NpcStateMachine
{
    public class ObjBlobEntry
    {
        public string Map = "";
        public uint MapId;
        public int Pos;
        public int EntrySize;
        public uint Count;

        public override string ToString() =>
            $"{{map={Map}, map_id={MapId}, pos={Pos}, entry_size={EntrySize}, count={Count}}}";
    }

    /// <summary>Sibling of ChrBlob for the 'OBJ ' section that immediately follows the
    /// 'CHR ' section in the save (same format, applies to MSB Objects instead of
    /// Characters -- see project memory project_ds1_npc_engine.md, 2026-11-19 entry).
    /// Its position is NOT a fixed pattern1 offset: it sits right after CHR's own
    /// body, whose length varies per-save, so it must be located dynamically every
    /// time from the live CHR blob's own size field.</summary>
    public class ObjBlob
    {
        private readonly byte[] _buf;
        private readonly int _off;

        public ObjBlob(StateMachineSchema schema, int p1, byte[] buf)
        {
            _buf = buf;
            int chrOff = p1 + Convert.ToInt32(schema.ChrBlob.OffsetFromPattern1Hex, 16);
            uint chrBodySize = BitConverter.ToUInt32(buf, chrOff);
            _off = chrOff + 4 + (int)chrBodySize;
        }

        public List<ObjBlobEntry> Entries()
        {
            var list = new List<ObjBlobEntry>();
            int p = _off + 4 + 8;
            while (true)
            {
                uint mapId = BitConverter.ToUInt32(_buf, p);
                if (mapId == 0xFFFFFFFFu) break;
                int entrySize = BitConverter.ToInt32(_buf, p + 4);
                uint count = BitConverter.ToUInt32(_buf, p + 8);
                byte[] b4 = BitConverter.GetBytes(mapId);
                string mapName = $"m{b4[3]:D2}_{b4[2]:D2}_00_00";
                list.Add(new ObjBlobEntry { Map = mapName, MapId = mapId, Pos = p, EntrySize = entrySize, Count = count });
                p += entrySize;
            }
            return list;
        }

        /// <summary>Precise per-object edit: flips specific indices within one map's OBJ
        /// bitmask (e.g. Andre's anvil props, indices 460/461 in m10_01). Not a passive
        /// flag -- on next load this triggers the real native destroy/restore routine
        /// (FUN_1402fce20), confirmed by decompile.</summary>
        public bool SetBits(string? mapShortName, IEnumerable<int> indices, int value)
        {
            if (string.IsNullOrEmpty(mapShortName)) return false;
            string targetFull = $"{mapShortName}_00_00";
            bool changed = false;
            var idxList = indices.ToList();
            foreach (var e in Entries())
            {
                if (e.Map == targetFull)
                {
                    int bitmaskStart = e.Pos + 12;
                    foreach (var idx in idxList)
                    {
                        int byteOff = bitmaskStart + idx / 8;
                        int bit = idx % 8;
                        if (value != 0) _buf[byteOff] |= (byte)(1 << bit);
                        else _buf[byteOff] &= (byte)~(1 << bit);
                    }
                    Console.WriteLine($"  OBJ blob: set bits [{string.Join(",", idxList)}] to {value} in {e.Map} entry (count={e.Count})");
                    changed = true;
                }
            }
            if (!changed)
                Console.WriteLine($"  OBJ blob: no entry for {targetFull} present in this save -- nothing to edit");
            return changed;
        }
    }
}
