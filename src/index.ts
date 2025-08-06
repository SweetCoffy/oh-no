import { settings, experimental, loadRecursive, colorToANSI, formatString, RNG } from "./util.js"
for (let a of process.argv.slice(2)) {
    if (a.startsWith("-")) {
        //@ts-ignore
        if (a.slice(1) in experimental) experimental[a.slice(1)] = true
    }
}
import Discord, { GatewayIntentBits, InteractionType } from "discord.js"
import { commands, loadDir, addCommands, customIds } from "./command-loader.js"
import { users, getUser, UserSaveData, data, globalData, getUserSaveData, replacer } from "./users.js"
import { writeFileSync, readFileSync } from "fs"
import { shopItems } from "./items.js"

import { resolve } from "path"
import { Stats, calcStat, limitStats } from "./stats.js"
import { calcMoveDamage } from "./battle.js"
import { generate } from "./codegen.js"

let config = JSON.parse(readFileSync(resolve("./.config.json"), "utf8"))

const token = config.token

const GUILD_ID = config.test_guild

settings.ownerID = config.owner_id
settings.experimental = process.argv.includes("-experimental") || process.argv.includes("-e")
settings.noSave = process.argv.includes("-nosave") || settings.experimental


export let client = new Discord.Client({
    intents: [GatewayIntentBits.Guilds],
})

client.on("ready", async () => {
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
})

client.on("interactionCreate", async (i) => {
    if (i.isAutocomplete()) {
        let cmd = commands.get(i.commandName)
        if (cmd && "autocomplete" in cmd) {
            cmd.autocomplete?.(i);
        }
    }
    if (!i.isCommand() && !i.isContextMenuCommand()) {
        if (!("customId" in i)) return;
        let splits = i.customId.split(":")
        let cmd = customIds.get(i.customId) ?? customIds.get(splits[0])
        if (!cmd) return
        if (i.isModalSubmit()) {
            await cmd.modalSubmit?.(i)
        } else {
            await cmd.interaction?.(i)
        }
        return
    }
    try {
        getUser(i.user).lastCommand = Date.now()
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
    writeFileSync("global.json", JSON.stringify(globalData, function (k, v) {
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
    }
    saveJSON()
    process.exit(0)
})
client.on("messageCreate", async (m) => {
    if (m.author.bot) return;
    let u = getUser(m.author);
    if (Date.now() > u.lastMessage + 5 * 1000) {
        u.msgLvl_xp += 10 + Math.floor(Math.cbrt(u.msgLvl_xp))
    }
    u.msgLvl_messages++
    u.lastMessage = Date.now();
})

// setInterval(async () => {
//     for (let [k, v] of users) {
//         v.money.points += (BigInt(v.banks) * (v.multiplier / 4n)) * 15n * 5n * 3n
//     }
// }, 15000)
loadRecursive("content")

client.on("error", (error) => {
    console.error(error)
})

let minv = Infinity
let maxv = -Infinity
let mv = 0xffffffff

let rng = new RNG(Math.floor(Math.random() * 999999))

for (let i = 0; i < 1000000; i++) {
    let v = rng.get() % mv
    minv = Math.min(minv, v)
    maxv = Math.max(maxv, v)
}
console.log(minv)
console.log(maxv)

// get real
if (experimental.april_fools) import("./april-fools.js")
if (experimental.codegen) generate()
// pain