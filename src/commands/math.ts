import { Command } from "../command-loader.js";
import Fixed from "../fixed.js";
import { getPreset, getPresetList } from "../stats.js";
import { getUser } from "../users.js";
import { Dictionary } from "../util.js";
export var command: Command = {
    name: "math",
    description: "mafs",
    type: "CHAT_INPUT",
    options: [
        {
            type: "STRING",
            name: "op",
            required: true,
            description: "a",
        },
        {
            type: "INTEGER",
            name: "precision",
            required: false,
            description: "a",
        }
    ],
    async run(i) {
        var p = BigInt(i.options.getInteger("precision", false) || 24)
        if (p > 64n || p < 1n) return await i.reply(`precision: ${p} is out of the range 1 - 64`)
        var f = new Fixed(p)
        var u = getUser(i.user)
        var target: Dictionary<bigint> = {
            money: u.money.points*f.fracunit,
            banks: u.banks*f.fracunit,
        }
        var modifiedVars: Dictionary<boolean> = {}
        for (var k in getPresetList(i.user)) {
            var stats = getPreset(k, i.user)?.stats
            for (var s in stats) {
                target[`${k}_${s}`] = f.fromFloat(stats[s])
            }
        }
        var vars: Dictionary<bigint> = new Proxy(target, {
            set(t, p, v, r) {
                if (typeof p == "string") modifiedVars[p] = true
                return Reflect.set(t, p, v, r)
            },
        })
        var result = f.eval(i.options.getString("op", true), vars)
        await i.reply(`\`${i.options.getString("op", true)}\` = ${f.toString(result, 3n)} (Raw value: ${result})\n${
            Object.keys(vars).filter(el => modifiedVars[el]).map(el => `\`${el}\`: ${f.toString(vars[el], 3n)} (Raw: ${vars[el]})`).join("\n")
        }`)
    }
}