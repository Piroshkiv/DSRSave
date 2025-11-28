using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DSRSave.Editors
{
    public enum Covenant
    {
        None = 0,
        WayOfWhite = 1,
        PrincessGuard = 2,
        WarriorOfSunlight = 3,
        Darkwraith = 4,
        PathOfTheDragon = 5,
        GravelordServant = 6,
        ForestHunter = 7,
        DarkmoonBlade = 8,
        ChaosServant = 9
    }

    public class CovenantEditor
    {
        private readonly Character _character;

        public CovenantEditor(Character character)
        {
            _character = character;
        }

        public Covenant Covenant
        {
            get => (Covenant)_character[0x0173];
            set => _character[0x0173] = (byte)value;
        }
    }
}
