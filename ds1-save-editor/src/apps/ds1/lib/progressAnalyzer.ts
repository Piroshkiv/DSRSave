import { Character } from './Character';
import { NpcEditor } from './npc';

// 区域ID枚举
export enum AreaId {
  // 主线区域
  UndeadAsylum = 'undead_asylum',
  FirelinkShrine = 'firelink_shrine',
  UndeadBurg = 'undead_burg',
  UndeadParish = 'undead_parish',
  Depths = 'depths',
  Blighttown = 'blighttown',
  QuelaagDomain = 'quelaag_domain',
  SensFortress = 'sens_fortress',
  AnorLondo = 'anor_londo',
  DukesArchives = 'dukes_archives',
  CrystalCave = 'crystal_cave',
  Catacombs = 'catacombs',
  TombOfGiants = 'tomb_of_giants',
  NewLondoRuins = 'new_londo_ruins',
  TheAbyss = 'the_abyss',
  DemonRuins = 'demon_ruins',
  LostIzalith = 'lost_izalith',
  KilnOfTheFirstFlame = 'kiln_of_the_first_flame',

  // 可选区域
  DarkrootGarden = 'darkroot_garden',
  DarkrootBasin = 'darkroot_basin',
  PaintedWorld = 'painted_world',
  ValleyOfDrakes = 'valley_of_drakes',

  // DLC区域
  Oolacile = 'oolacile',
  ChasmOfTheAbyss = 'chasm_of_the_abyss',

  // 重返北方不死院
  ReturnToAsylum = 'return_to_asylum',
}

// 进度阶段
export enum GamePhase {
  // 第一阶段：起始
  Start = 'start',
  ReturnToAsylum = 'return_to_asylum',
  UndeadBurg = 'undead_burg',
  UndeadParish = 'undead_parish',

  // 第二阶段：敲钟
  AfterBell1 = 'after_bell1',
  Depths = 'depths',
  Blighttown = 'blighttown',
  AfterBell2 = 'after_bell2',

  // 第三阶段：赛恩古城
  SensFortress = 'sens_fortress',
  AnorLondo = 'anor_londo',
  AfterOrnsteinSmough = 'after_ornstein_smough',

  // 第四阶段：收集薪王灵魂
  ObtainedLordvessel = 'obtained_lordvessel',
  SeekingLordSouls = 'seeking_lord_souls',
  AllLordSouls = 'all_lord_souls',

  // 第五阶段：最终决战
  ReadyForKiln = 'ready_for_kiln',
  GameComplete = 'game_complete',
}

// 玩家进度
export interface PlayerProgress {
  // 当前阶段
  phase: GamePhase;

  // Boss击杀状态
  bossesDefeated: {
    asylumDemon: boolean;
    taurusDemon: boolean;
    bellGargoyles: boolean;
    capraDemon: boolean;
    gapingDragon: boolean;
    queelaag: boolean;
    ironGolem: boolean;
    ornsteinAndSmough: boolean;
    moonlightButterfly: boolean;
    sif: boolean;
    pinwheel: boolean;
    nito: boolean;
    seath: boolean;
    fourKings: boolean;
    BedOfChaos: boolean;
    gwyn: boolean;
    // DLC
    sanctuaryGuardian: boolean;
    artorias: boolean;
    kalameet: boolean;
    manus: boolean;
  };

  // 钟状态
  bells: {
    bell1Rung: boolean; // 第一口钟
    bell2Rung: boolean; // 第二口钟
  };

  // 营火解锁状态
  bonfiresUnlocked: boolean[];

  // 关键物品
  keyItems: {
    lordvessel: boolean; // 王器
    ringOfArtorias: boolean; // 亚尔特留斯的契约戒指
    rustedIronRing: boolean; // 生锈铁环
    crestOfArtorias: boolean; // 亚尔特留斯徽章
    sealKey: boolean; // 封印钥匙
    brokenPendant: boolean; // 破碎的坠落之环
    lordSouls: {
      seath: boolean;
      nito: boolean;
      fourKings: boolean;
      bedOfChaos: boolean;
    };
  };

  // 已访问区域
  visitedAreas: AreaId[];

  // 玩家拥有的物品ID列表
  ownedItemIds: string[];
}

