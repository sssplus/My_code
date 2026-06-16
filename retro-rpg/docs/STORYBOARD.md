# Chronicles of the Shattered Realm — STORYBOARD GUIDE

> The complete storyline, broken into a storyboard: acts → cutscenes → major
> quests → subquests → side quests. Every entry is grounded in the **actual
> game data** (zones, bosses, NPCs, romance leads, flags) so this doc doubles
> as a build spec. IDs in `code font` already exist in `js/data.js`; IDs marked
> 🔨 are to-build.

---

## 0. How to read this storyboard

**Panel notation** (for cutscenes — same grammar as the in-game `SCREENPLAY` module):

```
CS-##  ⟨CUTSCENE ID⟩                                    [trigger flag]
  SLUG:   INT./EXT. LOCATION — TIME
  SHOT 1: <what the camera/stage shows>
  BEAT:   SPEAKER (emotion) "line"
  FORK:   [A] choice → consequence   [B] choice → consequence
  OUT:    → next board / state / flag set
```

**Quest tiers**
- **MQ** Major Quest — the spine; gates act progression. Always shown on the HUD.
- **SQ** Subquest — required *threads inside* a major quest (a dungeon, an alliance, a romance gate).
- **side** Side Quest — optional; rewards XP / gold / **progression-layer unlocks** (Ancient Sites, mentors, codex targets, bloodstones).

**Cross-system tags** — `[POL]` political/War Council · `[MIL]` army/siege · `[DUN]` dungeon ·
`[ROM]` romance · `[COR]` corruption · `[PWR]` progression-layer reward · `[LORE]` Ancient Site / Forgotten Library.

**State already in code:** zones `ironhold, moonsong, aurum, ashenkeep, dune_throne,
ashwood_dungeon, bogmire_dungeon, spice_dungeon, world`; bosses `iron_warlord,
bog_horror, tomb_sentinel, void_knight, malachar`; key item `heartstone_fragment`
(×5 = the **World Anchors**); path flags `path_tyrant / path_diplomat / path_blood /
path_scavenger / path_fugitive / corruption_active / awakened_crisis`.

---

## 1. The Spine (one paragraph, three endings)

Three hundred years ago the entropy-entity **Malachar** was sealed under **the Citadel**
with five **World Anchors**, one per founding bloodline of the Five Kingdoms. The lords
grew complacent, fought petty wars, and the seal is failing — **Void Cracks** now bleed
across the world. The player must gather power and reach the breaking seal by one of
three roads:

| Ending | Verb | Spine condition (flags) | Final board |
|---|---|---|---|
| **The Conqueror** | FORCE | subjugate ≥3 kingdoms, seize their Anchors `path_tyrant` + `anchors_taken≥4` | CS-90A |
| **The Diplomat** | UNITE | ally ≥3 kingdoms, unite vs the Void `path_diplomat` + `alliances≥3` | CS-90B |
| **The Corrupted** | EMBRACE | `corruption ≥ 80`, absorb the Void, replace Malachar | CS-90C |

The three roads share Acts 0–II and **diverge in Act III**.

---

## 2. ACT 0 — ORIGIN PROLOGUES  *(playable cutscenes — already built)*

Each origin opens on a bespoke branching screenplay (the `SCREENPLAY` module). These
are the storyboard's cold opens; the fork **stamps the player's starting path flag**.

