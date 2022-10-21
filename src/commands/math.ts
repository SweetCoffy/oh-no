import { ApplicationCommandType, ApplicationCommandOptionType, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../command-loader.js";
import Fixed from "../fixed.js";
import { getPreset, getPresetList, StatID } from "../stats.js";
import { getUser } from "../users.js";
import { Dictionary } from "../util.js";
export let command: Command = {
    name: "math",
    description: "mafs",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "op",
            required: true,
            description: "a",
        },
        {
            type: ApplicationCommandOptionType.Integer,
            name: "precision",
            required: false,
            description: "a",
        }
    ],
    async run(i: ChatInputCommandInteraction) {
        let p = BigInt(i.options.getInteger("precision", false) || 24)
        if (p > 64n || p < 1n) return await i.reply(`precision: ${p} is out of the range 1 - 64`)
        let f = new Fixed(p)
        let u = getUser(i.user)
        let target: Dictionary<bigint> = {
            money: u.money.points*f.fracunit,
            banks: u.banks*f.fracunit,
        }
        let modifiedVars: Dictionary<boolean> = {}
        for (let k in getPresetList(i.user)) {
            let stats = getPreset(k, i.user)?.stats
            for (let s in stats) {
                target[`${k}_${s}`] = f.fromFloat(stats[s as StatID])
            }
        }
        let vars: Dictionary<bigint> = new Proxy(target, {
            set(t, p, v, r) {
                if (typeof p == "string") modifiedVars[p] = true
                return Reflect.set(t, p, v, r)
            },
        })
        let result = f.eval(i.options.getString("op", true), vars)
        await i.reply(`\`${i.options.getString("op", true)}\` = ${f.toString(result, 3n)} (Raw value: ${result})\n${
            Object.keys(vars).filter(el => modifiedVars[el]).map(el => `\`${el}\`: ${f.toString(vars[el], 3n)} (Raw: ${vars[el]})`).join("\n")
        }`)
    }
}