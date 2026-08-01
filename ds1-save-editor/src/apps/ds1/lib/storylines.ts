import { AreaId, GamePhase, PlayerProgress } from './progressAnalyzer';

// 故事线项目
export interface StorylineItem {
  id: string;
  name_en: string;
  name_zh: string;
  description_en: string;
  description_zh: string;
  hint_en: string;
  hint_zh: string;
  requiredItemIds?: string[]; // 需要拥有的物品ID才能显示
}

// NPC对话
export interface NpcDialogue {
  npcName_en: string;
  npcName_zh: string;
  dialogue_en: string;
  dialogue_zh: string;
  location_en: string;
  location_zh: string;
}

// 故事线
export interface Storyline {
  id: string;
  name_en: string;
  name_zh: string;
  theme_en: string;
  theme_zh: string;
  items: StorylineItem[];
  npcDialogues?: NpcDialogue[];
  nextArea: AreaId;
  prerequisities: GamePhase[];
  alternativeBosses?: string[]; // 可选的Boss目标
  recommendation_en: string;
  recommendation_zh: string;
  reason_en: string;
  reason_zh: string;
}

// 所有故事线
export const STORYLINES: Storyline[] = [
  // ==================== 起始：完成北方不死院 ====================
  {
    id: 'complete_asylum',
    name_en: 'Escape the Undead Asylum',
    name_zh: '逃离北方不死院',
    theme_en: 'Awakening',
    theme_zh: '觉醒',
    items: [
      {
        id: '200',
        name_en: 'Estus Flask',
        name_zh: '原素瓶',
        description_en: "Undead's treasured dark green glass bottle. It accumulates Estus at bonfires, and drinking it restores HP.\n\nIt seems to be closely linked to the Fire Keeper, and the following passage exists in the dark legend:\n\nThe green bottle originates from the Fire Keeper's soul. They guarded the bonfire in life, and continue to guard its warmth even after death.",
        description_zh: '不死人珍重的暗绿色玻璃瓶，可借着营火累积原素，喝下去便能恢复血量。\n\n似乎与营火守护者──系火女有着密切的关联，在黑暗传承中，也有以下一段文字：\n\n那绿色瓶子源自系火女的灵魂，她们在活着的时候守护营火，即便在死后，也持续守护着其温度。',
        hint_en: 'This bottle is your lifeline. It restores HP when you rest at bonfires.',
        hint_zh: '这个瓶子是你的生命线。在营火休息时可以恢复生命值。',
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Oscar of Astora',
        npcName_zh: '亚斯特拉的奥斯卡',
        dialogue_en: "I am Oscar of Astora. Of the Undead, you have a certain look about you... I believe you are destined to do great things. Here, take this. It's not much, but I want you to have it.",
        dialogue_zh: '我是亚斯特拉的奥斯卡。在不死人之中，你有着特别的气质......我相信你注定要做大事。来，拿着这个。虽然不多，但我想给你。',
        location_en: 'Undead Asylum',
        location_zh: '北方不死院',
      },
      {
        npcName_en: 'Anastacia of Astora',
        npcName_zh: '安娜塔西亚',
        dialogue_en: "Will you link the fire? The curse of undeath will be lifted, and I will be able to die as a human. Please, save everyone... May the fire guide you...",
        dialogue_zh: '您愿意传火呀？不死诅咒会消失，而我也能以人的身分死去了。还请您拯救大家……愿火指引您……',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
    ],
    nextArea: AreaId.UndeadAsylum,
    prerequisities: [GamePhase.Start],
    recommendation_en: 'You have just awakened in the Undead Asylum. Your first task is to escape. Find weapons, defeat the Asylum Demon, and escape to Firelink Shrine.',
    recommendation_zh: '你刚刚在北方不死院醒来。你的第一个任务是逃脱。找到武器，击败不死院恶魔，逃到传火祭祀场。',
    reason_en: "You are trapped in the Undead Asylum. You must escape to begin your journey.",
    reason_zh: '你被困在北方不死院。你必须逃脱才能开始你的旅程。',
  },

  // ==================== 第一阶段：前往不死镇 ====================
  {
    id: 'firelink_journey',
    name_en: 'The Journey Begins',
    name_zh: '旅程的开始',
    theme_en: 'Hope and Awakening',
    theme_zh: '希望与觉醒',
    items: [
      {
        id: '200',
        name_en: 'Estus Flask',
        name_zh: '原素瓶',
        description_en: "Undead's treasured dark green glass bottle. It accumulates Estus at bonfires, and drinking it restores HP.\n\nIt seems to be closely linked to the Fire Keeper, and the following passage exists in the dark legend:\n\nThe green bottle originates from the Fire Keeper's soul. They guarded the bonfire in life, and continue to guard its warmth even after death.",
        description_zh: '不死人珍重的暗绿色玻璃瓶，可借着营火累积原素，喝下去便能恢复血量。\n\n似乎与营火守护者──系火女有着密切的关联，在黑暗传承中，也有以下一段文字：\n\n那绿色瓶子源自系火女的灵魂，她们在活着的时候守护营火，即便在死后，也持续守护着其温度。',
        hint_en: 'This bottle is linked to the Fire Keeper. Perhaps you should find someone who can tell you more about it...',
        hint_zh: '这个瓶子与系火女有着密切的关联。也许你应该找到能告诉你更多的人...',
      },
      {
        id: '390',
        name_en: "Fire Keeper Soul (Firelink)",
        name_zh: '系火女的灵魂（传火祭祀场）',
        description_en: "Fire Keeper Soul of the Firelink Shrine's Grey Maiden.\n\nHumanity can attach itself to a Fire Keeper's soul, and it affects their bodies as well: beneath every inch of their skin, countless humanity writhe, making them look quite terrifying.\n\nAnd perhaps she willingly became a prisoner in that dark cell?",
        description_zh: '传火祭祀场的系火女──灰色圣女的灵魂。\n\n人性可以附身在系火女的灵魂上，也会对她们的身体造成影响：她们的每一寸肌肤下，都有无数人性蠢动，那模样看起来十分恐怖。\n\n而她之所以会成为阴暗监牢中的囚虏，会不会是自己心甘情愿如此呢？',
        hint_en: 'The Fire Keeper guards the bonfire. Her soul can strengthen your Estus Flask. Find her in the cell below the bonfire.',
        hint_zh: '系火女守护着营火。她的灵魂可以强化你的原素瓶。在营火下方的牢房里找到她。',
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Crestfallen Warrior',
        npcName_zh: '灰心战士',
        dialogue_en: "Well, what do we have here? You're undead, aren't you? ... I don't know what you're doing here, but you don't look like a Hollow. Anyway, I'll lend you a hand. ... The bell of awakening is in this world. There are two of them, one above and one below. The one above is in Undead Parish, and the one below is in the Depths. That's all I know for sure.",
        dialogue_zh: '嗯，你是什么人？你是不死人吧......我不知道你在这里做什么，但你看起来不像游魂。总之，我会帮你一把。......苏醒之钟在这个世界。有两口，一口在上，一口在下。上面的在不死人教区，下面的在下水道。这就是我所知道的。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Crestfallen Warrior',
        npcName_zh: '灰心战士',
        dialogue_en: "Although one of the bells is indeed up in the Undead Parish, the lift isn't working right now. So you'll have to go along the cliff and enter Undead Burg from the waterway. The other bell is just down below from that Undead Burg. ... But going down from there leads to Blighttown, a place full of sick people. If I were you, I'd want to stay as far away from that place as possible.",
        dialogue_zh: '虽说其中一口钟确实放在此地上方的不死教堂，但现在升降梯已经不动了。所以说，你只能沿着旁边的山崖往上爬，从水路进入不死镇。另一口钟，就从那座不死镇往下走就可以了。......但话说回来，不死镇下去可是座聚集了许多病患的病村。如果是我的话，可是会希望离那地方远远的呢。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Crestfallen Warrior',
        npcName_zh: '灰心战士',
        dialogue_en: "You've already been to the New Londo Ruins below? Just go down the stairs from here, take the lift, and you'll be there right away. If you haven't been there yet, you should go check it out. It's an ancient Undead ruin, and there might be some clues about the mission. Like, for example, the welcome of the dead... Heh heh heh...",
        dialogue_zh: '你已经去过这下面的小隆德遗迹了吗？只要从这边的楼梯往下走，再搭乘升降梯，就可以立刻抵达了。如果还没去过的话，最好去一下看看。那是座古老的不死人遗迹，说不定藏着什么关于使命的提示呢。举例来说，像是亡灵的欢迎之类的......哼哼哼哼',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Crestfallen Warrior',
        npcName_zh: '灰心战士',
        dialogue_en: "By the way, why don't you reinforce your weapons? If you don't know about Blacksmith Andrei, you should go to the old church in the forest below Undead Parish. You should go find him sooner or later. ... But then again, if you like using blunt weapons, then go ahead!",
        dialogue_zh: '说到这边，你为什么不冶炼武器呢？如果你不知道安德烈老爹的话，不妨从不死教堂往下走，到森林的古老教堂走一趟。最好还是早点去找他。......但话说回来，如果你就是喜欢用钝钝的武器，那就随你高兴啦！',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Crestfallen Warrior',
        npcName_zh: '灰心战士',
        dialogue_en: "By the way, you've met her, haven't you? ... The Fire Keeper. Her duty seems to be staying there forever, preventing the Undead bonfire from going out. ... It's quite sad. She can't speak, can't go anywhere. I bet the people from her homeland cut out her tongue so she couldn't call out the names of the gods.",
        dialogue_zh: '说到这边，你应该也见过了吧？......那系火女呀。她的职责似乎就是一直待在那边，避免不死营火熄灭。唉，真是够惨的了。话也没办法说，哪儿都去不了。我猜那女的，她故乡的人一定是拔了她的舌头，让她喊不出神的名字。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Crestfallen Warrior',
        npcName_zh: '灰心男',
        dialogue_en: "Your face is just like a Hollow. You've died too many times. You need to collect Humanity quickly. How to collect Humanity? You can search corpses... or like those clerics, summon each other... The fastest way is to kill normal Undead and take their Humanity.",
        dialogue_zh: '你那张脸简直就和游魂没两样嘛。大概是因为死得太过头了，照这样下去可是马上就会变成真的游魂喔。得要赶紧取得人性呀。怎样收集人性？看是要踏实地捡尸体收集……或是和那票圣职一样，狼狈为奸地相互召唤彼此……另外，最快的方法就是杀害正常的不死人来夺取人性。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Crestfallen Warrior',
        npcName_zh: '灰心男',
        dialogue_en: "I heard there's an Undead Breaker in New Londo. Even if you don't find him, it's worth a try since you're already like this.",
        dialogue_zh: '我曾听说小隆德有一位解咒师。反正就算没找到也不过是和现在一样而已，去走一遭也没差吧？',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Petrus of Thorolund',
        npcName_zh: '佩特鲁斯',
        dialogue_en: "The mission of the Undead is mainly to explore 'Kindling'. Kindling is the art of making the Undead bonfire burn brighter using Humanity.",
        dialogue_zh: '不死人的使命主要便是探索"注火"。"注火"就是借由人性，让不死营火烧得更旺的技艺。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Laurentius of the Great Swamp',
        npcName_zh: '劳伦迪斯',
        dialogue_en: "I can use pyromancy from the Great Swamp. Pyromancy is the art of fire - the primitive life art of igniting and utilizing flame. Pyromancy is ultimately a yearning for fire. We are born in darkness, attracted to fire, but cannot touch it. This intense longing allows us to control part of the fire.",
        dialogue_zh: '我会使用大沼的咒术，小心一点就还过得去。咒术是用火的技艺——是点燃火焰加以利用的原始生命技艺。所谓咒术，说到底就是种对火的憧憬。我们生于黑暗，受到火吸引，但却不得触碰，正是这种强烈的憧憬让我们得以操控一部分的火。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Domhnall of Zena',
        npcName_zh: '德纳尔',
        dialogue_en: "If you want the 'Rite of Kindling' from the Catacombs, you'll need a Divine weapon. That should subdue the reanimated skeletons. The ghosts of New Londo are under a curse and generally cannot be hurt. To hurt them, you need special weapons... or a cursed body.",
        dialogue_zh: '如果想要地下墓地里的"注火"，就要用神圣武器。这应该可以制服苏醒的骸骨。小隆德的亡灵受到了诅咒，一般来说是伤不了他们的，想要伤到他们就要特殊的武器……或受诅咒的身体。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Solaire of Astora',
        npcName_zh: '索拉尔',
        dialogue_en: "For some reason, this world is filled with unstable barriers. However, if you use this, you can transcend the barriers between worlds and cooperate. Summon the other person to come as a phantom, and you can cross the 'barrier'. I am a Sun Warrior, so my summon signs are special and shine brightly.",
        dialogue_zh: '不知怎么一回事，这世界充满了不稳定的隔阂。不过，使用这个的话，就可以超越世界间的隔阂来共同合作。召唤对方使其以灵体状态前来，就能越过"隔阂"了。我是太阳战士，所以召唤记号也是特制的，闪耀着光芒。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
    ],
    nextArea: AreaId.UndeadBurg,
    prerequisities: [GamePhase.Start],
    recommendation_en: 'Head towards the aqueduct leading to the Undead Burg. The path forward lies above. Talk to the Crestfallen Warrior for guidance.',
    recommendation_zh: '前往通往不死镇的引水渠。前方的道路就在上方。与灰心战士交谈获取指引。',
    reason_en: 'You have just arrived at Firelink Shrine. The only viable path is towards the Undead Burg.',
    reason_zh: '你刚刚到达传火祭祀场。唯一可行的道路是通往不死镇。',
  },

  // ==================== 第二阶段：敲响第一口钟 ====================
  {
    id: 'bell_of_awakening_1',
    name_en: 'The First Bell',
    name_zh: '第一口钟',
    theme_en: 'Awakening and Duty',
    theme_zh: '觉醒与使命',
    items: [
      {
        id: '200',
        name_en: 'Estus Flask',
        name_zh: '原素瓶',
        description_en: "Undead's treasured dark green glass bottle. It accumulates Estus at bonfires, and drinking it restores HP.\n\nIt seems to be closely linked to the Fire Keeper, and the following passage exists in the dark legend:\n\nThe green bottle originates from the Fire Keeper's soul. They guarded the bonfire in life, and continue to guard its warmth even after death.",
        description_zh: '不死人珍重的暗绿色玻璃瓶，可借着营火累积原素，喝下去便能恢复血量。\n\n似乎与营火守护者──系火女有着密切的关联，在黑暗传承中，也有以下一段文字：\n\n那绿色瓶子源自系火女的灵魂，她们在活着的时候守护营火，即便在死后，也持续守护着其温度。',
        hint_en: 'The Estus Flask is your lifeline. Strengthen it by giving Fire Keeper Souls to the Fire Keeper.',
        hint_zh: '原素瓶是你的生命线。将系火女的灵魂交给系火女可以强化它。',
      },
      {
        id: '391',
        name_en: "Fire Keeper Soul (Anor Londo)",
        name_zh: '系火女的灵魂（亚诺尔隆德）',
        description_en: "Fire Keeper Soul of the Darkmoon Knightess in Anor Londo.\n\nHumanity can attach itself to a Fire Keeper's soul, and it affects their bodies as well: beneath every inch of their skin, countless humanity writhe, making them look quite terrifying.\n\nAnd she wears that brass armor to hide that terrifying appearance.",
        description_zh: '亚诺尔隆德的系火女──暗月女骑士的灵魂。\n\n人性可以附身在系火女的灵魂上，也会对她们的身体造成影响：她们的每一寸肌肤下，都有无数人性蠢动，那模样看起来十分恐怖。\n\n而她会穿戴一身黄铜铠甲，也是为了掩饰那恐怖的模样。',
        hint_en: 'This soul belongs to a Fire Keeper in Anor Londo. You will find her guarding a bonfire in that city of gods.',
        hint_zh: '这个灵魂属于亚诺尔隆德的系火女。你将在那座神之城中找到守护营火的她。',
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Solaire of Astora',
        npcName_zh: '亚斯特拉的索拉尔',
        dialogue_en: "Ah, hello! You don't look Hollow, do you? I am Solaire of Astora, an adherent of the Lord of Sunlight. ... If you are undead, you should find the bell of awakening. The one above is in the Undead Parish, atop the church. The one below is in the Depths, at the bottom of the great hole.",
        dialogue_zh: '啊，你好！你看起来不像游魂，对吧？我是亚斯特拉的索拉尔，阳光之王的追随者。......如果你是不死人，你应该找到苏醒之钟。上面的在不死人教区，在教堂顶部。下面的在下水道，在大洞的底部。',
        location_en: 'Undead Burg',
        location_zh: '不死镇',
      },
      {
        npcName_en: 'Undead Merchant',
        npcName_zh: '不死男商人',
        dialogue_en: "It's not safe around here. There was a Capra Demon down there, and a big flying dragon up top. Recently a Taurus Demon seems to have appeared too. If you're going to die, at least pick a good spot.",
        dialogue_zh: '这附近不是很安全。先前这下面住了一只山羊头的恶魔，上面也不安宁有只大飞龙，最近好像连牛头的恶魔都出现了。你要死最好也选个好地方再死啊。',
        location_en: 'Undead Burg',
        location_zh: '不死镇',
      },
      {
        npcName_en: 'Undead Female Merchant',
        npcName_zh: '不死女商人',
        dialogue_en: "You're undead too, right? Be careful. The lower you go in this city, the more it's filled with poison and disease, unclean things. Everyone's done for without moss. You too, so carry plenty.",
        dialogue_zh: '你也是不死人吧？要小心啊。这城镇越是往下，就越是充满了毒与疾病那种不干净的东西。谁都一样，没有了苔藓就完蛋了。你也是，所以要多带一点去喔。',
        location_en: 'Undead Burg',
        location_zh: '不死镇',
      },
      {
        npcName_en: 'Griggs of Vinheim',
        npcName_zh: '古利古斯',
        dialogue_en: "Before using magic, you need to prepare. First, equip a catalyst, memorize the spell, then you can use it. Remember this well. The Archives in Anor Londo have the gods' library. I think that's where my master wanted to go.",
        dialogue_zh: '使用魔法之前，要做一些准备工作。首先，要装备好媒介，并记忆魔法，然后才可以使用魔法。要好好记住啊。亚诺尔隆德有神的书库，我想那里是老师想去的地方。',
        location_en: 'Undead Burg',
        location_zh: '不死镇',
      },
      {
        npcName_en: 'Andre of Astora',
        npcName_zh: '安德烈',
        dialogue_en: "Are you having trouble getting into the Undead Church? Take this key. Weapons and armor are sturdy, but if you use them without maintenance, they will definitely break. When weapon or armor durability drops, repair them regularly. You can bring them to a blacksmith like me, or if you have the tools, you can repair them yourself.",
        dialogue_zh: '你在烦恼没办法进入不死教堂吗？拿这把钥匙去用吧。武器和防具都是很坚固耐用的没错，但是一直使用而不维修的话，是肯定会坏的。当武器防具的耐用度降低时，就要勤加修理。你可以拿给我这样的铁匠修，若有工具的话，你也可以自己修。',
        location_en: 'Undead Parish',
        location_zh: '不死人教区',
      },
      {
        npcName_en: 'Andre of Astora',
        npcName_zh: '安德烈',
        dialogue_en: "There are two ancient forbidden areas here: Sen's Fortress and Darkroot Garden. Sen's Fortress and Darkroot Garden are not places normal people go. Sen's Fortress was built by the ancient gods to test people. Legend says beyond it lies the gods' castle - the great Anor Londo. Most Undead can't even enter the fortress, like that onion knight.",
        dialogue_zh: '这里通往两个古老禁区，赛恩古城及黑森林庭院。赛恩古城及黑森林庭院，都不是什么正常人会去的地方。赛恩古城是古代神所建造，用来考验人的，传说从那往前走，有神的城堡——伟大的亚诺尔隆德。大部分的不死人是连进到古城都办不到的，就像那个洋葱骑士一样。',
        location_en: 'Undead Parish',
        location_zh: '不死人教区',
      },
      {
        npcName_en: 'Andre of Astora',
        npcName_zh: '安德烈',
        dialogue_en: "Over there is the grave of Knight Artorias, who 'walked the Abyss'. I heard that people who went to the forest... none of them came back.",
        dialogue_zh: '那边有"漫步深渊"的骑士，亚尔特留斯的坟墓。告诉我传闻的那些到森林去的人，一个都没回来……',
        location_en: 'Undead Parish',
        location_zh: '不死人教区',
      },
      {
        npcName_en: 'Oswald of Carim',
        npcName_zh: '欧兹华德',
        dialogue_en: "If you want to maintain your dignity as a human, confess to me. Whether it's absolution or accusation... everything related to sin is under my control. If you've committed any sin, come back here. All sins can be forgiven.",
        dialogue_zh: '如果你想要保持身为人的尊严，就向我告解吧。无论是赦罪或控诉……所有与罪相关的都是由我掌管。如果犯了什么罪，请你再来此处。任何的罪都是可以饶恕的。',
        location_en: 'Undead Parish',
        location_zh: '不死人教区',
      },
    ],
    nextArea: AreaId.UndeadParish,
    prerequisities: [GamePhase.UndeadBurg],
    recommendation_en: 'Climb to the top of the Undead Parish and ring the First Bell of Awakening. Seek out Solaire for guidance.',
    recommendation_zh: '爬到不死人教区的顶部，敲响第一口苏醒之钟。寻找索拉尔获取指引。',
    reason_en: 'You have reached the Undead Parish. The bell tower awaits above.',
    reason_zh: '你已到达不死人教区。钟楼就在上方等待着你。',
  },

  // ==================== 第三阶段：黑森林庭院探索 ====================
  {
    id: 'darkroot_garden',
    name_en: 'The Darkroot Garden',
    name_zh: '黑森林庭院',
    theme_en: 'Ancient Forest and Secrets',
    theme_zh: '古老森林与秘密',
    items: [
      {
        id: '1011',
        name_en: 'Crest of Artorias',
        name_zh: '亚尔特留斯徽章',
        description_en: 'Crest bearing the symbol of Knight Artorias.\n\nThis crest opens the sealed gate in Darkroot Garden, leading to the forest of the Great Grey Wolf Sif.',
        description_zh: '刻有骑士亚尔特留斯徽记的纹章。\n\n此纹章可打开黑森林庭院的封印之门，通往大狼希夫守护的森林。',
        hint_en: 'This crest opens the gate to the deeper forest. You need it to reach Sif and other secrets.',
        hint_zh: '这个纹章可以打开通往森林深处的大门。你需要它才能到达希夫和其他秘密。',
        requiredItemIds: [],
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Andre of Astora',
        npcName_zh: '亚斯特拉的安德烈',
        dialogue_en: "Ah, hello! I am Andre of Astora. I'm a blacksmith. ... If you're heading into the forest, be careful. The path is guarded by stone knights and other creatures. And beyond the sealed gate, a great wolf awaits.",
        dialogue_zh: '啊，你好！我是亚斯特拉的安德烈，铁匠。......如果你要进入森林，小心点。路径被石骑士和其他生物守卫着。在封印之门后面，一只巨狼在等待。',
        location_en: 'Undead Parish',
        location_zh: '不死人教区',
      },
      {
        npcName_en: 'Alvina',
        npcName_zh: '雅薇娜',
        dialogue_en: "I advise you to give up. The legacy of Artorias is just a fairy tale. If you truly respected him, you wouldn't desecrate the hero's grave for such things. When you wear this ring, I can summon you. When I sense an invader, I'll summon you, and after that it's up to you how to fight. Just drive the invader away. I might summon others too, so you can cooperate with them. Driving back invaders earns rewards, and you can keep all the items you take. Our forest is like family, betrayal is absolutely not allowed. Remember that. Don't become a Hollow.",
        dialogue_zh: '我劝你放弃吧。什么亚尔特留斯的传承，根本是空穴来风，那只是童话故事罢了。真的对他有敬意，就不会为了那种东西来糟蹋英雄的墓了。你戴上这只戒指时，我就可以召唤你。感觉有入侵者时，会召唤你出来，之后要如何战斗就随你了，能把入侵者赶走就好。还可能会召唤其他人，所以你也可以和他们一起合作。击退入侵者会有报酬，夺到的物品也都可以全部归自己所有。我们整个团就是一家人，绝不允许有人背叛。这点你一定要记住。不要变成游魂了啊。',
        location_en: 'Darkroot Garden',
        location_zh: '黑森林庭院',
      },
      {
        npcName_en: 'Shiva of the East',
        npcName_zh: '芝',
        dialogue_en: "We fight and hunt according to each person's preference, and the prey is first come first served. But I believe the White Cat has already told you, no matter what, betrayal is absolutely not tolerated. No patience, no big fish. Have you heard of the Chaos Blade? It's a famous sword forged by an ancient Undead smith, with a mottled dragon pattern.",
        dialogue_zh: '我们就是依照各人喜好来应战、狩猎，猎物也是先抢先赢。不过相信白猫也已经和你提过了，不管怎样都绝不容许背叛的行为。没有耐性可是钓不到大鱼喔。你有没有听过混沌之刃这把武器？那是把由远古不死人刀匠锻造而成，具有斑龙纹的名剑。',
        location_en: 'Darkroot Garden',
        location_zh: '黑森林庭院',
      },
    ],
    nextArea: AreaId.DarkrootGarden,
    prerequisities: [GamePhase.AfterBell1],
    recommendation_en: 'Explore the Darkroot Garden beyond the Undead Parish. Defeat the Moonlight Butterfly and obtain the Crest of Artorias to open the path to deeper secrets.',
    recommendation_zh: '探索不死人教区后方的黑森林庭院。击败月光蝶，获取亚尔特留斯徽章，开启通往更深处秘密的道路。',
    reason_en: 'The Darkroot Garden holds valuable treasures and the path to the Covenant of Artorias ring, which is essential for entering the Abyss later.',
    reason_zh: '黑森林庭院藏着珍贵的宝物和通往亚尔特留斯契约戒指的道路，这是进入深渊的必备之物。',
  },

  // ==================== 第四阶段：敲响第二口钟 ====================
  {
    id: 'bell_of_awakening_2',
    name_en: 'The Second Bell',
    name_zh: '第二口钟',
    theme_en: 'Sacrifice and Chaos',
    theme_zh: '牺牲与混沌',
    items: [
      {
        id: '392',
        name_en: "Fire Keeper Soul (Quelaag)",
        name_zh: '系火女的灵魂（克拉格）',
        description_en: "Fire Keeper Soul of the Daughter of Chaos at Quelaag's domain.\n\nHumanity can attach itself to a Fire Keeper's soul, and it affects their bodies as well: beneath every inch of their skin, countless humanity writhe, making them look quite terrifying.\n\nAnd on her body, humanity has become countless eggs. Those eggs are all cradles of humanity.",
        description_zh: '克拉格住处的系火女──混沌的女儿的灵魂。\n\n人性可以附身在系火女的灵魂上，也会对她们的身体造成影响：她们的每一寸肌肤下，都有无数人性蠢动，那模样看起来十分恐怖。\n\n而在她的身上，人性则是化为无数颗蛋。那些蛋全都是人性的摇篮。',
        hint_en: 'The daughter of Chaos guards the second bell. She sacrificed herself to contain the chaos. Find her behind Quelaag.',
        hint_zh: '混沌的女儿守护着第二口钟。她牺牲自己来遏制混沌。在克拉格后面找到她。',
      },
      {
        id: '406',
        name_en: 'Soul of Quelaag',
        name_zh: '克拉格的灵魂',
        description_en: 'Soul of Chaos Witch Quelaag, who resides in the realm of the gods.\n\nSpecial beings have special souls. Quelaag, who became one with the Chaos Flame, her soul can be used to acquire a great deal of souls, or to create an unequaled weapon.',
        description_zh: '混沌魔女克拉格的灵魂，她居住在神的领域。\n\n特殊的人物会拥有特殊的灵魂。与混沌火焰合为一体的克拉格，其灵魂使用后，可以获得不计其数的灵魂，或是可以用来创造出无与伦比的武器。',
        hint_en: 'Quelaag guarded the second bell. Her sister, the White Spider, can reinforce your Estus Flask.',
        hint_zh: '克拉格守护着第二口钟。她的妹妹，白蜘蛛，可以强化你的原素瓶。',
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Laurentius of the Great Swamp',
        npcName_zh: '大沼的劳伦迪斯',
        dialogue_en: "Oh, hello! I didn't notice you there. I am Laurentius, a pyromancer of the Great Swamp. ... If you're heading to Blighttown, be careful. The place is filled with poison and disease. And the Chaos Witch Quelaag guards the second bell. She's a powerful foe.",
        dialogue_zh: '哦，你好！我没注意到你在那里。我是劳伦迪斯，大沼的咒术师。......如果你要去病村，小心点。那里充满了毒和疾病。混沌魔女克拉格守护着第二口钟。她是一个强大的敌人。',
        location_en: 'Depths',
        location_zh: '下水道',
      },
      {
        npcName_en: 'Quelana of Izalith',
        npcName_zh: '克拉娜',
        dialogue_en: "I'll take you as my disciple. But to learn my pyromancy, you must give me appropriate compensation. Pyromancy is the art of fire. The art of igniting and controlling flame. But there's one thing you must remember: you must revere flame. If you forget this reverence, you will be consumed by fire and lose everything. My mother Izalith was one of the original kings. She discovered souls near the First Flame and became a queen. The Chaos Flame consumed my mother and sisters, making them a cradle for deformed life. I want to ask you, please free my mother and sisters from the Chaos Flame.",
        dialogue_zh: '我就收你当我的徒弟。但是想学我的咒术，你必须要给我相对的报酬。咒术是用火的技艺。点燃火焰再加以操控的技艺。但有件事你一定要记住：你必须敬畏火焰。如果你忘了这份敬畏之心，将被火吞噬而失去一切。我的母亲伊札里斯是最初诸王之一。她在初始之火周边发现了灵魂，并因此当上了王。混沌火焰把我的母亲以及妹妹们吞噬，把她们做为孕育畸形生命的温床。我想拜托你，帮我把母亲和妹妹们从混沌火焰中解放吧。',
        location_en: 'Blighttown',
        location_zh: '病村',
      },
      {
        npcName_en: 'Chaos Witch Quelaag',
        npcName_zh: '克拉格',
        dialogue_en: "Beyond here is the forbidden land of covenant - the land of Chaos life. We have accepted the seal. Go back. Otherwise you will be consumed by fire and become a cradle for Chaos life.",
        dialogue_zh: '再往前走就是约定的禁地——混沌生命之地，我们接受了封印。回去吧。否则你将被火吞噬，化为混沌生命的温床。',
        location_en: "Quelaag's Domain",
        location_zh: '混沌废都伊札里斯入口',
      },
      {
        npcName_en: 'Eingyi',
        npcName_zh: '伊札里斯的仆人',
        dialogue_en: "Below these ruins is the legendary city of Izalith, a relic of the Chaos Flame guarded by lava giants. The young lady escaped here with Quelaag from those ruins. Have you heard of 'Quelana the Wanderer'? They say somewhere in that poison swamp, there's a non-human witch. Some say she's the sister of the young lady and Quelaag.",
        dialogue_zh: '在这座遗迹的下方，有着传说的废都——伊札里斯，那是座受到岩浆巨人守护，混沌火焰的遗迹。大小姐便是和克拉格大小姐一起，从那座遗迹逃到此处。你这小子有听过"流浪的克拉娜"吗？据说在那座毒沼泽的某处，有一个不是人的魔女。也有人说那魔女是大小姐和克拉格大小姐的姊妹。',
        location_en: "Quelaag's Domain",
        location_zh: '混沌废都伊札里斯入口',
      },
    ],
    nextArea: AreaId.Blighttown,
    prerequisities: [GamePhase.AfterBell1],
    recommendation_en: 'Descend into the Depths and find your way to Blighttown. The second bell awaits below. Talk to Laurentius for advice.',
    recommendation_zh: '深入下水道，找到通往病村的路。第二口钟就在下方等待着你。与劳伦迪斯交谈获取建议。',
    reason_en: 'The first bell has been rung. Now you must find the second bell in the depths below.',
    reason_zh: '第一口钟已经敲响。现在你必须在下方的深处找到第二口钟。',
  },

  // ==================== 重返北方不死院 ====================
  {
    id: 'return_to_asylum',
    name_en: 'Return to the Asylum',
    name_zh: '重返北方不死院',
    theme_en: 'Preparation and Discovery',
    theme_zh: '准备与发现',
    items: [
      {
        id: '212',
        name_en: 'Rusted Iron Ring',
        name_zh: '生锈铁环',
        description_en: 'Special ring granted to those who departed the Undead Asylum.\n\nThe rusted ring, which was found in the asylum where Undead are imprisoned, provides the ability to move more freely in areas with severe restrictions on movement.',
        description_zh: '特别赐予离开不死院之人的戒指。\n\n这枚生锈的戒指是在囚禁不死人的牢狱中找到的，能够让人在行动受到严重限制的区域更自由地移动。',
        hint_en: 'This ring allows you to walk freely in swamps and water. Essential for Blighttown and other areas.',
        hint_zh: '这枚戒指让你能在沼泽和水中自由行走。对病村和其他区域至关重要。',
        requiredItemIds: [], // 始终显示
      },
      {
        id: '220',
        name_en: 'Peculiar Doll',
        name_zh: '诡异人偶',
        description_en: 'Silver pendant engraved with the crest of Knight Artorias.\n\nOne of the ancient treasures of Anor Londo, given specially to him who challenged the Abyss.\n\nUse it to briefly evade the darkness of the Abyss. Particularly effective against dark magic.',
        description_zh: '雕有骑士亚尔特留斯徽章的银项链。\n\n亚诺尔隆德的远古宝物之一，特别赠予挑战深渊的他。\n\n使用后能闪避深渊黑暗，对闪避法术特别有效。',
        hint_en: 'This pendant was given to Artorias. It may be connected to the ancient city of Oolacile...',
        hint_zh: '这条项链是赐予亚尔特留斯的。它可能与古老的乌拉席露城有关...',
        requiredItemIds: [],
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Domhnall of Zena',
        npcName_zh: '德纳尔',
        dialogue_en: "Ah, hello! I am Domhnall of Zena. I deal in rare and unusual items. ... If you're heading into the depths, you might want a Rusted Iron Ring. It helps you move freely in swamps. You can find one back at the Undead Asylum.",
        dialogue_zh: '啊，你好！我是德纳尔。我经营稀有和不寻常的物品。......如果你要深入下水道，你可能需要一枚生锈铁环。它能让你在沼泽中自由移动。你可以在北方不死院找到一枚。',
        location_en: 'Depths',
        location_zh: '下水道',
      },
    ],
    nextArea: AreaId.ReturnToAsylum,
    prerequisities: [GamePhase.AfterBell2],
    recommendation_en: 'Before entering the toxic Blighttown, return to the Undead Asylum. The Rusted Iron Ring will make your journey much easier. Talk to Domhnall for advice.',
    recommendation_zh: '在进入有毒的病村之前，先返回北方不死院。生锈铁环会让你的旅程轻松很多。与德纳尔交谈获取建议。',
    reason_en: 'Blighttown is filled with poison swamps. The Rusted Iron Ring allows free movement in such terrain. It is highly recommended to obtain it first.',
    reason_zh: '病村充满了毒沼。生锈铁环让你能在这种地形中自由移动。强烈建议先获取它。',
  },

  // ==================== 第四阶段：赛恩古城 ====================
  {
    id: 'sens_fortress',
    name_en: "Sen's Fortress",
    name_zh: '赛恩古城',
    theme_en: 'Trial and Tribulation',
    theme_zh: '试炼与磨难',
    items: [
      {
        id: '2510',
        name_en: 'Lordvessel',
        name_zh: '王器',
        description_en: 'Soul vessel of the undead hero chosen to succeed Lord Gwyn.\n\nAllows the user to warp between bonfires.\n\nPlace this vessel on the Altar of Fire and fill it with great souls, and the final door should open.',
        description_zh: '被选为葛温王后继者的不死人英雄得到的灵魂容器。\n可得到以传送方式移动到营火处的技艺。\n\n将此容器放到传火祭坛上，并用伟大的灵魂盛满，相信就可以打开最后的门。',
        hint_en: 'The Lordvessel is the key to the final challenge. You must collect the souls of the four great lords to fill it.',
        hint_zh: '王器是通往最终挑战的钥匙。你必须收集四位伟大薪王的灵魂来填满它。',
        requiredItemIds: [],
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Frampt',
        npcName_zh: '芙拉姆特',
        dialogue_en: "Then, I shall open the gates of Sen's Fortress. It is the only path to Anor Londo.",
        dialogue_zh: '那么，我就打开赛恩古城的大门吧，那是前往亚诺尔隆德的必经之道。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Frampt',
        npcName_zh: '芙拉姆特',
        dialogue_en: "Sen's Fortress is a trial that all who seek to reach the gods must face. The path is filled with traps and dangers. Be cautious.",
        dialogue_zh: '赛恩古城乃是人前往神国必经的考验，路途中遍布陷阱。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Siegmeyer of Catarina',
        npcName_zh: '卡塔利纳的杰克麦雅',
        dialogue_en: "I don't know how to open this gate... I've been waiting here... and there's no way to open it.",
        dialogue_zh: '不知道怎么开这道门……我在这里一直等……就是没有办法打开。',
        location_en: "Sen's Fortress entrance",
        location_zh: '赛恩古城入口',
      },
      {
        npcName_en: 'Siegmeyer of Catarina',
        npcName_zh: '卡塔利纳的杰克麦雅',
        dialogue_en: "Those boulders rolling back and forth... I'm fat, you know? They roll way too fast for me.",
        dialogue_zh: '那边滚来滚去的铁球……我胖胖的，对吧？铁球滚动的速度实在太快了。',
        location_en: "Sen's Fortress boulder trap",
        location_zh: '赛恩古城铁球陷阱房间',
      },
      {
        npcName_en: 'Crestfallen Merchant',
        npcName_zh: '赛恩古城商人',
        dialogue_en: "You must never go to Anor Londo. Neither Knight King Rendall, nor the Black Iron Tarkus, nor even Logan could do it. The deeper you go, the greater the despair. I've known this for a hundred years.",
        dialogue_zh: '你绝对不可以去亚诺尔隆德。不管是骑士王伦德尔，还是黑铁的塔尔卡斯，即便是罗根也不成。越是深入，你得到的绝望就越深。我很清楚，这百年来都这样。',
        location_en: "Sen's Fortress",
        location_zh: '赛恩古城',
      },
      {
        npcName_en: 'Sieglinde of Catarina',
        npcName_zh: '吉克琳德',
        dialogue_en: "My simple-minded father is always muddled. I hope he stays put and doesn't run around. He wears the same armor as me, so he should be quite conspicuous.",
        dialogue_zh: '少根筋的父亲总是糊里胡涂的，希望他能好好待着别乱跑。他穿着和我一样的甲胄，我想应该很显眼才对。',
        location_en: "Sen's Fortress",
        location_zh: '赛恩古城',
      },
    ],
    nextArea: AreaId.SensFortress,
    prerequisities: [GamePhase.AfterBell2],
    recommendation_en: "The gate to Sen's Fortress is now open. Cross this treacherous castle to reach Anor Londo. Talk to Siegmeyer and Frampt for guidance.",
    recommendation_zh: '赛恩古城的大门现在打开了。穿过这座危险的城堡到达亚诺尔隆德。与杰克麦雅和芙拉姆特交谈获取指引。',
    reason_en: "You have rung both bells. The way to Sen's Fortress is open. Beyond lies Anor Londo, the city of gods.",
    reason_zh: '你已经敲响了两口钟。通往赛恩古城的道路打开了。亚诺尔隆德就在前方。',
  },

  // ==================== 第五阶段：亚诺尔隆德 ====================
  {
    id: 'anor_londo',
    name_en: 'The City of Gods',
    name_zh: '神之城',
    theme_en: 'Glory and Power',
    theme_zh: '荣耀与力量',
    items: [
      {
        id: '2510',
        name_en: 'Lordvessel',
        name_zh: '王器',
        description_en: 'Soul vessel of the undead hero chosen to succeed Lord Gwyn.\n\nAllows the user to warp between bonfires.\n\nPlace this vessel on the Altar of Fire and fill it with great souls, and the final door should open.',
        description_zh: '被选为葛温王后继者的不死人英雄得到的灵魂容器。\n可得到以传送方式移动到营火处的技艺。\n\n将此容器放到传火祭坛上，并用伟大的灵魂盛满，相信就可以打开最后的门。',
        hint_en: 'The Lordvessel is the key to the final challenge. You must collect the souls of the four great lords to fill it.',
        hint_zh: '王器是通往最终挑战的钥匙。你必须收集四位伟大薪王的灵魂来填满它。',
        requiredItemIds: [],
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Gwynevere, Princess of Sunlight',
        npcName_zh: '阳光公主葛温艾薇雅',
        dialogue_en: "You have done so much for us. I cannot thank you enough. ... Take this, the Lordvessel. Place it on the altar at Firelink Shrine, and the path to the Kiln of the First Flame will open. But first, you must collect the souls of the four great lords.",
        dialogue_zh: '你为我们做了这么多。我无法表达足够的感谢。......拿着这个，王器。将它放在传火祭祀场的祭坛上，通往初火之炉的道路就会打开。但首先，你必须收集四位伟大薪王的灵魂。',
        location_en: 'Anor Londo',
        location_zh: '亚诺尔隆德',
      },
      {
        npcName_en: 'Gwyndolin',
        npcName_zh: '葛温德林',
        dialogue_en: "Ahead lies the tomb of Lord Gwyn. Regardless of who you are, defiling that place is forbidden. If you have no intention of disrespect and are a loyal follower of the Blades of the Darkmoon, prostrate yourself here. If you have the resolve to become my blade and hunt the gods' enemies, I will protect you. Leave quickly and fulfill your duty.",
        dialogue_zh: '前方即为葛温大王之墓，无论来者何人，均不许玷污该处。若汝无不敬之意，并为暗月之剑之忠实信徒，当在此伏地跪拜。汝若有决心立誓化为吾剑，以讨逆神贼敌，成为吾父葛温、吾姊葛维艾薇雅之影，吾当守护汝。速速离开此处，完成汝应尽之职责吧。',
        location_en: 'Anor Londo',
        location_zh: '亚诺尔隆德',
      },
      {
        npcName_en: 'Gwynevere, Princess of Sunlight',
        npcName_zh: '葛温艾薇雅',
        dialogue_en: "Please, become the successor to Lord Gwyn and inherit the fire of the world. If the fire of the world is lost, only cold darkness and fear will remain. The serpent Frampt who seeks kings will assist and guide you. From now on, I am your guardian. If you have any requests, I will do everything in my power to help you.",
        dialogue_zh: '请你成为葛温大王后继者，传承世界之火吧。倘若失去了世界之火，所遗留下来的将只有冰冷的黑暗及恐惧而已。世界之蛇——寻找王者的芙拉姆特一定会从旁协助引导你的。自此之后，我就是你的守护者了。如果你有任何请求，我将竭尽一切能力来协助你。',
        location_en: 'Anor Londo',
        location_zh: '亚诺尔隆德',
      },
      {
        npcName_en: 'Darkmoon Guard',
        npcName_zh: '暗月骑士',
        dialogue_en: "From here you can go where you need to go - Lord Gwyn's original castle. If you are a true hero, you should receive revelation there. Rest here if you need to. That's what bonfires are for. Speaking of which, do you know about Seath the Scaleless? In legend, he betrayed the ancient dragons. He became allies with Lord Gwyn, received the title of Duke and freedom to research, and spent his days in the great archive studying the immortal scales he lacks. The archive is on the mountain to the left outside this place. Remember, never go near there... The guardian bonfire is special, connected to each other, the flame never goes out.",
        dialogue_zh: '从这里往前走，就可以去你要去的地方，葛温大王原本的城堡。如果你是真正的勇者，那么你应该可以在那得到天启。有需要就在这里休息吧。营火就是为此而设的嘛。说到这，你知道白龙希斯吗？在传说中，他是古龙的背叛者。他和葛温大王成为盟友，获得了公爵的称号和探究的自由，因而在巨大的书库里，成日研究自己所没有的不死鳞片。书库就位于这地方外面的左边山上。记住，千万不要靠近那里……守护者的营火比较特殊，彼此是连在一起的，火焰永远不会熄灭。',
        location_en: 'Anor Londo',
        location_zh: '亚诺尔隆德',
      },
      {
        npcName_en: 'Giant Blacksmith',
        npcName_zh: '巨人铁匠',
        dialogue_en: "Talk, I can't. Smithing, I'm good at. Anytime. Bring me the Duke's shiny thing. I'll make shiny weapons.",
        dialogue_zh: '说话，我不行。冶炼，我拿手。随时都行。你拿公爵的亮亮的来。我会做亮亮的武器。',
        location_en: 'Anor Londo',
        location_zh: '亚诺尔隆德',
      },
    ],
    nextArea: AreaId.AnorLondo,
    prerequisities: [GamePhase.SensFortress],
    recommendation_en: "Cross Sen's Fortress and reach Anor Londo. Defeat Ornstein and Smough to meet Gwynevere and receive the Lordvessel.",
    recommendation_zh: '穿过赛恩古城，到达亚诺尔隆德。击败翁斯坦与斯摩，会见葛温艾薇雅，获得王器。',
    reason_en: "You have rung both bells. The gate to Sen's Fortress is now open. Beyond lies Anor Londo.",
    reason_zh: '你已经敲响了两口钟。赛恩古城的大门现在打开了。亚诺尔隆德就在前方。',
  },

  // ==================== 第五阶段：击败翁斯坦与斯摩后 ====================
  {
    id: 'after_ornstein_smough',
    name_en: 'The Lordvessel Awaits',
    name_zh: '王器在等待',
    theme_en: 'Glory and Responsibility',
    theme_zh: '荣耀与责任',
    items: [
      {
        id: '2510',
        name_en: 'Lordvessel',
        name_zh: '王器',
        description_en: 'Soul vessel of the undead hero chosen to succeed Lord Gwyn.\n\nAllows the user to warp between bonfires.\n\nPlace this vessel on the Altar of Fire and fill it with great souls, and the final door should open.',
        description_zh: '被选为葛温王后继者的不死人英雄得到的灵魂容器。\n可得到以传送方式移动到营火处的技艺。\n\n将此容器放到传火祭坛上，并用伟大的灵魂盛满，相信就可以打开最后的门。',
        hint_en: 'The Lordvessel is the key to the final challenge. You must collect the souls of the four great lords to fill it.',
        hint_zh: '王器是通往最终挑战的钥匙。你必须收集四位伟大薪王的灵魂来填满它。',
        requiredItemIds: [],
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Gwynevere, Princess of Sunlight',
        npcName_zh: '阳光公主葛温艾薇雅',
        dialogue_en: "You have done so much for us. I cannot thank you enough. ... Take this, the Lordvessel. Place it on the altar at Firelink Shrine, and the path to the Kiln of the First Flame will open. But first, you must collect the souls of the four great lords.",
        dialogue_zh: '你为我们做了这么多。我无法表达足够的感谢。......拿着这个，王器。将它放在传火祭祀场的祭坛上，通往初火之炉的道路就会打开。但首先，你必须收集四位伟大薪王的灵魂。',
        location_en: 'Anor Londo',
        location_zh: '亚诺尔隆德',
      },
      {
        npcName_en: 'Frampt',
        npcName_zh: '芙拉姆特',
        dialogue_en: "You have done well. You have collected the souls of the four great lords. Now, place them in the Lordvessel, and the path to the Kiln of the First Flame will open. There, Gwyn, the Lord of Cinder, awaits. You must succeed him, or the Age of Fire will end.",
        dialogue_zh: '你做得很好。你已经收集了四位伟大薪王的灵魂。现在，将它们放入王器，通往初火之炉的道路就会打开。在那里，薪王葛温在等待着你。你必须继承他，否则火焰时代将会结束。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
    ],
    nextArea: AreaId.FirelinkShrine,
    prerequisities: [GamePhase.AfterOrnsteinSmough],
    recommendation_en: 'You have defeated Ornstein and Smough. Now you must place the Lordvessel at the altar in Firelink Shrine. Talk to Gwynevere and Frampt for guidance.',
    recommendation_zh: '你已经击败了翁斯坦与斯摩。现在你必须将王器放在传火祭祀场的祭坛上。与葛温艾薇雅和芙拉姆特交谈获取指引。',
    reason_en: 'You have proven yourself worthy. The Lordvessel is yours. Place it at the altar to open the path forward.',
    reason_zh: '你已经证明了自己的价值。王器是你的了。将它放在祭坛上以打开前进的道路。',
  },

  // ==================== 第六阶段：收集薪王灵魂 ====================
  {
    id: 'lord_souls_seath',
    name_en: 'The Scaleless One',
    name_zh: '无鳞之龙',
    theme_en: 'Betrayal and Immortality',
    theme_zh: '背叛与不死',
    items: [
      {
        id: '2503',
        name_en: "Seath the Scaleless's Soul",
        name_zh: '白龙希斯的灵魂',
        description_en: "Soul of Seath the Scaleless, who received a portion of Lord Gwyn's powerful soul.\n\nSeath betrayed the ancient dragons and joined Lord Gwyn's army. When he was made a Duke and given lands of his own, he received a portion of Gwyn's powerful soul.\n\nThough it is only a part of a soul, it is nonetheless powerful enough to fill the Lordvessel.",
        description_zh: '白龙希斯的灵魂，他分得了葛温王的伟大灵魂。\n\n白龙背叛古龙，加入葛温王的阵营，之后以公爵身分成为王的外藩时，便分得葛温王的伟大灵魂。\n\n虽然这只是部分灵魂，但仍足以用来装满王器。',
        hint_en: 'Seath resides in the Duke\'s Archives. He is immortal in his primordial crystal. Destroy it to make him vulnerable.',
        hint_zh: '希斯居住在公爵书斋。他在最初的结晶中是不死的。摧毁它才能让他变得脆弱。',
        requiredItemIds: [],
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Big Hat Logan',
        npcName_zh: '大帽子罗根',
        dialogue_en: "I am Logan, the great sorcerer. ... Seath the Scaleless is a traitor to his own kind. He betrayed the dragons and joined Lord Gwyn. Now he resides in the Duke's Archives, obsessed with immortality. His primordial crystal makes him invincible. Destroy it, and he will be vulnerable.",
        dialogue_zh: '我是罗根，伟大的魔法师。......白龙希斯是背叛同类的叛徒。他背叛了古龙，加入了葛温王。现在他居住在公爵书斋，痴迷于不死。他的最初的结晶让他无敌。摧毁它，他就会变得脆弱。',
        location_en: "Duke's Archives",
        location_zh: '公爵书斋',
      },
      {
        npcName_en: 'Big Hat Logan',
        npcName_zh: '罗根',
        dialogue_en: "Seath's immortality secret... wounds heal instantly, so he cannot receive fatal wounds and will never die. That seems to be the effect of the Primordial Crystal, a treasure he obtained by betraying the ancient dragons. If you don't destroy the Primordial Crystal first, you absolutely cannot harm Seath. The Primordial Crystal is in the atrium of this archive - the Crystal Cave.",
        dialogue_zh: '白龙希斯的不死秘密……伤口立刻就会痊愈，所以也不会受到致命伤，绝对不会死亡。那似乎是希斯背叛了古龙所取得的秘宝——原始结晶的效果。如果不先破坏原始结晶的话，就绝对无法伤到希斯分毫。而原始结晶便放在这座书库的中庭——结晶森林里头。',
        location_en: "Duke's Archives",
        location_zh: '公爵书斋',
      },
    ],
    nextArea: AreaId.DukesArchives,
    prerequisities: [GamePhase.ObtainedLordvessel],
    alternativeBosses: ['seath'],
    recommendation_en: "Seek out Seath the Scaleless in the Duke's Archives. He guards one of the four Lord Souls. Talk to Big Hat Logan for guidance.",
    recommendation_zh: '前往公爵书斋寻找白龙希斯。他守护着四个薪王灵魂之一。与大帽子罗根交谈获取指引。',
    reason_en: 'You have the Lordvessel. You must collect the souls of the four great lords. Seath the Scaleless is one of them.',
    reason_zh: '你已经获得了王器。你必须收集四位伟大薪王的灵魂。白龙希斯是其中之一。',
  },

  {
    id: 'lord_souls_nito',
    name_en: 'The First of the Dead',
    name_zh: '最初的死者',
    theme_en: 'Death and Darkness',
    theme_zh: '死亡与黑暗',
    items: [
      {
        id: '2500',
        name_en: "Gravelord Nito's Soul",
        name_zh: '墓王尼特的灵魂',
        description_en: "Soul of Gravelord Nito, who found one of the first of the great souls.\n\nNito, who rules over all death, offered most of his power to death itself. Yet even so, his soul remains enormous, enough to fill the Lordvessel.",
        description_zh: '"最初的死者"墓王尼特的灵魂。此乃在火的时代，最初找到的王的灵魂之一。\n\n掌管着一切生死的墓王尼特，几乎将所有的力量都献给了死亡。但即便如此，其灵魂依然十分庞大，足以用来装满王器。',
        hint_en: 'Nito lurks in the Tomb of Giants, deep below the Catacombs. Bring a light source - the darkness there is absolute.',
        hint_zh: '尼特潜伏在巨人墓地，在墓地的深处。带上光源——那里的黑暗是绝对的。',
        requiredItemIds: [],
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Patches',
        npcName_zh: '帕奇',
        dialogue_en: "Well, well! A fellow undead! ... You're heading to the Tomb of Giants? Nito is down there, you know. The First of the Dead. He's powerful, and the darkness is absolute. Bring a light, or you'll be eaten alive.",
        dialogue_zh: '嗯，嗯！一个不死人同僚！......你要去巨人墓地？尼特就在下面，你知道的。最初的死者。他很强大，黑暗是绝对的。带上光源，否则你会被活活吃掉。',
        location_en: 'Catacombs',
        location_zh: '墓地',
      },
      {
        npcName_en: 'Vamos',
        npcName_zh: '巴摩斯',
        dialogue_en: "If you have that amazing ember I saw in New Londo, that's a different story. But it's long since sunk into the water. But if you have the legendary Witch's flame, that's different. But no one has ever reached the ruins of Izalith.",
        dialogue_zh: '如果有我在小隆德看过的那个棒透了的余烬，就另当别论了。但那里早已沉没于水中。但是如果有传说中的魔女火焰，那就另当别论了。可是从来没有人到过废都伊札里斯。',
        location_en: 'Catacombs',
        location_zh: '墓地',
      },
      {
        npcName_en: 'Vince of Thorolund',
        npcName_zh: '文斯',
        dialogue_en: "Going to a place like the Catacombs is not a pleasant thing.",
        dialogue_zh: '到地下墓地那种地方，并不是什么令人愉快的事。',
        location_en: 'Catacombs',
        location_zh: '墓地',
      },
      {
        npcName_en: 'Reah of Thorolund',
        npcName_zh: '蕾雅',
        dialogue_en: "Ahead are two terrifying Hollows. They were both skilled knights, once my attendants.",
        dialogue_zh: '在这前面有两个恐怖的游魂。他们全是身手不凡的骑士，过去是我的随侍。',
        location_en: 'Catacombs',
        location_zh: '墓地',
      },
    ],
    nextArea: AreaId.Catacombs,
    prerequisities: [GamePhase.ObtainedLordvessel],
    alternativeBosses: ['nito'],
    recommendation_en: 'Descend into the Catacombs and find Nito in the Tomb of Giants. He guards one of the four Lord Souls. Talk to Patches for warnings.',
    recommendation_zh: '深入墓地，在巨人墓地找到尼特。他守护着四个薪王灵魂之一。与帕奇交谈获取警告。',
    reason_en: 'You have the Lordvessel. You must collect the souls of the four great lords. Gravelord Nito is one of them.',
    reason_zh: '你已经获得了王器。你必须收集四位伟大薪王的灵魂。墓王尼特是其中之一。',
  },

  {
    id: 'lord_souls_four_kings',
    name_en: 'The Abyss',
    name_zh: '深渊',
    theme_en: 'Darkness and Humanity',
    theme_zh: '黑暗与人性',
    items: [
      {
        id: '2502',
        name_en: "Four Kings' Soul",
        name_zh: '小隆德四王的灵魂',
        description_en: "Soul of the Four Kings of New Londo, who fell to darkness.\n\nThese four were once the great leaders of New Londo, and thus were granted an audience with Lord Gwyn, receiving portions of his powerful soul.\n\nThough it is only a part of a soul, it is nonetheless powerful enough to fill the Lordvessel.",
        description_zh: '堕入黑暗的小隆德四王的灵魂。此乃在火的时代，最初找到的部分王的灵魂。\n\n过去，这四人乃是小隆德一地的伟大领袖，因此得以谒见葛温王，被授与王公地位，分得葛温王的伟大灵魂。\n\n虽然这只是部分灵魂，但仍足以用来装满王器。',
        hint_en: 'The Four Kings rule the Abyss below New Londo. You must have the Covenant of Artorias ring to survive there.',
        hint_zh: '四王统治着小隆德下方的深渊。你必须拥有亚尔特留斯的契约戒指才能在那里生存。',
        requiredItemIds: ['1112'], // 亚尔特留斯的契约戒指
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Ingward',
        npcName_zh: '英果德',
        dialogue_en: "I am Ingward, keeper of the seal. ... The Four Kings fell to the Abyss. They were seduced by the power of humanity. To enter the Abyss, you must have the Covenant of Artorias ring. Defeat Great Grey Wolf Sif to obtain it.",
        dialogue_zh: '我是英果德，封印的守护者。......四王堕入了深渊。他们被人性的力量所诱惑。要进入深渊，你必须拥有亚尔特留斯的契约戒指。击败大狼希夫来获得它。',
        location_en: 'New Londo Ruins',
        location_zh: '小隆德遗迹',
      },
      {
        npcName_en: 'Ingward',
        npcName_zh: '英果德',
        dialogue_en: "You must have been cursed to death, haven't you? You've suffered a lot. But you can rest easy now. I can handle the small matter of lifting your curse. However, curse-breaking is originally a divine art. You must be prepared to make a corresponding sacrifice.",
        dialogue_zh: '你应该是遭到咒死的吧？吃了不少苦吧？不过，你可以放心了。解除你的诅咒这点事，我还办得到。不过，解咒原本是神的技艺，你得做好付出相对牺牲的觉悟。',
        location_en: 'New Londo Ruins',
        location_zh: '小隆德遗迹',
      },
      {
        npcName_en: 'Ingward',
        npcName_zh: '英果德',
        dialogue_en: "The seal key is on me. But before I give it to you, could you help me with something? On the roof nests a Drain comple who serves the Four Kings of New Londo. Could you defeat that creature for me? The Four Kings dwell in the deepest part of these ruins. Just use this key to break the seal... open the water gate and move forward. Those creatures live in the darkness called the Abyss, a place ordinary people cannot go. They say that long ago, a knight named Artorias entered the Abyss. If you find him and use his power, you might be able to enter the Abyss successfully. The Drain comple are enemies of humans and all souls-bearing creatures. They were born in New Londo, and sealing them caused this place's destruction.",
        dialogue_zh: '封印钥匙是在我的身上。不过在交给你之前，可以麻烦你帮我完成一件事吗？在屋顶上栖息着一只小隆德四王手下的吸魂鬼。可以麻烦你帮我打倒那家伙吗？小隆德四王便待在这座遗迹的最深处。你只要用这把钥匙解开封印……打开水门并向前走就可以了。那群家伙居住在叫作深渊的黑暗中，那是个寻常人所无法前往的场所。据说在很久以前，有个骑士亚尔特留斯曾走进深渊。如果找到他并借助他的力量，说不定就能成功地进入深渊。吸魂鬼是人和所有具灵魂生物的敌人。那群家伙就是生自小隆德，光是为了封印他们便导致了此地毁灭。',
        location_en: 'New Londo Ruins',
        location_zh: '小隆德遗迹',
      },
      {
        npcName_en: 'Kaathe',
        npcName_zh: '卡斯',
        dialogue_en: "Undead hero, welcome. I am Kaathe, the serpent who soothes the darkness. I can guide you Undead and tell you the truth. Do you want to know the truth about humans and the Undead? You must first prove yourself worthy of my revelation. Go to Anor Londo and obtain Lord Gwyn's relic - the Lordvessel. I will open the gates of Sen's Fortress. That is the only path to Anor Londo. Your human ancestors, after receiving the Dark Soul, have been waiting for the fire to go out. Someday the fire will go out, and all that will remain in the world is darkness. This will usher in the Age of Dark for you humans. Lord Gwyn greatly feared the darkness... He constantly linked the fire, ordered his children to rule and bind humans, making you humans forget everything and live in confusion, preventing the Birth of the Dark Lord. You must slay Lord Gwyn, who has been linking the fire against nature and is now on the verge of collapse, and become the fourth king to bring about the Age of Dark. You must collect the souls of Gravelord Nito, the Witch of Izalith, and that traitor - Seath the Scaleless, and offer them to the Lordvessel. Don't delay, step forward and slay the Lord Gwyn who is on the verge of collapse. True darkness will then spread across the entire world.",
        dialogue_zh: '不死人勇者呀，欢迎你的到来，我乃世界之蛇，平抚黑暗的卡斯。我将能引导你们这群不死人，告知你事实的真相。想知道你们人类与不死人的真相吗？你得要先证明自己值得我透露真相才行。动身前往亚诺尔隆德，并在那取得葛温的遗物——王器吧。我将打开赛恩古城的大门，那是前往亚诺尔隆德的必经之道。你们人类祖先得到黑暗灵魂后，便一直等着火熄灭。总有一天火会熄灭，世上所剩的将尽是黑暗。这么一来，便会进入你们人类的黑暗时代了。葛温大王却深深畏惧黑暗……他不断传火，命自己的孩子统率、束缚人，让你们人类忘记一切，浑噩过活，避免黑暗之王诞生。你得除掉违背天理传火、已摇摇欲坠的葛温大王，并成为第四位王，让黑暗的时代降临。你得搜集墓王尼特、伊札里斯魔女，还有那个背叛者——白龙希斯，这些人的灵魂，献到王器中。事不宜迟，赶紧迈步向前，除去那已摇摇欲坠的葛温吧。真正的黑暗便将遍布整个世界。',
        location_en: 'The Abyss',
        location_zh: '深渊',
      },
    ],
    nextArea: AreaId.NewLondoRuins,
    prerequisities: [GamePhase.ObtainedLordvessel],
    alternativeBosses: ['fourKings'],
    recommendation_en: "Descend into New Londo Ruins and enter the Abyss. The Four Kings await. But first, you need the Covenant of Artorias ring - defeat Great Grey Wolf Sif. Talk to Ingward for guidance.",
    recommendation_zh: '深入小隆德遗迹，进入深渊。四王在等待着你。但首先，你需要亚尔特留斯的契约戒指——击败大狼希夫。与英果德交谈获取指引。',
    reason_en: 'You have the Lordvessel. You must collect the souls of the four great lords. The Four Kings are one of them.',
    reason_zh: '你已经获得了王器。你必须收集四位伟大薪王的灵魂。四王是其中之一。',
  },

  {
    id: 'lord_souls_bed_of_chaos',
    name_en: 'The Bed of Chaos',
    name_zh: '混沌温床',
    theme_en: 'Chaos and Creation',
    theme_zh: '混沌与创造',
    items: [
      {
        id: '2501',
        name_en: "Bed of Chaos's Soul",
        name_zh: '混沌温床的灵魂',
        description_en: "Soul of the Bed of Chaos, mother of all demons.\n\nThe Witch of Izalith attempted to create a new First Flame from soul, but instead birthed the twisted Chaos Flame and its monstrous children. This power, which became the womb of all demons, is enough to fill the Lordvessel.",
        description_zh: '"恶魔之母"混沌温床的灵魂。此乃在火的时代，最初找到的王的灵魂之一。\n\n魔女试图从灵魂创造出"初始之火，"却因此生出了扭曲的混沌火焰巨兽。化为一切恶魔温床的这股力量，足以用来装满王器。',
        hint_en: 'The Bed of Chaos lies deep within Lost Izalith, beneath the Demon Ruins. The path is treacherous, filled with lava and demons.',
        hint_zh: '混沌温床位于失落的伊扎里斯深处，在恶魔废墟之下。道路险恶，充满岩浆和恶魔。',
        requiredItemIds: [],
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Quelana of Izalith',
        npcName_zh: '伊扎里斯的克拉娜',
        dialogue_en: "I am Quelana of Izalith. ... The Bed of Chaos is what remains of my mother, the Witch of Izalith. She tried to create a new First Flame, but it went horribly wrong. Now she is trapped in that twisted form. Please, end her suffering.",
        dialogue_zh: '我是伊扎里斯的克拉娜。......混沌温床是我母亲，伊扎里斯魔女的残余。她试图创造新的初始之火，但出了可怕的错误。现在她被困在那个扭曲的形态中。请结束她的痛苦。',
        location_en: 'Demon Ruins',
        location_zh: '恶魔废墟',
      },
    ],
    nextArea: AreaId.DemonRuins,
    prerequisities: [GamePhase.ObtainedLordvessel],
    alternativeBosses: ['BedOfChaos'],
    recommendation_en: "Descend into the Demon Ruins and find the Bed of Chaos in Lost Izalith. It guards one of the four Lord Souls. Talk to Quelana for guidance.",
    recommendation_zh: '深入恶魔废墟，在失落的伊扎里斯找到混沌温床。它守护着四个薪王灵魂之一。与克拉娜交谈获取指引。',
    reason_en: 'You have the Lordvessel. You must collect the souls of the four great lords. The Bed of Chaos is one of them.',
    reason_zh: '你已经获得了王器。你必须收集四位伟大薪王的灵魂。混沌温床是其中之一。',
  },

  // ==================== 可选Boss：大狼希夫 ====================
  {
    id: 'great_grey_wolf_sif',
    name_en: 'The Great Grey Wolf Sif',
    name_zh: '大狼希夫',
    theme_en: 'Loyalty and Sacrifice',
    theme_zh: '忠诚与牺牲',
    items: [
      {
        id: '1112',
        name_en: 'Covenant of Artorias',
        name_zh: '亚尔特留斯的契约戒指',
        description_en: "Ring of the Knight Artorias.\n\nThis ring was given to Artorias, who challenged the Abyss. It grants protection against the dark of the Abyss, and is essential for venturing into that realm.",
        description_zh: '骑士亚尔特留斯的戒指。\n\n这枚戒指赐予了挑战深渊的亚尔特留斯。它能保护佩戴者免受深渊黑暗的侵害，是进入那个领域的必备之物。',
        hint_en: 'This ring is essential for surviving the Abyss. Defeat Great Grey Wolf Sif to obtain it.',
        hint_zh: '这枚戒指是在深渊中生存的必备之物。击败大狼希夫来获得它。',
        requiredItemIds: [],
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Alvina',
        npcName_zh: '雅薇娜',
        dialogue_en: "I am Alvina, of the Darkroot Wood. ... Sif, the great grey wolf, guards the grave of Knight Artorias. He will not let you pass easily. But you need the Covenant of Artorias ring to enter the Abyss. Defeat Sif, and the ring is yours.",
        dialogue_zh: '我是雅薇娜，来自黑森林庭院。......大狼希夫守护着骑士亚尔特留斯的坟墓。他不会轻易让你通过。但你需要亚尔特留斯的契约戒指才能进入深渊。击败希夫，戒指就是你的了。',
        location_en: 'Darkroot Garden',
        location_zh: '黑森林庭院',
      },
    ],
    nextArea: AreaId.DarkrootGarden,
    prerequisities: [GamePhase.ObtainedLordvessel],
    alternativeBosses: ['sif'],
    recommendation_en: 'Seek out Great Grey Wolf Sif in Darkroot Garden. He guards the Covenant of Artorias ring, which is essential for entering the Abyss. Talk to Alvina for guidance.',
    recommendation_zh: '前往黑森林庭院寻找大狼希夫。他守护着亚尔特留斯的契约戒指，这是进入深渊的必备之物。与雅薇娜交谈获取指引。',
    reason_en: 'You need the Covenant of Artorias ring to enter the Abyss and fight the Four Kings. Sif guards this ring.',
    reason_zh: '你需要亚尔特留斯的契约戒指才能进入深渊并与四王战斗。希夫守护着这枚戒指。',
  },

  // ==================== DLC区域 ====================
  {
    id: 'oolacile',
    name_en: 'The Lost City of Oolacile',
    name_zh: '失落的乌拉席露',
    theme_en: 'Ancient Knowledge and Darkness',
    theme_zh: '古老知识与黑暗',
    items: [
      {
        id: '222',
        name_en: 'Broken Pendant',
        name_zh: '破碎的坠落之环',
        description_en: 'Half of a broken pendant.\n\nThe other half can be found in the present. When both halves are reunited, the voice of the ancient capital of Oolacile can be heard.',
        description_zh: '破碎坠落之环的一半。\n\n另一半可以在现在找到。当两半重聚时，就能听到古代乌拉席露首都的声音。',
        hint_en: 'This pendant is the key to Oolacile. Find the other half in the present to unlock the past.',
        hint_zh: '这个坠落之环是通往乌拉席露的钥匙。在现在找到另一半来解锁过去。',
        requiredItemIds: [],
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Dusk of Oolacile',
        npcName_zh: '乌拉席露的黄昏',
        dialogue_en: "Thank you for rescuing me. I am Dusk of Oolacile. ... Oolacile was a city of ancient magic, where sorceries were born. But it was destroyed by the Abyss. If you wish to learn more, find the Broken Pendant.",
        dialogue_zh: '谢谢你救了我。我是乌拉席露的黄昏。......乌拉席露是一座古老的魔法之城，那里是魔法的起源。但它被深渊摧毁了。如果你想了解更多，找到破碎的坠落之环。',
        location_en: 'Darkroot Basin',
        location_zh: '夹缝森林',
      },
      {
        npcName_en: 'Marvelous Chester',
        npcName_zh: '切斯特',
        dialogue_en: "Caught by a black hand, brought to the past... In this unfamiliar age, there will be inconveniences. Let's help each other. Did you encounter Knight Artorias? The legendary hero who hunted the Abyss in the original age. You defeated Knight Artorias? Though he was corrupted by the Abyss, to defeat that hero... The Abyss business was Oolacile's own fault. Deceived by that fanged serpent into digging up graves, defiling the remains of ancestors - truly shameless and foolish behavior. You could just stand by, couldn't you? Be careful on your journey...",
        dialogue_zh: '被黑色大手抓住，来到了过去……在这不熟悉的时代，多少会有不便，就让我们彼此互助吧。你碰上骑士亚尔特留斯了吗？就是原本时代里，那个传说中狩猎深渊的英雄啊。你打倒那个骑士亚尔特留斯啦？虽说被深渊给侵蚀，不过竟然能打倒那位英雄……深渊那档子事情，本来就是乌拉席露自作自受。被那匹暴牙大蛇骗去挖坟，侮辱先人遗骸——简直就是不要脸的愚蠢行为。你大可以袖手旁观，不是吗？旅行一路上，记得小心一点啊……',
        location_en: 'Oolacile',
        location_zh: '乌拉席露',
      },
      {
        npcName_en: "Lord's Blade Ciaran",
        npcName_zh: '基亚蓝',
        dialogue_en: "Why do you have Artorias's ring...? Why do you have Artorias's soul...? That was taken from me by the man in the greatcoat. Artorias wouldn't approve of such underhanded dealings.",
        dialogue_zh: '为什么你会拥有亚尔特留斯的戒指……？为什么你会拥有亚尔特留斯的魂魄……？那是我被身穿大衣的男子偷走的东西。亚尔特留斯也不愿看到强买强卖。',
        location_en: 'Oolacile',
        location_zh: '乌拉席露',
      },
      {
        npcName_en: 'Dusk of Oolacile',
        npcName_zh: '幽暗',
        dialogue_en: "My homeland is the ancient magic land of Oolacile. Those magical knowledge, I think it might be able to help you, my benefactor. If you need it, please summon me at the sign. Oolacile's magic and this age's magic seem different. Oolacile's magic is more approachable... while your age's magic looks more serious and persistent, giving a cold, distant feeling. That famous knight Artorias saved me.",
        dialogue_zh: '我的故乡是古老魔法之地——乌拉席露。那些魔法知识，我想说不定可以帮助恩人您……如果有需要，请到记号处召唤我。乌拉席露的魔法和这个时代的魔法似乎有些不同。乌拉席露的魔法比较平易近人……而您这个时代的魔法看起来比较认真坚持，给人拒人千里于外的感觉。那位有名的骑士亚尔特留斯大人救了我。',
        location_en: 'Oolacile',
        location_zh: '乌拉席露',
      },
      {
        npcName_en: 'Elizabeth',
        npcName_zh: '伊丽莎白',
        dialogue_en: "Going further, you will probably understand: Oolacile is gradually being swallowed by the Abyss brewed by the ancient humanoid monsters. Knight Artorias went to stop it, but even a hero cannot resist the darkness. Eventually he will be swallowed by the Abyss and corrupted by the dark. Perhaps stopping the Abyss is already impossible, but I still hope to turn the tide, at least to save the Princess of the Darkling. He is different from you, very evil... Perhaps he's still in this age, the man in the black coat and black hat. Please be very careful...",
        dialogue_zh: '再往前走，你大概也会了解：乌拉席露正逐渐被古代人形怪物酝酿的深渊所吞噬。骑士亚尔特留斯前往阻止，但英雄仍难抵抗黑暗，早晚还是会被深渊吞噬、被黑暗侵蚀吧。也许要阻止深渊已经是不可能的事情，但我还是希望能力挽狂澜，至少救出幽暗公主也好。他和你不一样，非常邪恶……或许他还停留在这个时代，是穿着黑色大衣、戴黑色帽子的男子，请千万小心……',
        location_en: 'Oolacile',
        location_zh: '乌拉席露',
      },
      {
        npcName_en: ' Hawkeye Gough',
        npcName_zh: '戈夫',
        dialogue_en: "That creature is called Kalameet, a terrifying black dragon that even the old Anor Londo deliberately ignored. For a mere human to challenge it... is too arrogant. You've done a favor for Artorias, so let me show you how I, Gough, hunt dragons. See that? Hit right on target. No matter how strong that creature is, it can't fly for now. The rest depends on your skill. Challenging a dragon is a knight's honor. The darkness that corrupted my friend Artorias is now about to swallow this entire nation of Oolacile... It seems destruction cannot be avoided. If you want to stop this darkness like my friend, go and slay Manus, Father of the Abyss. The darkness is born from Manus, and this nation's destruction might prevent an even greater catastrophe. Light will disappear, leaving only darkness. Even heroes cannot prevent it. If you want to wander around here, beware of that black dragon. Even you can't handle it. You once defeated Artorias, so be careful of a woman named Ciaran. She likely harbors special feelings for Artorias. Since there are no more dragons, this is useless to me. I don't know if a human can draw this bow... I'll give it to you.",
        dialogue_zh: '那家伙叫做喀拉弥特，连昔日的亚诺尔隆德都故意视而不见的恐怖黑龙。你一介人类想要前往挑战……也太不自量力了。你对亚尔特留斯又有恩，就让你看看，我戈夫怎么猎龙吧。看到没，打个正着。那家伙再强，暂时是飞不起来了。剩下就要看你的功夫如何了。向龙挑战是骑士的荣耀。那侵蚀了吾友亚尔特留斯的深渊黑暗，现在正要吞噬这乌拉席露整个国度……看来，灭亡已难以避免。你若要像吾友一般，想要阻止这股黑暗，就去讨伐深渊之主，马努斯吧。黑暗由马努斯而生，这个国家的灭亡，或许可以避免更大的覆灭局面。光明将会消失，仅仅留下黑暗，就算是英雄也不能够阻止。如果想在这附近晃荡，当心那头黑龙。那家伙就算是你也是吃不消。你曾经打败过亚尔特留斯，那么你要当心一位名叫基亚蓝的女子。那女子很可能对亚尔特留斯怀抱着特别的情感。既已无龙，对我来说的确是无用之物。虽不敢说人类之身能否拉开此弓……我就把它交给你了。',
        location_en: 'Oolacile',
        location_zh: '乌拉席露',
      },
    ],
    nextArea: AreaId.Oolacile,
    prerequisities: [GamePhase.ObtainedLordvessel],
    recommendation_en: 'If you have the Broken Pendant, you can enter the lost city of Oolacile through the dark portal in Darkroot Basin. Talk to Dusk for guidance.',
    recommendation_zh: '如果你有破碎的坠落之环，你可以通过夹缝森林的黑暗传送门进入失落的乌拉席露城。与黄昏交谈获取指引。',
    reason_en: 'Oolacile contains powerful weapons and the story of Knight Artorias. It is a challenging but rewarding detour.',
    reason_zh: '乌拉席露拥有强大的武器和骑士亚尔特留斯的故事。这是一条充满挑战但值得的支线。',
  },

  // ==================== 最终决战 ====================
  {
    id: 'final_battle',
    name_en: 'The Final Battle',
    name_zh: '最终决战',
    theme_en: 'Sacrifice and Choice',
    theme_zh: '牺牲与选择',
    items: [
      {
        id: '702',
        name_en: "Gwyn, Lord of Cinder's Soul",
        name_zh: '乌薪王葛温的灵魂',
        description_en: "Soul of Gwyn, the Lord of Sunlight and Lord of Cinder.\n\nThough he had already distributed most of his power to the gods, and had burned himself as fuel for the First Flame, even so, the Great Lord's soul still contains extraordinary power.",
        description_zh: '伟大的阳光之王，以及承继初始之火的乌薪王──葛温的灵魂。\n\n虽然他已将大多数的力量分给诸神，又化为初始之火的薪材，燃烧成灰，但即使如此，大王的灵魂依然隐藏着非比寻常的力量。',
        hint_en: 'Gwyn awaits you in the Kiln of the First Flame. He is the final obstacle before the choice that will determine the fate of the world.',
        hint_zh: '葛温在初火之炉中等待着你。他是决定世界命运的选择之前的最后障碍。',
        requiredItemIds: [],
      },
    ],
    npcDialogues: [
      {
        npcName_en: 'Frampt',
        npcName_zh: '芙拉姆特',
        dialogue_en: "You have done well. You have collected the souls of the four great lords. Now, place them in the Lordvessel, and the path to the Kiln of the First Flame will open. There, Gwyn, the Lord of Cinder, awaits. You must succeed him, or the Age of Fire will end.",
        dialogue_zh: '你做得很好。你已经收集了四位伟大薪王的灵魂。现在，将它们放入王器，通往初火之炉的道路就会打开。在那里，薪王葛温在等待着你。你必须继承他，否则火焰时代将会结束。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
      {
        npcName_en: 'Frampt',
        npcName_zh: '芙拉姆特',
        dialogue_en: "The Lordvessel is finally filled with souls... You are truly the successor to Lord Gwyn, the new Great Lord... My duty as the one who seeks kings is now at an end... I am truly happy to have met you, for I do love humans after all...",
        dialogue_zh: '王器终于装满了灵魂......你无疑是葛温的后继者，也就是新的大王了......寻找王者的职责也要在此告一段落了......能够遇到你这小子还真令我开心呢，我终究是很喜欢人的呀。',
        location_en: 'Firelink Shrine',
        location_zh: '传火祭祀场',
      },
    ],
    nextArea: AreaId.KilnOfTheFirstFlame,
    prerequisities: [GamePhase.AllLordSouls, GamePhase.ReadyForKiln],
    recommendation_en: 'All four Lord Souls have been collected. The path to the Kiln of the First Flame is now open. Gwyn, the Lord of Cinder, awaits you there. This is the final battle - choose your fate wisely.',
    recommendation_zh: '四位薪王的灵魂已经全部收集完毕。通往初火之炉的道路现在打开了。薪王葛温在那里等待着你。这是最终之战——明智地选择你的命运。',
    reason_en: 'All Lord Souls have been offered. The final battle approaches. Your decision will shape the fate of the world - whether to link the fire and延续 the Age of Fire, or let it fade and usher in the Age of Dark.',
    reason_zh: '所有薪王的灵魂已经献上。最终之战即将来临。你的决定将塑造世界的命运——是传承火焰延续火焰时代，还是让其熄灭迎来黑暗时代。',
  },
];

// 根据阶段获取推荐故事线
export function getStorylineForPhase(phase: GamePhase, bossesDefeated?: PlayerProgress['bossesDefeated']): Storyline | null {
  // 如果是SeekingLordSouls阶段，需要根据未击败的薪王BOSS来选择故事线
  if (phase === GamePhase.SeekingLordSouls && bossesDefeated) {
    // 按推荐顺序选择未击败的薪王BOSS
    const lordSoulsBosses = [
      { id: 'seath', storylineId: 'lord_souls_seath' },
      { id: 'nito', storylineId: 'lord_souls_nito' },
      { id: 'fourKings', storylineId: 'lord_souls_four_kings' },
      { id: 'BedOfChaos', storylineId: 'lord_souls_bed_of_chaos' },
    ];

    // 找到第一个未击败的薪王BOSS
    for (const boss of lordSoulsBosses) {
      if (!bossesDefeated[boss.id as keyof typeof bossesDefeated]) {
        const storyline = STORYLINES.find(s => s.id === boss.storylineId);
        if (storyline) return storyline;
      }
    }
  }

  // 直接查找匹配当前阶段的故事线
  const storyline = STORYLINES.find(s => s.prerequisities.includes(phase));
  if (storyline) return storyline;

  // 如果没有找到，按优先级向后查找
  const priorityOrder: GamePhase[] = [
    GamePhase.Start,
    GamePhase.ReturnToAsylum,
    GamePhase.UndeadBurg,
    GamePhase.UndeadParish,
    GamePhase.AfterBell1,
    GamePhase.Depths,
    GamePhase.Blighttown,
    GamePhase.AfterBell2,
    GamePhase.SensFortress,
    GamePhase.AnorLondo,
    GamePhase.AfterOrnsteinSmough,
    GamePhase.ObtainedLordvessel,
    GamePhase.SeekingLordSouls,
    GamePhase.AllLordSouls,
    GamePhase.ReadyForKiln,
    GamePhase.GameComplete,
  ];

  // 找到当前阶段的索引
  const currentIndex = priorityOrder.indexOf(phase);

  // 从当前阶段的下一个开始，向后查找匹配的故事线
  for (let i = currentIndex + 1; i < priorityOrder.length; i++) {
    const nextStoryline = STORYLINES.find(s => s.prerequisities.includes(priorityOrder[i]));
    if (nextStoryline) return nextStoryline;
  }

  return null;
}

// 根据区域获取相关故事线
export function getStorylineForArea(area: AreaId): Storyline | null {
  return STORYLINES.find(s => s.nextArea === area) || null;
}

// 根据未击败的Boss获取推荐故事线
export function getStorylineForBoss(bossId: string): Storyline | null {
  return STORYLINES.find(s => s.alternativeBosses?.includes(bossId)) || null;
}