| Board | Origin | Title / Slug | Built cutscene | Fork → flag |
|---|---|---|---|---|
| **CS-00P** | Prince | "The Muddy Crown" — *INT. COMMAND TENT — NIGHT* | ✅ `SCREENPLAY.prince` | Tyrant/Diplomat/Vanguard/Blood → `path_*` |
| **CS-00C** | Commoner | "The Penal Legion" — *INT. ANCIENT MINE — PITCH BLACK* | ✅ `SCREENPLAY.commoner` | Soldier/Protector/Scavenger/Ruthless |
| **CS-00M** | Mage | "The Shattered Ritual" — *INT. CITADEL SANCTUM* | ✅ `SCREENPLAY.mage_clan` | Flee/Channel/Surrender → `corruption` seed |
| **CS-00R** | Priest | "The Shattered Ritual (Chapel)" | ✅ `SCREENPLAY.priest` | Flee/Smite/Confess |
| **CS-00S** | Sword Clan | "The Wrong Horn" — *EXT. HIGHLAND CLIFFS* | ✅ `SCREENPLAY.sword_clan` | Charge/Hold |
| **CS-00N** | Noble | "The Poisoned Chalice" — *INT. ASHENKEEP LOW HALL* | ✅ `SCREENPLAY.noble` | Expose/Strike/Drink |

**OUT of Act 0** → all origins land in the overworld near their home kingdom with
`main_quest_1` active. The opening fork's flag colours every later political/romance beat.

---

## 3. ACT I — "THE FIRST SHARD"  *(convergence + tutorialised core loop)*

**Spine MQ.** Whatever the origin, a Void Crack in the **Ashwood Ruins** is the first
thread everyone pulls. Act I teaches: overworld travel, a dungeon, a boss, and the
origin-specific meta-layer (War Council for Prince/Noble; rank for Commoner; corruption
for Mage/Priest).

### `main_quest_1` — **MQ-1 "Shadow in the Ashwood"**  *(exists)*
- **Trigger:** start of game. **Zone:** `world` → `ashwood_dungeon`.
- **Objectives (in code):** `reach_dungeon` → `defeat_warlord` → `claim_shard`.
- **Reward:** 500 XP, 200g, `heartstone_fragment` #1. **Next:** `main_quest_2`.
- **Boss:** `iron_warlord` (3-phase). **Cutscenes:** CS-10, CS-12, CS-14.

**Storyboard panels**

```
CS-10  THE CRACK IN THE WOOD                              [enter ashwood region]
  EXT. ASHWOOD — DUSK.  A vertical scar of violet light splits an old oak.
  Corrupted wildlife (highland_wolf, bandit) circle a collapsed barrow.
  BEAT: NARRATION "The seal does not break all at once. It weeps first."
  OUT → MQ-1.reach_dungeon

CS-12  THE IRON WARLORD                                   [boss intro, ashwood_dungeon]
  INT. ASHWOOD RUINS — THE FORGE FLOOR.
  A dead warlord, reanimated by Void essence, rises in rusted plate.
  BEAT: IRON WARLORD (grave) "You came for the stone. Everyone comes for the stone."
  OUT → COMBAT iron_warlord → MQ-1.defeat_warlord

CS-14  THE FIRST ANCHOR                                   [claim_shard]
  Close on a Heartstone Fragment pulsing in the warlord's chest cavity.
  Touching it floods a memory: the original Sealing, 300 years ago.
  BEAT: VOICE OF THE FIRST KING "Five hands. Five anchors. Never fewer."
  OUT → reward heartstone_fragment, start main_quest_2, flag act1_done
```

### Act I subquests (SQ)
| ID | Tier | Title | Tag | Hook | Reward |
|---|---|---|---|---|---|
| 🔨 `sq_warcamp` | SQ | **Hold the War Camp** *(Prince/Noble only)* | [POL] | Resolve the first War Council event before marching | `[POL]` unlock on-demand council |
| 🔨 `sq_first_blood` | SQ | **First Blood** *(Commoner)* | [MIL] | Win 3 skirmishes to earn rank **Soldier** | military rank +1 |
| 🔨 `sq_stabilise` | SQ | **Stabilise the Shard** *(Mage/Priest)* | [COR] | Find the Ashwood wellspring before corruption ticks to 20 | `[PWR]` Wellspring +3 stat |
| 🔨 `sq_clan_muster` | SQ | **The Muster** *(Sword Clan)* | [MIL] | Rally 2 clan captains for the dungeon assault | party buff |

