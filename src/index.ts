import { settings, experimental, loadRecursive } from "./util.js"
for (var a of process.argv.slice(2)) {
    if (a.startsWith("-")) {
        //@ts-ignore
        if (a.slice(1) in experimental) experimental[a.slice(1)] = true
    }
}
import Discord from "discord.js"
import { BattleLobby, lobbies, createLobby } from "./lobby.js"
import { commands, loadDir, addCommands } from "./command-loader.js"
import { users, getUser, UserSaveData, data, globalData, getUserSaveData, replacer } from "./users.js"
import { writeFileSync, readFileSync, readdirSync, existsSync, statSync } from "fs"
import { shopItems } from "./items.js"
import canvas from "canvas"

import { resolve } from "path"
import { map } from "./game-map.js"
import { load } from "./content-loader.js"
import { calcStat } from "./stats.js"
import { calcDamage } from "./battle.js"

if (existsSync("map.txt")) {
    map.fromString(readFileSync("map.txt", "utf8"))
}

var config = JSON.parse(readFileSync(resolve("../config.json"), "utf8"))

const token = config.token

const GUILD_ID = config.test_guild

settings.ownerID = config.owner_id
settings.experimental = process.argv.includes("-experimental") || process.argv.includes("-e")
settings.noSave = process.argv.includes("-nosave") || settings.experimental


export var client = new Discord.Client({
    intents: ["GUILDS", "GUILD_MESSAGES"]
})

client.on("ready", async() => {
    console.log(`Ready`)
    var g = await client.guilds.fetch(GUILD_ID)
    var cmds = await loadDir("commands")
    await addCommands(g, cmds)
    console.log(`Actually ready`)
})

client.on("interactionCreate", async(i) => {
    if (i.isAutocomplete()) {
        var cmd = commands.get(i.commandName)
        if (cmd && "autocomplete" in cmd) {
            cmd.autocomplete?.(i);
        }
    }
    if (!i.isCommand() && !i.isContextMenu()) return
    try {
        getUser(i.user).lastCommand = Date.now()
        console.log(`${i.user.username} /${i.commandName}`)
        var cmd = commands.get(i.commandName)
        if (!cmd) return void await i.reply("Unknown command")
        //@ts-ignore
        await cmd.run(i)
    } catch (er) {
        if (er instanceof Error) {
            console.error(er)
            var o = {
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
    writeFileSync("map.txt", map.toString())
}
function saveJSON() {
    //@ts-ignore
    var obj: { [key: string]: UserSaveData } = { ...data }
    for (var [k, v] of users) {
        obj[k] = getUserSaveData(v);
    }
    users.clear()
    for (var k in obj) {
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
    var u = getUser(m.author);
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
setInterval(() => {
    for (var t of map.iterateRect(0, 0, map.width, map.height)) {
        if (!t.tile) continue
        if (!t.tile.owner) continue
        var u = client.users.cache.get(t.tile.owner)
        if (!u) continue
        var inf = getUser(u)
        if ((Date.now() - inf.lastCommand) > 15 * 60 * 1000) continue
        var tile = t.tile
        if (!tile.building) continue
        tile.building.update(t.x, t.y)
    }
}, 1000)
loadRecursive("content")

var base = 100
var maxlevel = 100
var step = maxlevel/50
var highest = calcStat(base, maxlevel)
var chars = process.stdout.columns - 30
for (var i = 0; i <= maxlevel; i += step) {
    var v = calcStat(base, i || 1)
    console.log(`STAT ${v.toString().padStart(6, " ")} | Level ${(i || 1).toString().padStart(maxlevel.toString().length, " ")}: ${"#".repeat(Math.floor(v / highest * chars))}`)
}

var power = 100
var baseatk = 100
var basedef = 100
var highest = calcDamage(power, calcStat(baseatk, maxlevel), calcStat(basedef, maxlevel), maxlevel)
for (var i = 0; i <= maxlevel; i += step) {
    var atk = calcStat(baseatk, i || 1)
    var def = calcStat(basedef, i || 1)
    var v = calcDamage(power, atk, def, i || 1)
    console.log(`DMG  ${v.toString().padStart(6, " ")} | Level ${(i || 1).toString().padStart(maxlevel.toString().length, " ")}: ${"#".repeat(Math.floor(v / highest * chars))}`)
}

// get real
if (experimental.april_fools) import("./april-fools.js")