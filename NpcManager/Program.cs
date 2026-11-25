using DSRSave;
using DSRSave.Editors.NpcStatus;
using DSRSave.Editors.NpcStateMachine;

string[] stateMachineVerbs = { "status", "rollback", "revive", "kill", "aggro", "calm" };
if (args.Length > 0 && stateMachineVerbs.Contains(args[0]))
{
    RunStateMachineCli(args);
    return;
}

if (args.Length == 0)
{
    RunFriendlyMenu();
    return;
}

string savePath = args.Length > 0
    ? args[0]
    : "C:/Users/Iho/Documents/NBGI/DARK SOULS REMASTERED/834633765/DRAKS0005.sl2";

string jsonPath = Path.Combine(AppContext.BaseDirectory, "json", "npc_status_data.json");

Console.WriteLine($"Save: {savePath}");
var characters = DSRSaveEditor.ReadSave(savePath).ToList();

var slots = characters.Where(c => !c.IsEmpty).ToList();
if (slots.Count == 0)
{
    Console.WriteLine("No non-empty slots found.");
    return;
}

Console.WriteLine();
Console.WriteLine("Slots:");
foreach (var c in slots)
{
    Console.WriteLine($"  [{c.SlotNumber}] {c.Name.Name1}  Lv.{c.Stats.Level}  {c.Stats.Class}");
}

Console.Write("\nPick a slot number: ");
int slotNumber = int.Parse(Console.ReadLine() ?? "0");
var character = characters.First(c => c.SlotNumber == slotNumber);

var service = new NpcStatusService(character, jsonPath);
bool dirty = false;

while (true)
{
    Console.WriteLine();
    PrintTable(service);
    Console.WriteLine();
    Console.Write("Enter NPC number to edit, 's' to save & write, 'q' to quit without saving: ");
    string? input = Console.ReadLine()?.Trim();
    if (input == null) continue;

    if (input.Equals("q", StringComparison.OrdinalIgnoreCase)) break;

    if (input.Equals("s", StringComparison.OrdinalIgnoreCase))
    {
        if (!dirty)
        {
            Console.WriteLine("Nothing changed, nothing to write.");
            continue;
        }
        string backupPath = $"{savePath}.bak_{DateTime.Now:yyyyMMdd_HHmmss}";
        File.Copy(savePath, backupPath);
        Console.WriteLine($"Backed up original save to: {backupPath}");
        characters.WriteSave(savePath);
        Console.WriteLine("Save written.");
        dirty = false;
        continue;
    }

    if (!int.TryParse(input, out int idx) || idx < 1 || idx > service.Data.Npcs.Count)
    {
        Console.WriteLine("Not a valid number.");
        continue;
    }

    var npc = service.Data.Npcs[idx - 1];
    if (EditNpc(service, npc)) dirty = true;
}

if (dirty)
{
    Console.Write("You have unsaved changes. Write them now before exiting? (y/n): ");
    if ((Console.ReadLine() ?? "").Trim().Equals("y", StringComparison.OrdinalIgnoreCase))
    {
        string backupPath = $"{savePath}.bak_{DateTime.Now:yyyyMMdd_HHmmss}";
        File.Copy(savePath, backupPath);
        Console.WriteLine($"Backed up original save to: {backupPath}");
        characters.WriteSave(savePath);
        Console.WriteLine("Save written.");
    }
}

static string Tri(TriState t) => t switch
{
    TriState.True => "yes",
    TriState.False => "no",
    _ => "???"
};