### Act I side quests
| ID | Title | Tag | Where | Reward |
|---|---|---|---|---|
| 🔨 `side_innkeep` | **Rodric's Missing Cask** | — | `ironhold` (`innkeeper_dialog`) | gold, rumor → Ancient Site hint |
| 🔨 `side_wolfpack` | **Pack Leader** | [PWR] | `world` (Valdris wilds) | kill 8 `highland_wolf` → codex **Pack Instinct** |
| 🔨 `side_blade_tomb` | **The Blade Saint's Tomb** | [LORE] | hidden, Valdris | `[PWR]` forbidden sword technique (Sword Clan, Lv20) |

**ACT I → ACT II gate:** `act1_done` + own `heartstone_fragment` #1.

---

## 4. ACT II — "THE FIVE SHARDS"  *(the open-world body)*

**Spine MQ.** `main_quest_2` "The Five Shards" (exists). Four Anchors remain, each held by
a kingdom's bloodline. Act II is the **non-linear hub**: tackle the four kingdoms in any
order. Each kingdom is a self-contained arc with one **MQ chapter**, one **dungeon SQ
(boss + shard)**, one **political/military SQ**, and one **romance SQ**. This is where the
10 progression layers, the War Council, and the monogamy lock all live.

### `main_quest_2` — **MQ-2 "The Five Shards"**  *(exists)*
- **Objectives (in code):** `shards_2_3` (recover two more) → `alliance` (form ≥1) → `face_mal`.
- **Reward:** 5000 XP, 1000g. **Next:** Act III branch.

### The four kingdom arcs (do in any order)

#### 4.1 SYLVARA — *Moonsong, the Ancient Forest*  `[LORE][ROM]`
- **MQ-2a 🔨 "The Mist That Remembers"** — the elves hid Anchor #2 in a living tree.
- **Dungeon SQ 🔨 `sq_moonsong_grove`** `[DUN]`: the **Hollow Grove**; guardian fight
  (elite `forest_mage` pack → mini-boss). **Shard #2.**
- **Political SQ 🔨 `sq_sylvara_xeno`** `[POL]`: the xenophobic court won't open the grove
  until you pass three trials of proof.
- **Romance SQ — Aelindra Moonveil** `[ROM]` (`aelindra_intro` ✅): the 340-year-old
  archivist; her arc unlocks **the Moon Pool** `[LORE]` → *Language of Stars* (4th spell slot).

```
CS-20  THE ARCHIVIST                                      [meet aelindra]
  INT. MOONSONG SPIRE — THE STACKS.  Floating lanterns, dust like snow.
  AELINDRA (stern) "Mortals burn so fast. I have stopped learning their names."
  FORK: [warm] approval+ → [ROM] thread opens   [curt] → she remains an ally NPC
  OUT → side_moon_pool gated on approval ≥ 50
```

#### 4.2 DRAKMOOR — *Ashenkeep & the Bogmire*  `[POL][DUN]`
- **MQ-2b 🔨 "Shadow War"** — the scheming Houses each claim Anchor #3; it's sunk in the bog.
- **Dungeon SQ 🔨 `sq_bogmire`** `[DUN]`: **Bogmire** (`bogmire_dungeon`) → boss `bog_horror`
  (3-phase). **Shard #3.**
- **Political SQ 🔨 `sq_house_war`** `[POL]`: navigate `ashen_warden_dialog` / House intrigue;
  a War Council "Poisoned Chalice"-style decision picks which House backs you.
- **Romance SQ — Sable Nighthollow** `[ROM]` (`sable_reveal` ✅): the assassin hired to kill
  *you*; her reveal cutscene fires at approval ≥ 50 (already wired in `SYSTEMS.ROMANCE`).

```
CS-22  THE KNIFE THAT CHOSE                               [sable_reveal — exists]
  INT. ASHENKEEP — YOUR CHAMBER — NIGHT.  A blade at your throat, then lowered.
  SABLE (raw) "They paid me in advance. I'm returning the coin. Ask me why."
  OUT → [ROM] Sable; sets sable_reveal_seen (in code)
```