export class ProgressAnalyzer {
  private character: Character;
  private npcEditor: NpcEditor;

  constructor(character: Character) {
    this.character = character;
    this.npcEditor = new NpcEditor(character);
  }

  // 分析当前进度
  async analyzeProgress(): Promise<PlayerProgress> {
    const bossesDefeated = await this.getBossesDefeated();
    const bonfiresUnlocked = this.character.getBonfireWarpFlags();
    const ownedItemIds = this.getOwnedItemIds();
    const keyItems = await this.getKeyItems(ownedItemIds);

    // 判断钟状态
    const bells = this.getBellsStatus();

    // 判断阶段
    const phase = this.determinePhase(bossesDefeated, bells, keyItems, ownedItemIds);

    // 判断已访问区域
    const visitedAreas = this.determineVisitedAreas(bossesDefeated, bonfiresUnlocked, keyItems);

    return {
      phase,
      bossesDefeated,
      bells,
      bonfiresUnlocked,
      keyItems,
      visitedAreas,
      ownedItemIds,
    };
  }

  // 获取玩家拥有的物品ID列表
  private getOwnedItemIds(): string[] {
    try {
      // 同步加载物品数据库（如果尚未加载）
      // 注意：Inventory.loadItemsDatabase()是异步的，但我们需要同步获取物品
      // 所以我们直接读取物品栏数据
      const items: string[] = [];
      const data = this.character.getRawData();
      const INVENTORY_START = 0x370;
      const ITEM_SIZE = 28;
      const MAX_SLOTS = 2048;

      for (let i = 0; i < MAX_SLOTS; i++) {
        const offset = INVENTORY_START + i * ITEM_SIZE;
        if (offset + ITEM_SIZE > data.length) break;

        // 读取物品ID（字节4-7）
        const itemId = data[offset + 4] |
                       (data[offset + 5] << 8) |
                       (data[offset + 6] << 16) |
                       (data[offset + 7] << 24);

        // 检查物品是否存在（字节16-19）
        const exists = data[offset + 16] |
                      (data[offset + 17] << 8) |
                      (data[offset + 18] << 16) |
                      (data[offset + 19] << 24);

        if (exists !== 0 && itemId !== 0) {
          items.push(itemId.toString());
        }
      }

      return items;
    } catch (error) {
      console.error('Failed to get owned items:', error);
      return [];
    }
  }

  // 获取Boss击杀状态
  private async getBossesDefeated(): Promise<PlayerProgress['bossesDefeated']> {
    try {
      await this.npcEditor.loadNpcData();
    } catch {
      // 如果加载失败，返回默认值
      return this.getDefaultBossesDefeated();
    }

    const isBossAlive = (name: string): boolean => {
      try {
        return this.npcEditor.getNpcAlive(name);
      } catch {
        return true; // 默认存活
      }
    };

    return {
      asylumDemon: !isBossAlive('Asylum Demon (boss)'),
      taurusDemon: !isBossAlive('Taurus Demon (boss)'),
      bellGargoyles: !isBossAlive('Bell Gargoyles (boss)'),
      capraDemon: !isBossAlive('Capra Demon (boss)'),
      gapingDragon: !isBossAlive('Gaping Dragon (boss)'),
      queelaag: !isBossAlive('Chaos Witch Quelaag (boss)'),
      ironGolem: !isBossAlive('Iron Golem (boss)'),
      ornsteinAndSmough: !isBossAlive('Ornstein and Smough (boss)'),
      moonlightButterfly: !isBossAlive('Moonlight Butterfly (boss)'),
      sif: !isBossAlive('Great Grey Wolf Sif (boss)'),
      pinwheel: !isBossAlive('Pinwheel (boss)'),
      nito: !isBossAlive('Gravelord Nito (boss)'),
      seath: !isBossAlive('Seath the Scaleless (boss)'),
      fourKings: !isBossAlive('Four Kings (boss)'),
      BedOfChaos: !isBossAlive('Bed of Chaos (boss)'),
      gwyn: !isBossAlive('Gwyn, Lord of Cinder (boss)'),
      sanctuaryGuardian: !isBossAlive('Sanctuary Guardian (boss)'),
      artorias: !isBossAlive('Artorias the Abysswalker (boss)'),
      kalameet: !isBossAlive('Black Dragon Kalameet (boss)'),
      manus: !isBossAlive('Manus, Father of the Abyss (boss)'),
    };
  }