static void PrintTable(NpcStatusService service)
{
    Console.WriteLine($"{"#",-4} {"Name",-38} {"Alive",-7} {"Aggro",-7} {"Stage",-30}");
    int i = 1;
    foreach (var npc in service.Data.Npcs)
    {
        var alive = service.GetAliveStatus(npc);
        string aliveStr = alive switch
        {
            TriState.True => "alive",
            TriState.False => "dead",
            _ => "???"
        };
        var aggro = service.GetAggroStatus(npc);
        var (stage, unknownAbove) = service.GetQuestStage(npc);
        string stageStr = stage == null ? (npc.QuestStages.Count == 0 ? "-" : "???") : stage.Name + (unknownAbove ? "+?" : "");

        Console.WriteLine($"{i,-4} {npc.Name,-38} {aliveStr,-7} {Tri(aggro),-7} {stageStr,-30}");
        i++;
    }
}

static bool EditNpc(NpcStatusService service, NpcDefinition npc)
{
    bool changed = false;
    Console.WriteLine();
    Console.WriteLine($"== {npc.Name} ({npc.Category}) ==");
    Console.WriteLine($"Alive: {Tri(service.GetAliveStatus(npc))}   Aggro: {Tri(service.GetAggroStatus(npc))}");

    if (npc.Dependencies.Count > 0)
    {
        Console.WriteLine("Dependencies / warnings:");
        foreach (var d in npc.Dependencies) Console.WriteLine($"  - {d}");
    }

    Console.WriteLine("Actions: [1] revive  [2] kill  [3] set aggro on  [4] set aggro off" +
                       (npc.QuestStages.Count > 0 ? "  [5] set quest stage" : "") + "  [0] back");
    Console.Write("> ");
    string? action = Console.ReadLine()?.Trim();

    try
    {
        switch (action)
        {
            case "1":
                var skippedR = service.SetAlive(npc, true);
                if (skippedR.Count > 0)
                    Console.WriteLine($"Note: position(s) with unknown flag were skipped: {string.Join(", ", skippedR)}");
                changed = true;
                break;
            case "2":
                var skippedK = service.SetAlive(npc, false);
                if (skippedK.Count > 0)
                    Console.WriteLine($"Note: position(s) with unknown flag were skipped: {string.Join(", ", skippedK)}");
                changed = true;
                break;
            case "3":
                service.SetAggro(npc, true);
                changed = true;
                break;
            case "4":
                service.SetAggro(npc, false);
                changed = true;
                break;
            case "5" when npc.QuestStages.Count > 0:
                Console.WriteLine("Stages:");
                foreach (var s in npc.QuestStages.OrderBy(s => s.Order))
                    Console.WriteLine($"  {s.Order}: {s.Name}{(s.Flag.IsKnown ? "" : "  [??? unknown flag]")}");
                Console.Write("Target stage order: ");
                if (int.TryParse(Console.ReadLine(), out int target))
                {
                    var (skipped, deps) = service.SetQuestStage(npc, target);
                    if (skipped.Count > 0)
                        Console.WriteLine($"Note: stage(s) with unknown flag were skipped: {string.Join(", ", skipped)}");
                    if (deps.Count > 0)
                    {
                        Console.WriteLine("Warning — related NPCs/state that this does NOT automatically touch:");
                        foreach (var d in deps) Console.WriteLine($"  - {d}");
                    }
                    changed = true;
                }
                break;
        }
    }
    catch (NpcStatusWarning w)
    {
        Console.WriteLine($"Can't do that: {w.Message}");
        changed = false;
    }

    return changed;
}

// ---------- new generic NPC-state-machine CLI (npc_state_machine.json v2) ----------
// Mirrors tools/npc-state-machine/cli.py 1:1 so saves can be tested/edited without Python:
//   dotnet run --project NpcManager -- status   --save <path> --slot <n> --npc <id>
//   dotnet run --project NpcManager -- rollback --save <path> --slot <n> --npc <id> --stage <stage>
//   dotnet run --project NpcManager -- revive|kill|aggro|calm --save <path> --slot <n> --npc <id> [--stage <id>]

static void RunStateMachineCli(string[] args)
{
    string action = args[0];
    string? save = GetOpt(args, "--save");
    string? slotStr = GetOpt(args, "--slot");
    string? npcId = GetOpt(args, "--npc");
    string? stage = GetOpt(args, "--stage");
    string? substage = GetOpt(args, "--substage");
    string reviveCount = GetOpt(args, "--revive-count") ?? "all";

    if (save == null || slotStr == null || npcId == null)
    {
        Console.WriteLine("Usage: <status|rollback|revive|kill|aggro|calm> --save <path> --slot <n> --npc <id> " +
                           "[--stage <id>] [--substage <id>] [--revive-count one|all]");
        return;
    }
    if (!int.TryParse(slotStr, out int slot))
    {
        Console.WriteLine($"'--slot {slotStr}' is not a number.");
        return;
    }

    string smJsonPath = Path.Combine(AppContext.BaseDirectory, "json", "npc_state_machine.json");
    NpcStateMachineEngine engine;
    try { engine = new NpcStateMachineEngine(smJsonPath); }
    catch (Exception ex) { Console.WriteLine($"Failed to load schema: {ex.Message}"); return; }

    bool isGroup = engine.Schema.NpcGroups.ContainsKey(npcId);
    if (!isGroup && !engine.Schema.Npcs.ContainsKey(npcId))
    {
        Console.WriteLine($"Unknown npc/group '{npcId}'.");
        Console.WriteLine($"Known npcs: {string.Join(", ", engine.Schema.Npcs.Keys)}");
        Console.WriteLine($"Known groups: {string.Join(", ", engine.Schema.NpcGroups.Keys)}");
        return;
    }
    if (isGroup && action != "rollback")
    {
        Console.WriteLine($"'{npcId}' is an npc_group -- only 'rollback --stage <combo_stage>' is supported for groups " +
                           "(use the individual member names for revive/kill/aggro/calm).");
        return;
    }
    if (action == "rollback" && stage == null)
    {
        Console.WriteLine("rollback requires --stage <key_stage_id>");
        return;
    }

    List<Character> smCharacters;
    Character smCharacter;
    try
    {
        smCharacters = DSRSaveEditor.ReadSave(save).ToList();
        smCharacter = smCharacters.First(ch => ch.SlotNumber == slot);
    }
    catch (Exception ex) { Console.WriteLine($"Error loading save: {ex.Message}"); return; }

    Console.WriteLine($"name={smCharacter.Name.Name1!} level={smCharacter.Stats.Level} pattern1={smCharacter.FindPattern1().Last():X}");
    Console.WriteLine();

    if (action == "status")
    {
        try { engine.Status(smCharacter, npcId); }
        catch (Exception ex) { Console.WriteLine($"Error: {ex.Message}"); }
        return;
    }

    if (!ConfirmMainMenu()) return;

    try
    {
        switch (action)
        {
            case "rollback":
                if (isGroup) engine.RollbackGroup(smCharacter, npcId, stage!, substage, reviveCount);
                else engine.Rollback(smCharacter, npcId, stage!, reviveCount);
                break;
            case "revive": engine.AxisAction(smCharacter, npcId, "alive", true, stage); break;
            case "kill": engine.AxisAction(smCharacter, npcId, "alive", false, stage); break;
            case "aggro": engine.AxisAction(smCharacter, npcId, "hostile", true, stage); break;
            case "calm": engine.AxisAction(smCharacter, npcId, "hostile", false, stage); break;
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error: {ex.Message}");
        return;
    }

    string backupPath = $"{save}.before_{npcId}_{action}_{stage ?? "x"}_{DateTime.Now:yyyyMMdd_HHmmss}.bak";
    File.Copy(save, backupPath);
    Console.WriteLine($"backup: {backupPath}");
    smCharacters.WriteSave(save);
    Console.WriteLine("save file written");

    var reread = DSRSaveEditor.ReadSave(save).First(ch => ch.SlotNumber == slot);
    bool verifyOk = reread.GetRawData().SequenceEqual(smCharacter.GetRawData());
    Console.WriteLine($"verify_ok={verifyOk}");
    if (!verifyOk)
        Console.WriteLine("!!! Re-decrypted save does not match the intended write -- restore from the backup above !!!");
}

static bool ConfirmMainMenu()
{
    Console.Write("Is the game sitting at the main menu right now (no character loaded)? [y/N] ");
    string? ans = Console.ReadLine()?.Trim().ToLowerInvariant();
    if (ans != "y")
    {
        Console.WriteLine("Aborting -- go to the main menu first.");
        return false;
    }
    return true;
}

static string? GetOpt(string[] args, string name)
{
    for (int i = 0; i < args.Length - 1; i++)
        if (args[i] == name) return args[i + 1];
    return null;
}

// ---------- simple number-only menu (run with no arguments: dotnet run --project NpcManager) ----------
// Designed so the user never needs to know flag ids or the schema internals -- every
// step is just picking a number. Each action writes to the save file immediately,
// with its own backup and a post-write verification read.

const string DefaultFriendlySavePath = "C:/Users/Iho/Documents/NBGI/DARK SOULS REMASTERED/1269862397/DRAKS0005.sl2";

static void RunFriendlyMenu()
{
    Console.WriteLine("=== DS1 NPC State Editor ===");
    Console.WriteLine("At any prompt you can just press Enter to accept the value shown in [brackets].");
    Console.Write($"Save file path [{DefaultFriendlySavePath}]: ");
    string? pathInput = Console.ReadLine();
    string savePath = string.IsNullOrWhiteSpace(pathInput) ? DefaultFriendlySavePath : pathInput.Trim();

    List<Character> friendlyCharacters;
    try { friendlyCharacters = DSRSaveEditor.ReadSave(savePath).ToList(); }
    catch (Exception ex) { Console.WriteLine($"Could not open save: {ex.Message}"); return; }

    var friendlySlots = friendlyCharacters.Where(c => !c.IsEmpty).ToList();
    if (friendlySlots.Count == 0) { Console.WriteLine("No characters found in this save."); return; }

    Console.WriteLine();
    Console.WriteLine("Pick a character (just type the number):");
    for (int i = 0; i < friendlySlots.Count; i++)
        Console.WriteLine($"  [{i + 1}] {friendlySlots[i].Name.Name1}  -- level {friendlySlots[i].Stats.Level}, slot {friendlySlots[i].SlotNumber}");
    Console.Write("> ");
    if (!int.TryParse(Console.ReadLine(), out int charPick) || charPick < 1 || charPick > friendlySlots.Count)
    {
        Console.WriteLine("That's not a number from the list, exiting.");
        return;
    }
    var friendlyCharacter = friendlySlots[charPick - 1];
    int friendlySlot = friendlyCharacter.SlotNumber;

    string smJsonPath = Path.Combine(AppContext.BaseDirectory, "json", "npc_state_machine.json");
    NpcStateMachineEngine friendlyEngine;
    try { friendlyEngine = new NpcStateMachineEngine(smJsonPath); }
    catch (Exception ex) { Console.WriteLine($"Could not load npc_state_machine.json: {ex.Message}"); return; }

    var npcIds = friendlyEngine.Schema.Npcs.Keys.OrderBy(x => x).ToList();
    var groupIds = friendlyEngine.Schema.NpcGroups.Keys.OrderBy(x => x).ToList();

    while (true)
    {
        Console.WriteLine();
        Console.WriteLine($"Character: {friendlyCharacter.Name.Name1}, level {friendlyCharacter.Stats.Level}");
        Console.WriteLine($"{"#",-4} {"NPC",-28} {"alive",-7} {"hostile",-11} quest stage");
        for (int i = 0; i < npcIds.Count; i++)
        {
            var (stage, alive, hostile) = friendlyEngine.Summarize(friendlyCharacter, npcIds[i]);
            Console.WriteLine($"{i + 1,-4} {npcIds[i],-28} {alive,-7} {hostile,-11} {stage}");
        }
        int groupBase = npcIds.Count;
        for (int i = 0; i < groupIds.Count; i++)
            Console.WriteLine($"{groupBase + i + 1,-4} [group] {groupIds[i]}");
        Console.WriteLine();
        Console.Write("NPC number to edit, or 0 to exit: ");
        string? pickStr = Console.ReadLine()?.Trim();
        if (string.IsNullOrEmpty(pickStr) || pickStr == "0") break;
        if (!int.TryParse(pickStr, out int idx) || idx < 1 || idx > npcIds.Count + groupIds.Count)
        {
            Console.WriteLine("Enter a number from the list.");
            continue;
        }

        bool isGroup = idx > npcIds.Count;
        string selectedId = isGroup ? groupIds[idx - npcIds.Count - 1] : npcIds[idx - 1];
        EditNpcFriendly(friendlyEngine, friendlyCharacter, friendlyCharacters, savePath, friendlySlot, selectedId, isGroup);
    }

    Console.WriteLine("Done. Every change was already written to the file (backups are next to the save).");
}

static bool EditNpcFriendly(NpcStateMachineEngine engine, Character character, List<Character> allCharacters,
    string savePath, int slot, string id, bool isGroup)
{
    Console.WriteLine();
    try
    {
        if (isGroup)
        {
            var group = engine.Schema.NpcGroups[id];
            Console.WriteLine($"== Group: {id} ==");
            Console.WriteLine("Members: " + string.Join(", ", group.Members));
            var combos = group.ComboStages?.Keys.ToList() ?? new List<string>();
            if (combos.Count == 0)
            {
                Console.WriteLine("This group has no ready-made combo scenarios (only per-member manual editing).");
                return false;
            }
            Console.WriteLine("Ready-made scenarios for the whole group at once:");
            for (int i = 0; i < combos.Count; i++) Console.WriteLine($"  [{i + 1}] {combos[i]}");
            Console.WriteLine("  [0] Back");
            Console.Write("> ");
            if (!int.TryParse(Console.ReadLine(), out int pick) || pick < 1 || pick > combos.Count) return false;
            string stage = combos[pick - 1];

            if (!ConfirmMainMenuFriendly()) return false;
            engine.RollbackGroup(character, id, stage, null);
            WriteAndVerifyFriendly(savePath, allCharacters, slot, $"{id}_rollback_{stage}");
            return true;
        }

        var (stage0, alive0, hostile0) = engine.Summarize(character, id);
        Console.WriteLine($"== {id} ==");
        Console.WriteLine($"Right now: stage \"{stage0}\", alive: {alive0}, hostile: {hostile0}");
        Console.WriteLine("What do you want to do?");
        Console.WriteLine("  [1] Revive (at the current quest stage)");
        Console.WriteLine("  [2] Kill (at the current quest stage)");
        Console.WriteLine("  [3] Make hostile");
        Console.WriteLine("  [4] Calm down (remove hostility)");
        Console.WriteLine("  [5] Move to a different quest stage (may also revive/calm automatically)");
        Console.WriteLine("  [0] Back, do nothing");
        Console.Write("> ");
        string? action = Console.ReadLine()?.Trim();

        switch (action)
        {
            case "1":
                if (!ConfirmMainMenuFriendly()) return false;
                engine.AxisAction(character, id, "alive", true);
                break;
            case "2":
                if (!ConfirmMainMenuFriendly()) return false;
                engine.AxisAction(character, id, "alive", false);
                break;
            case "3":
                if (!ConfirmMainMenuFriendly()) return false;
                engine.AxisAction(character, id, "hostile", true);
                break;
            case "4":
                if (!ConfirmMainMenuFriendly()) return false;
                engine.AxisAction(character, id, "hostile", false);
                break;
            case "5":
                var stages = engine.ListStages(id);
                if (stages.Count == 0)
                {
                    Console.WriteLine("This NPC has no separate quest stages -- only options [1]-[4] above apply.");
                    return false;
                }
                Console.WriteLine("Quest stages:");
                for (int i = 0; i < stages.Count; i++)
                    Console.WriteLine($"  [{i + 1}] {stages[i].id}" + (stages[i].verified ? "" : "  (not live-verified yet, but worth trying)"));
                Console.Write("Stage number (0 = back): ");
                string? stageStr = Console.ReadLine()?.Trim();
                if (string.IsNullOrEmpty(stageStr) || stageStr == "0") return false;
                if (!int.TryParse(stageStr, out int sp) || sp < 1 || sp > stages.Count)
                {
                    Console.WriteLine("No such number.");
                    return false;
                }
                if (!ConfirmMainMenuFriendly()) return false;
                engine.Rollback(character, id, stages[sp - 1].id);
                break;
            default:
                return false;
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error: {ex.Message}");
        return false;
    }

    WriteAndVerifyFriendly(savePath, allCharacters, slot, $"{id}_edit");
    return true;
}

static bool ConfirmMainMenuFriendly()
{
    Console.Write("Is the game sitting at the main menu right now (no character loaded)? [y/N] ");
    string? ans = Console.ReadLine()?.Trim().ToLowerInvariant();
    if (ans == "y") return true;
    Console.WriteLine("Cancelled -- go to the game's main menu first, otherwise the edit won't save correctly.");
    return false;
}

static void WriteAndVerifyFriendly(string savePath, List<Character> characters, int slot, string label)
{
    string backupPath = $"{savePath}.before_{label}_{DateTime.Now:yyyyMMdd_HHmmss}.bak";
    File.Copy(savePath, backupPath);
    Console.WriteLine($"Backup: {backupPath}");
    characters.WriteSave(savePath);
    Console.WriteLine("Save written.");

    var reread = DSRSaveEditor.ReadSave(savePath).First(ch => ch.SlotNumber == slot);
    var original = characters.First(ch => ch.SlotNumber == slot);
    bool ok = reread.GetRawData().SequenceEqual(original.GetRawData());
    Console.WriteLine(ok ? "Write check: everything matches." : "!!! WRITE CHECK FAILED -- restore the save from the backup above !!!");
}