#### 4.3 VERANTHOS — *Dune Throne & the Spice Ruins*  `[POL][MIL][DUN]`
- **MQ-2c 🔨 "The Gilded Cage"** — the merchant-princes will *sell* Anchor #4… for an army,
  a marriage, or a war.
- **Dungeon SQ 🔨 `sq_spice_ruins`** `[DUN]`: **Spice Ruins** (`spice_dungeon`) → boss
  `tomb_sentinel` (3-phase). **Shard #4.**
- **Military SQ 🔨 `sq_dune_levy`** `[MIL]`: hire/repel a mercenary company (`calla_intro`).
- **Romance SQ — Calla Vane** `[ROM]` (`calla_intro` ✅), the mercenary captain.
- **Side `[POL]`:** `marriage_alliance` War Council card (exists) — Veranthos princess; **locks**
  other routes if accepted (monogamy).

#### 4.4 SOLHEIM / THE CITADEL — *Aurum Cathedral*  `[COR][LORE]`
- **MQ-2d 🔨 "The Last Light"** — the theocracy guards Anchor #5 *and* sits above Malachar's
  seal. Inquisitors hunt Void-touched player characters here.
- **Guardian SQ 🔨 `sq_aurum_vigil`** `[DUN]`: `void_knight` wardens in the under-cathedral.
  **Shard #5.**
- **Corruption SQ 🔨 `sq_cleanse_or_feed`** `[COR]`: the temple can **cleanse** corruption
  (costs favour/resources) — or you can feed a Void Crack beneath the altar to **raise** it.
  This is the major fork toward **The Corrupted** ending.

### Act II recurring subquests (origin meta-layer)
| ID | Tier | Title | Tag | Spans |
|---|---|---|---|---|
| 🔨 `sq_council_crises` | SQ | **The Council Never Sleeps** | [POL] | Prince/Noble: resolve War Council cards (`breach_defense`, `war_levy`, `harvest_failed`, `assassination_attempt`) |
| 🔨 `sq_rise_through_ranks` | SQ | **From the Ranks** | [MIL] | Commoner: rank Recruit→Marshal via battles; unlocks political access at Commander |
| 🔨 `sq_secret_lineage` | SQ | **Blood You Didn't Know** | [PWR] | Commoner "Secret Lineage" tree finale; ties to **Mira** romance |

### Act II side quests (the open-world reward layer — `[PWR]`/`[LORE]`)
| ID | Title | Requirement | Reward |
|---|---|---|---|
| 🔨 `side_moon_pool` | **The Moon Pool of Sylvara** | Aelindra ≥50 | 4th spell slot |
| 🔨 `side_ancestor_echo` | **Ancestor's Echo Chamber** | Noble/Prince bloodline | Blood Power tier-up |
| 🔨 `side_dragon_ossuary` | **The Dragon Ossuary** | clear an Iron Keep dungeon | +20 fire res, flame breath |
| 🔨 `side_void_crack` | **The Whispering Crack** | any | dark power **+ corruption** `[COR]` |
| 🔨 `side_forgotten_library` | **The Forgotten Library** | find 3 map fragments | passive not in any tree |
| 🔨 `side_wellsprings` | **Five Wellsprings** | hidden, 1 per kingdom | +3 to a stat each |
| 🔨 `side_blind_swordmaster` | **The Blind Swordmaster** | beat a dungeon boss | armour-ignoring technique (mentor) |

**ACT II → ACT III gate:** own **all 5** `heartstone_fragment` **OR** `corruption ≥ 80`
(the Corrupted skips the full set), **AND** `main_quest_2.face_mal` reached.

---

## 5. ACT III — "THE BREAKING SEAL"  *(the three-road divergence)*

**Spine MQ 🔨 `main_quest_3` "The Breaking Seal".** The Citadel above Malachar's tomb is
splitting. The road you've walked (flags) decides which finale unlocks. All three end at the
**Obsidian Citadel** but the approach, the army at your back, and the final fight differ.