  // 获取钟状态
  // 偏移量来自world_events.json中的bells类别
  private getBellsStatus(): PlayerProgress['bells'] {
    const baseOffset = this.character.findPattern1();
    if (baseOffset === -1) {
      return { bell1Rung: false, bell2Rung: false };
    }

    const rawData = this.character.getRawData();

    // 第一口钟：offset 0x180, bit 0, reverse: false
    const bell1Offset = baseOffset + 0x180;
    const bell1Rung = bell1Offset < rawData.length
      ? ((rawData[bell1Offset] >> 0) & 1) === 1
      : false;

    // 第二口钟：offset 0x1D1, bit 0, reverse: false
    const bell2Offset = baseOffset + 0x1D1;
    const bell2Rung = bell2Offset < rawData.length
      ? ((rawData[bell2Offset] >> 0) & 1) === 1
      : false;

    return { bell1Rung, bell2Rung };
  }

  // 获取关键物品
  // 通过检查玩家拥有的物品ID来判断
  private async getKeyItems(ownedItemIds: string[]): Promise<PlayerProgress['keyItems']> {
    // 关键物品ID映射（来自items.json）
    const KEY_ITEM_IDS = {
      // 王器
      lordvessel: '2510',
      // 亚尔特留斯的契约戒指
      ringOfArtorias: '1112',
      // 生锈铁环
      rustedIronRing: '212',
      // 亚尔特留斯徽章
      crestOfArtorias: '115',
      // 封印钥匙
      sealKey: '280',
      // 破碎的坠落之环
      brokenPendant: '222',
      // 薪王灵魂
      seathSoul: '2503',
      nitoSoul: '2500',
      fourKingsSoul: '2502',
      bedOfChaosSoul: '2501',
    };

    const hasItem = (itemId: string): boolean => {
      return ownedItemIds.includes(itemId);
    };

    return {
      lordvessel: hasItem(KEY_ITEM_IDS.lordvessel),
      ringOfArtorias: hasItem(KEY_ITEM_IDS.ringOfArtorias),
      rustedIronRing: hasItem(KEY_ITEM_IDS.rustedIronRing),
      crestOfArtorias: hasItem(KEY_ITEM_IDS.crestOfArtorias),
      sealKey: hasItem(KEY_ITEM_IDS.sealKey),
      brokenPendant: hasItem(KEY_ITEM_IDS.brokenPendant),
      lordSouls: {
        seath: hasItem(KEY_ITEM_IDS.seathSoul),
        nito: hasItem(KEY_ITEM_IDS.nitoSoul),
        fourKings: hasItem(KEY_ITEM_IDS.fourKingsSoul),
        bedOfChaos: hasItem(KEY_ITEM_IDS.bedOfChaosSoul),
      },
    };
  }

  // 判断当前阶段
  private determinePhase(
    bosses: PlayerProgress['bossesDefeated'],
    bells: PlayerProgress['bells'],
    _keyItems: PlayerProgress['keyItems'],
    _ownedItemIds: string[]
  ): GamePhase {
    // 最终阶段：击败葛温
    if (bosses.gwyn) return GamePhase.GameComplete;

    // 检查四个薪王BOSS的击败状态
    const seathDefeated = bosses.seath;
    const nitoDefeated = bosses.nito;
    const fourKingsDefeated = bosses.fourKings;
    const bedOfChaosDefeated = bosses.BedOfChaos;
    const allLordSoulsDefeated = seathDefeated && nitoDefeated && fourKingsDefeated && bedOfChaosDefeated;
    const anyLordSoulDefeated = seathDefeated || nitoDefeated || fourKingsDefeated || bedOfChaosDefeated;

    // 如果所有薪王BOSS都被击败，准备前往初火之炉
    if (allLordSoulsDefeated) {
      return GamePhase.ReadyForKiln;
    }

    // 如果有至少一个薪王BOSS被击败，说明已经放置了王器，正在收集灵魂
    if (anyLordSoulDefeated) {
      return GamePhase.SeekingLordSouls;
    }

    // 如果击败了翁斯坦与斯摩，但没有任何薪王BOSS被击败
    // 说明刚获得王器，还没放置
    if (bosses.ornsteinAndSmough) {
      return GamePhase.AfterOrnsteinSmough;
    }

    // 第三阶段
    if (bosses.ironGolem) return GamePhase.AnorLondo;
    if (bosses.bellGargoyles && bosses.queelaag) return GamePhase.SensFortress;

    // 第二阶段
    if (bells.bell2Rung) return GamePhase.AfterBell2;
    if (bosses.gapingDragon) return GamePhase.Blighttown;
    if (bosses.capraDemon) return GamePhase.Depths;
    if (bells.bell1Rung) return GamePhase.AfterBell1;

    // 第一阶段
    if (bosses.taurusDemon) return GamePhase.UndeadParish;
    if (bosses.asylumDemon) return GamePhase.UndeadBurg;

    return GamePhase.Start;
  }

