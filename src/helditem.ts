import { Collection } from "discord.js";
import { Battle, calcMoveDamage, MoveCastOpts, Player, TakeDamageOptions, TakeDamageType } from "./battle.js";
import { getString, LocaleString } from "./locale.js";
import { calcStat, ExtendedStatID, StatID } from "./stats.js";
import { formatString, max, rng } from "./util.js"
import { DescriptionBuilder } from "./battle-description.js";
import { Category } from "./moves.js";
import { fnum } from "./number-format.js";
export interface HeldItem {
    id: string,
    remove?: boolean,
    data?: object,
}
export type ItemClass = "bruh_orb" | "defense" | "offense" | "passive"
type HeldItemCallback = (battle: Battle, player: Player, item: HeldItem) => any
export class HeldItemType {
    name: string
    passiveEffect: string = "None"
    get description() {
        return this.passiveEffect
    }
    removeUse: boolean = true
    class: ItemClass = "passive"
    onTurn?: HeldItemCallback
    onBattleStart?: HeldItemCallback
    damageTakenModifierOrder: number = 0
    damageDealtModifierOrder: number = 0
    onDamage?: (battle: Battle, player: Player, item: HeldItem, dmg: number, opts: TakeDamageOptions) => number | void
    onDamageDealt?: (battle: Battle, player: Player, item: HeldItem, dmg: number, target: Player, opts: TakeDamageOptions) => number | void
    onMoveUse?: (battle: Battle, player: Player, item: HeldItem, move: string, opts: MoveCastOpts) => void
    icon?: string
    constructor(name: string, onTurn: typeof this.onTurn = undefined) {
        this.name = name
        this.onTurn = onTurn
    }
    setClass(c: ItemClass) {
        this.class = c
        return this
    }
    setIcon(icon: string) {
        this.icon = icon;
        return this
    }
    set(fn: ((v: typeof this) => void)) {
        fn(this)
        return this
    }
    setEffect(passive?: string) {
        if (passive) this.passiveEffect = passive
        return this
    }
    turn(p: Battle, player: Player, it: HeldItem) {
        if (this.onTurn) this.onTurn(p, player, it)
    }
}
export let items: Collection<string, HeldItemType> = new Collection()
items.set("eggs",
    new HeldItemType("Eggs", (b, p, item) => {
        if (p.dead) return
        b.heal(p, Math.floor(p.maxhp * 0.025), false, "heal.eggs")
    })
        .setEffect(formatString("Every turn:\nHeals the user by [a]2.5%[r] of their [a]MAX HP[r].")).setIcon("🥚"))

items.set("shield",
    new HeldItemType("Shield", function (b, p, i) {
        let d = i as HeldItem & { used: boolean }
        if (!d.used) {
            p.addModifier("def", { value: 1.3, label: "Shield" })
            p.addModifier("spdef", { value: 1.3, label: "Shield" })
            p.addModifier("atk", { value: 0.5, label: "Shield" })
            p.addModifier("spatk", { value: 0.5, label: "Shield" })
            p.addModifier("spd", { value: 0.8, label: "Shield" })
            //b.addAbsorption(p, p.maxhp * 0.3, 2)

            d.used = true;
        }
    }).setIcon("🛡️")
        .setEffect(DescriptionBuilder.new()
            .line("At the start of battle, grants [a]Tier 2 Absorption[r] equivalent to [a]30%[r] to the user's [a]MAX HP[r], and:")
            .mod({
                def: 1.3,
                spdef: 1.3,
                atk: 0.5,
                spatk: 0.5,
                spd: 0.8,
            })
            .build()))
items.set("category_swap",
    new HeldItemType("Category Swap").setEffect("Swaps the damage category of all moves used").setClass("offense").set((v) => {
        v.onMoveUse = (_0, _1, _2, _3, opts) => {
            if (opts.category == "physical") {
                opts.category = "special"
            } else if (opts.category == "special") {
                opts.category = "physical"
            }
        }
    }).setIcon("🔄"))

export const bruhOrbBoosts: {
    [key: string]: {
        mult: {
            [x in ExtendedStatID]?: number
        }, add: {
            [x in ExtendedStatID]?: number
        }
    }
} = {
    "": {
        mult: {
            hp: 1.025,
            atk: 1.05,
            def: 1.05,
            spatk: 1.05,
            spdef: 1.05,
            spd: 1.1,
        },
        add: {}
    },
    "attack": {
        mult: {
            atk: 1.3,
            spatk: 1.3,
            spd: 1.05,
            def: 0.9,
            spdef: 0.9,
        },
        add: {
            crit: 5,
            critdmg: 15,
        }
    },
    "speed": {
        mult: {
            atk: 1.025,
            spatk: 1.025,
            def: 0.95,
            spdef: 0.95,
            spd: 2,
        },
        add: {
            crit: 5
        }
    },
    "defense": {
        mult: {
            hp: 1.025,
            def: 1.3,
            spdef: 1.3,
            atk: 0.95,
            spatk: 0.95,
        },
        add: {
            dr: 5
        }
    },
    "hp": {
        mult: {
            hp: 1.2,
            def: 1.05,
            spdef: 1.05,
            atk: 0.9,
            spatk: 0.9,
        },
        add: {}
    }
}