### Branch A — **THE CONQUEROR**  `path_tyrant` + Anchors seized  `[MIL]`
- **MQ-3A 🔨 "Crown of Ash"** — the kingdoms you didn't ally, you **conquer**. Siege chain
  using the army layer; execute rival rulers, **take** their Anchors by force.
- **Subquests:** `sq_siege_each_holdout` `[MIL]` (one siege per unconquered kingdom);
  `sq_execute_or_spare` `[POL]` (each execution +power, −worldstate).
- **Final:** descend to renew the seal **alone**, by your own bloodline strength.

```
CS-90A  THE THRONE OF ONE                                 [conqueror finale]
  EXT. OBSIDIAN CITADEL — DAWN, banners of five kingdoms all bearing your sigil.
  BEAT: YOU (stern) "Five hands held the seal. One is enough, if the hand is strong."
  OUT → COMBAT malachar → seal renewed by force → epilogue_conqueror
```

### Branch B — **THE DIPLOMAT**  `path_diplomat` + alliances ≥3  `[POL]`
- **MQ-3B 🔨 "The Last Council"** — convene all surviving rulers; each demands a price
  (a War Council mega-event). Unite the Five to re-forge the seal **together**.
- **Subquests:** `sq_broker_peace` `[POL]` (settle two inter-kingdom feuds);
  `sq_combined_host` `[MIL]` (field a coalition army at the Citadel).
- **Final:** the five bloodlines renew the Anchors **as one**.

```
CS-90B  FIVE HANDS                                        [diplomat finale]
  INT. CITADEL — THE SEAL CHAMBER.  Five rulers, five Anchors, one circle.
  BEAT: AVIRA/ALLY "We hated each other for three hundred years. Tonight we don't."
  OUT → COMBAT malachar (with allied support mechanics) → epilogue_unity
```

### Branch C — **THE CORRUPTED**  `corruption ≥ 80`  `[COR]`
- **MQ-3C 🔨 "Become the Dark"** — embrace the Void, **kill Malachar to take his place**.
  Romance routes with `corruption_intolerant` leads **break** here (monogamy + morality lock).
- **Subquests:** `sq_feed_the_cracks` `[COR]` (raise corruption to max);
  `sq_shed_the_living` `[ROM]` (companions confront or abandon you).
- **Final:** ascend as the new dark god; the world remade in your image.

```
CS-90C  THE NEW GOD                                       [corrupted finale]
  INT. THE SEAL — THE HEART OF ENTROPY.  Malachar, ancient and tired.
  MALACHAR (grave) "You think this is victory. I thought so too, once."
  OUT → COMBAT malachar (corruption-empowered kit) → epilogue_corruption
```

### `malachar_final` (exists) + boss `malachar` (3-phase) anchor all three branches.

---

## 6. ROMANCE SUBPLOT STORYBOARDS  *(8 leads — monogamy-locked)*

**Monogamy rule (build):** the **first** of {give a gift · complete a romance SQ · make an
explicit confession choice} sets `romanceLocked` (already enforced in `PLAYER.adjustApproval`).
All other leads convert to **companion / rival / bittersweet NPC** and gain a one-line
"what could have been" callback.

| Lead | Origin gate | Arc spine | Key cutscene | Mechanical bond (Layer 8) |
|---|---|---|---|---|
| **Sera Ashblade** | sword_clan | Rival → spar → wed; combined Blade Saint ult | 🔨 CS-R1 | married → permanent ultimate |
| **Aelindra Moonveil** | mage_clan | Immortal chooses mortality | `aelindra_intro` ✅ | Moon Pool / 4th spell slot |
| **Sable Nighthollow** | noble | Assassin spares you → defects | `sable_reveal` ✅ | resonance: cloak/dodge near death |
| **Shade / Lysse Vorne** | prince | Double agent, two names, one choice | 🔨 CS-R4 | intel pre-siege `[MIL]` |
| **Princess Avira** | prince | Alliance marriage → real love; shifts her kingdom's war stance | `avira_intro` ✅ | her kingdom joins coalition `[POL]` |
| **Calla Vane** | priest | Cynic mercenary, honest to a fault | `calla_intro` ✅ | her company fights for you `[MIL]` |
| **Kessa Drumm** | commoner | Two years of unspoken; confession | `kessa_confession` ✅ | resonance passive shared |
| **Mira of No Name** | commoner | Amnesiac → lost princess → rewrites the lineage plot | 🔨 CS-R8 | unlocks Secret Lineage finale `[PWR]` |