  // 判断已访问区域
  private determineVisitedAreas(
    bosses: PlayerProgress['bossesDefeated'],
    bonfires: boolean[],
    keyItems: PlayerProgress['keyItems']
  ): AreaId[] {
    const areas: AreaId[] = [];

    // 根据营火解锁状态判断
    if (bonfires[23]) areas.push(AreaId.FirelinkShrine); // 传火祭祀场
    if (bonfires[8]) areas.push(AreaId.UndeadParish); // 不死人教区
    if (bonfires[9]) areas.push(AreaId.Depths); // 下水道

    // 根据Boss击杀状态判断
    if (bosses.asylumDemon) areas.push(AreaId.UndeadAsylum);
    if (bosses.taurusDemon) areas.push(AreaId.UndeadBurg);
    if (bosses.capraDemon) areas.push(AreaId.Depths);
    if (bosses.gapingDragon) areas.push(AreaId.Blighttown);
    if (bosses.queelaag) areas.push(AreaId.QuelaagDomain);
    if (bosses.ironGolem) areas.push(AreaId.SensFortress);
    if (bosses.ornsteinAndSmough) areas.push(AreaId.AnorLondo);
    if (bosses.moonlightButterfly) areas.push(AreaId.DarkrootGarden);
    if (bosses.sif) areas.push(AreaId.DarkrootGarden);
    if (bosses.pinwheel) areas.push(AreaId.Catacombs);
    if (bosses.nito) areas.push(AreaId.TombOfGiants);
    if (bosses.seath) areas.push(AreaId.DukesArchives);
    if (bosses.fourKings) areas.push(AreaId.NewLondoRuins);
    if (bosses.BedOfChaos) areas.push(AreaId.LostIzalith);
    if (bosses.gwyn) areas.push(AreaId.KilnOfTheFirstFlame);

    // DLC区域
    if (bosses.sanctuaryGuardian) areas.push(AreaId.Oolacile);
    if (bosses.artorias) areas.push(AreaId.Oolacile);
    if (bosses.kalameet) areas.push(AreaId.Oolacile);
    if (bosses.manus) areas.push(AreaId.ChasmOfTheAbyss);

    // 根据关键物品判断
    if (keyItems.ringOfArtorias) areas.push(AreaId.TheAbyss);
    if (keyItems.brokenPendant) areas.push(AreaId.Oolacile);

    return [...new Set(areas)]; // 去重
  }

  // 获取默认Boss击杀状态
  private getDefaultBossesDefeated(): PlayerProgress['bossesDefeated'] {
    return {
      asylumDemon: false,
      taurusDemon: false,
      bellGargoyles: false,
      capraDemon: false,
      gapingDragon: false,
      queelaag: false,
      ironGolem: false,
      ornsteinAndSmough: false,
      moonlightButterfly: false,
      sif: false,
      pinwheel: false,
      nito: false,
      seath: false,
      fourKings: false,
      BedOfChaos: false,
      gwyn: false,
      sanctuaryGuardian: false,
      artorias: false,
      kalameet: false,
      manus: false,
    };
  }

  // 检查玩家是否拥有某个物品
  public hasItem(_itemId: string): boolean {
    // TODO: 实现物品检查逻辑
    return false;
  }

  // 获取所有未击败的Boss列表
  public getUndefeatedBosses(): string[] {
    const undefeated: string[] = [];

    // 这里需要实际读取Boss状态
    // 暂时返回空数组

    return undefeated;
  }
}
