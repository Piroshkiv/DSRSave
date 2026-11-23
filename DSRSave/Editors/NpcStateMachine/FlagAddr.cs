namespace DSRSave.Editors.NpcStateMachine
{
    /// <summary>Resolves a DS1 EventFlag id to (byteOffset, bitInByte) relative to the
    /// start of a decrypted save slot's PlayerGameData buffer, given this character's
    /// own pattern1 anchor. Port of the Python tool's FlagAddr class -- see
    /// tools/npc-state-machine/cli.py for the original and its derivation notes.</summary>
    public class FlagAddr
    {
        private readonly int _bufferStart;
        private readonly Dictionary<string, int> _kTable;
        private readonly Dictionary<int, int> _megabank;

        public FlagAddr(StateMachineSchema schema, int p1)
        {
            _bufferStart = p1 + Convert.ToInt32(schema.FlagAddressFormula.BufferStartOffsetHex, 16);
            _kTable = schema.FlagAddressFormula.KTableByMap;
            _megabank = schema.FlagAddressFormula.MegabankByRegion
                .ToDictionary(kv => int.Parse(kv.Key), kv => kv.Value);
        }

        public (int offset, int bit) Addr(long flagId)
        {
            int region = (int)((flagId / 10_000_000) % 10);
            int area = (int)((flagId / 100_000) % 100);
            int group = (int)((flagId / 10_000) % 10);
            int zone = (int)((flagId / 1_000) % 10);
            int local = (int)(flagId % 1_000);
            int word = local / 32;
            int bit = 31 - (local % 32);
            int byteInWord = bit / 8;
            int bitInByte = bit % 8;

            int block;
            if (region == 0 || (area == 0 && group == 0 && !_megabank.ContainsKey(region)))
            {
                block = 0;
            }
            else if (area == 0 && group == 0)
            {
                block = 1 + _megabank[region] * 18;
            }
            else
            {
                string mapName = $"m{area:D2}_{group:D2}";
                if (!_kTable.TryGetValue(mapName, out int k))
                    throw new InvalidOperationException($"no k_table entry for {mapName} (flag {flagId})");
                block = 1 + _megabank[region] * 18 + k;
            }

            int wordStart = _bufferStart + block * 1280 + zone * 128 + word * 4;
            return (wordStart + byteInWord, bitInByte);
        }
    }
}