function bruhOrbEffect(id: string) {
    return function (b: Battle, p: Player, item: HeldItem) {
        let hpFrac = p.hp / p.maxhp
        let boost = bruhOrbBoosts[id]
        for (let k in boost.mult) {
            if (!boost.mult[k as ExtendedStatID]) continue
            p.addModifier(k as ExtendedStatID, {
                value: boost.mult[k as ExtendedStatID] ?? 0,
                label: "Bruh Orb",
                type: "multiply",
                multCombine: "multiply"
            })
        }
        for (let k in boost.add) {
            if (!boost.add[k as ExtendedStatID]) continue
            p.addModifier(k as ExtendedStatID, {
                value: boost.add[k as ExtendedStatID] ?? 0,
                label: "Bruh Orb",
                type: "add",
            })
        }
        p.hp = Math.floor(p.maxhp * hpFrac)
    }
}

items.set("bruh_orb",
    new HeldItemType("Bruh Orb").set((v) => {
        v.onBattleStart = bruhOrbEffect("")
    }).setEffect(DescriptionBuilder.new()
        .bruhOrbMod(bruhOrbBoosts[""]).line("").build()).setIcon("🔴").setClass("bruh_orb"))

items.set("bruh_orb_attack",
    new HeldItemType("Bruh Orb (Attack)").set((v) => {
        v.onBattleStart = bruhOrbEffect("attack")
    }).setEffect(DescriptionBuilder.new()
        .bruhOrbMod(bruhOrbBoosts.attack).line("Refer to the standard [a]Bruh Orb[r] for details.").build()).setIcon("🗡️").setClass("bruh_orb"))

items.set("bruh_orb_speed",
    new HeldItemType("Bruh Orb (Speed)").set((v) => {
        v.onBattleStart = bruhOrbEffect("speed")
    }).setEffect(DescriptionBuilder.new()
        .bruhOrbMod(bruhOrbBoosts.speed).line("Refer to the standard [a]Bruh Orb[r] for details.").build()).setIcon("👟").setClass("bruh_orb"))

items.set("bruh_orb_defense",
    new HeldItemType("Bruh Orb (Defense)").set((v) => {
        v.onBattleStart = bruhOrbEffect("defense")
    }).setEffect(DescriptionBuilder.new()
        .bruhOrbMod(bruhOrbBoosts.defense).line("Refer to the standard [a]Bruh Orb[r] for details.").build()).setIcon("🛡️").setClass("bruh_orb"))

items.set("bruh_orb_hp",
    new HeldItemType("Bruh Orb (HP)").set((v) => {
        v.onBattleStart = bruhOrbEffect("hp")
    }).setEffect(DescriptionBuilder.new()
        .bruhOrbMod(bruhOrbBoosts.hp)
        .line("Refer to the standard [a]Bruh Orb[r] for details.")
        .build()).setIcon("❤️").setClass("bruh_orb"))

const MIRROR_BASE_MAX_HP = 150
const MIRROR_TEST_LEVELS = [1, 10, 25, 50, 100]
type MirrorItemData = {
    hp: number,
    maxhp: number,
}
const MIRROR_REFLECT: { [x in TakeDamageType]: number } = {
    physical: 0.3,
    special: 0.6,
    status: 0.8,
    ability: 0.0,
    none: 0.0,
}
items.set("mirror",
    new HeldItemType("Mirror")
        .setEffect(DescriptionBuilder.new()
            .line(`Redirects [yellow]30%[r]/[blue]60%[r]/[cyan]80%[r] of incoming [yellow]Physical[r]/[blue]Special[r]/[cyan]Status[r] damage to itself and deals [a]Special[r] damage to the attacker equal to the damage taken by the mirror.`)
            .line(`The mirror has its own [a]HP[r], starting with ${MIRROR_TEST_LEVELS.map(l => `[a]${fnum(calcStat(MIRROR_BASE_MAX_HP, l))}[r]`).join("/")} at level ${MIRROR_TEST_LEVELS.map(l => "[a]" + l + "[r]").join("/")} respectively.`)
            .build())
        .setIcon("🪞")
        .setClass("defense")
        .set(v => {
            v.damageTakenModifierOrder = -999
            v.onBattleStart = (b, p, item) => {
                let maxhp = calcStat(MIRROR_BASE_MAX_HP, p.level)
                item.data = {
                    maxhp,
                    hp: maxhp,
                }
            }
            v.onDamage = (b, p, item, dmg, opts) => {
                let data = item.data as MirrorItemData
                if (dmg <= 0) return
                if (data.hp <= 0 || item.remove) return
                if (!opts.inflictor) return
                let reflectPercent = MIRROR_REFLECT[opts.type ?? "none"]
                if (reflectPercent <= 0) return
                let reflectDmg = Math.floor(Math.min(dmg * reflectPercent, data.hp))
                dmg -= reflectDmg
                data.hp -= reflectDmg
                b.takeDamageO(opts.inflictor, reflectDmg, {
                    defStat: "spdef",
                    atkLvl: p.level,
                    type: "ability",
                    message: "item.mirror.reflect",
                    inflictor: p
                })
                if (data.hp <= 0) {
                    item.remove = true
                    b.logL("item.mirror.shatter", { player: p.toString() })
                }
                return dmg
            }
        }))