**Romance approval gates (in code):** Kessa confession at approval ≥60 / arc `pursuing`;
Sable reveal at ≥50 — see `SYSTEMS.ROMANCE.checkRomanceScene`.

---

## 7. MASTER CUTSCENE INDEX

| ID | Title | Act | Status | Driver |
|---|---|---|---|---|
| CS-00P…00N | Six origin cold-opens | 0 | ✅ built (`SCREENPLAY`) | chargen → origin fork |
| CS-10 / 12 / 14 | Ashwood: Crack / Warlord / First Anchor | I | 🔨 | MQ-1 objectives |
| CS-20 | The Archivist (Aelindra) | II | ✅ `aelindra_intro` | meet NPC |
| CS-22 | The Knife That Chose (Sable) | II | ✅ `sable_reveal` | approval ≥50 |
| CS-24 | Two Names (Shade) | II | 🔨 | prince arc |
| CS-26 | The Alliance (Avira) | II | ✅ `avira_intro` | meet NPC |
| CS-28 | The Confession (Kessa) | II | ✅ `kessa_confession` | approval ≥60 |
| CS-40 | The Cleansing / The Feeding | II | 🔨 | Solheim `[COR]` fork |
| CS-90A/B/C | Three finales | III | 🔨 | branch flags |
| CS-99 | Malachar, the Awakened | III | ✅ `malachar_final` | final boss |

---

## 8. QUEST INDEX (build checklist)

**Major (spine):** `main_quest_1` ✅ → `main_quest_2` ✅ → `main_quest_3` 🔨 (branches A/B/C).

**Kingdom MQ chapters (Act II):** `MQ-2a` Sylvara · `MQ-2b` Drakmoor · `MQ-2c` Veranthos ·
`MQ-2d` Solheim — each 🔨, each yields one Heartstone fragment.

**Subquests:** Act I ×4 · per-kingdom dungeon/political/romance ×~12 · meta-layer ×3.

**Side quests (open-world `[PWR]`/`[LORE]`):** 7 Ancient-Site/mentor/wellspring quests +
codex-target hunts — *"a player who explores every corner is significantly stronger."*

---

## 9. PROGRESSION CROSS-REFERENCE (where the 10 layers attach)

| Layer | Storyboard anchor |
|---|---|
| 1 XP / Level | all combat & quests |
| 2 Skill Trees | **Mastery tab** (built); points per level |
| 3 Story Crucible | CS-14, awakenings, title bonuses on kingdom liberation |
| 4 Monster Codex | side codex hunts (built); thresholds per type |
| 5 Ancient Power Sites | `side_moon_pool / ancestor_echo / dragon_ossuary / void_crack / forgotten_library / wellsprings` |
| 6 Mentors | `side_blind_swordmaster` + hidden masters per kingdom |
| 7 Bloodline Awakening | `awakened_crisis` (built) + `side_ancestor_echo` |
| 8 Romance Resonance | §6 bond column |
| 9 Military Rank/Title | `sq_rise_through_ranks`, siege "War Hero" bonus |
| 10 Corruption | CS-00M/R seed → `side_void_crack` → CS-40 → Branch C |

---

*End of storyboard. ✅ = in code today · 🔨 = specced here, ready to build. Suggested build
order: MQ-1 cutscenes (CS-10/12/14) → one full kingdom arc (Drakmoor, since `bog_horror`
and `sable_reveal` already exist) → Act III branch flags.*
