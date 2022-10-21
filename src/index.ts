import { settings, experimental, loadRecursive, colorToANSI, formatString } from "./util.js"
for (let a of process.argv.slice(2)) {
    if (a.startsWith("-")) {
        //@ts-ignore
        if (a.slice(1) in experimental) experimental[a.slice(1)] = true
    }
}
import Discord, { GatewayIntentBits } from "discord.js"
import { commands, loadDir, addCommands } from "./command-loader.js"
import { users, getUser, UserSaveData, data, globalData, getUserSaveData, replacer } from "./users.js"
import { writeFileSync, readFileSync } from "fs"
import { shopItems } from "./items.js"

import { resolve } from "path"
import { calcStat } from "./stats.js"
import { calcDamage } from "./battle.js"

let config = JSON.parse(readFileSync(resolve("../config.json"), "utf8"))

const token = config.token

const GUILD_ID = config.test_guild

settings.ownerID = config.owner_id
settings.experimental = process.argv.includes("-experimental") || process.argv.includes("-e")
settings.noSave = process.argv.includes("-nosave") || settings.experimental


export let client = new Discord.Client({
    intents: [GatewayIntentBits.Guilds]
})

client.on("ready", async() => {
    console.log(`Ready`)
    let g = await client.guilds.fetch(GUILD_ID)
    let cmds = await loadDir("commands")
    await addCommands(g, cmds.filter(v => {
        if (v.value.status == "fulfilled") return true;
        console.error(`Did not add '${v.file}':`, v.value.reason)
    })
        //@ts-ignore
        .map(v => v.value.value))
    console.log(`Actually ready`)
    console.log(formatString(`Let's see...\nWill n:this; work?`))
    console.log(formatString(`It does, that's [s]great[r]!`))
})

client.on("interactionCreate", async(i) => {
    if (i.isAutocomplete()) {
        let cmd = commands.get(i.commandName)
        if (cmd && "autocomplete" in cmd) {
            cmd.autocomplete?.(i);
        }
    }
    if (!i.isCommand() && !i.isContextMenuCommand()) return
    try {
        getUser(i.user).lastCommand = Date.now()
        console.log(`${i.user.username} /${i.commandName}`)
        let cmd = commands.get(i.commandName)
        if (!cmd) return void await i.reply("Unknown command")
        //@ts-ignore
        await cmd.run(i)
    } catch (er) {
        if (er instanceof Error) {
            console.error(er)
            let o = {
                embeds: [
                    {
                        title: er.name,
                        description: er.message,
                        color: 0xff0000,
                        //@ts-ignore
                    }
                ],
                ephemeral: true
            }
            if (i.replied) {
                return void await i.followUp(o)
            } else {
                return void await i.reply(o)
            }
        }
    }
})

process.on("unhandledRejection", (er) => {
    console.error(er)
})
if (!process.argv.includes("-nobot")) client.login(token);
function saveOther() {
    for (let [k, v] of shopItems) {
        if (v.stock != Infinity) {
            globalData.itemStock[k] = v.stock
        }
    }
    writeFileSync("global.json", JSON.stringify(globalData, function(k, v){
        if (typeof v == "bigint") return `BigInt:${v}`
        return v
    }, 4))
}
function saveJSON() {
    //@ts-ignore
    let obj: { [key: string]: UserSaveData } = { ...data }
    for (let [k, v] of users) {
        obj[k] = getUserSaveData(v);
    }
    users.clear()
    for (let k in obj) {
        writeFileSync(`data/${settings.saveprefix}${k}.json`, JSON.stringify(obj[k], replacer, 4))
    }
    saveOther()
}
process.on("SIGINT", () => {
    if (settings.noSave) {
        process.exit(0)
        return
    }
    saveJSON()
    process.exit(0)
})
client.on("messageCreate", async(m) => {
    if (m.author.bot) return;
    let u = getUser(m.author);
    if (Date.now() > u.lastMessage + 5*1000) {
        u.msgLvl_xp += 10 + Math.floor(Math.cbrt(u.msgLvl_xp))
    }
    u.msgLvl_messages++
    u.lastMessage = Date.now();
})

setInterval(async() => {
    for (let [k, v] of users) {
        v.money.points += (BigInt(v.banks) * (v.multiplier/4n))*15n*5n*3n
    }
}, 15000)
loadRecursive("content")

function statGraph(base = 100, maxlevel = 100) {
    let step = maxlevel/50
    let highest = calcStat(base, maxlevel)
    let chars = process.stdout.columns - 30
    for (let i = 0; i <= maxlevel; i += step) {
        let v = calcStat(base, i || 1)
        console.log(`STAT ${v.toString().padStart(6, " ")} | Level ${(i || 1).toString().padStart(maxlevel.toString().length, " ")}: ${"#".repeat(Math.floor(v / highest * chars))}`)
    }
}
function damageGraph(power = 100, baseatk = 100, basedef = 100, maxlevel = 100) {
    let step = maxlevel/50
    let highest = calcDamage(power, calcStat(baseatk, maxlevel), calcStat(basedef, maxlevel), maxlevel)
    let chars = process.stdout.columns - 30
    for (let i = 0; i <= maxlevel; i += step) {
        let atk = calcStat(baseatk, i || 1)
        let def = calcStat(basedef, i || 1)
        let v = calcDamage(power, atk, def, i || 1)
        console.log(`DMG  ${v.toString().padStart(6, " ")} | Level ${(i || 1).toString().padStart(maxlevel.toString().length, " ")}: ${"#".repeat(Math.floor(v / highest * chars))}`)
    }
}


client.on("error", (error) => {
    console.error(error)
})

// get real
if (experimental.april_fools) import("./april-fools.js")
// pain