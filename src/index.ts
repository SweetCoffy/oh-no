import Discord from "discord.js"
import { BattleLobby, lobbies, createLobby } from "./lobby.js"
import { commands, loadDir, addCommands } from "./command-loader.js"
import { users, createUser, getUser, UserSaveData, data, globalData } from "./users.js"
import { writeFileSync, readFileSync } from "fs"
import { shopItems } from "./items.js"

import { resolve } from "path"
import { settings } from "./util.js"

var config = JSON.parse(readFileSync(resolve("../config.json"), "utf8"))

const token = config.token

const GUILD_ID = config.test_guild

settings.ownerID = config.owner_id

var client = new Discord.Client({
    intents: 32767
})

client.on("ready", async() => {
    console.log("ur mom")
    var g = await client.guilds.fetch(GUILD_ID)
    var cmds = await loadDir("commands")
    addCommands(g, cmds)
})

client.on("interactionCreate", async(i) => {
    if (!i.isCommand() && !i.isContextMenu()) return
    try {
        console.log(`${i.user.username} /${i.commandName}`)
        var cmd = commands.get(i.commandName)
        if (!cmd) return void await i.reply("Unknown command")
        //@ts-ignore
        await cmd.run(i)
    } catch (er) {
        if (er instanceof Error) {
            console.log(er)
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
client.login(token);

process.on("SIGINT", () => {
    var obj: { [key: string]: UserSaveData } = data
    for (var [k, v] of users) {
        var m: any = {}
        for (let k in v.money) {
            //@ts-ignore
            m[k] = v.money[k] + ""
        }
        obj[k] = {
            baseStats: v.baseStats,
            preset: v.preset,
            presets: v.presets,
            score: v.score ?? 1000,
            money: m,
            items: v.items.map(el => ({item: el.item, amount: el.amount + ""})),
            banks: v.banks + "",
            multiplier: v.multiplier + "",
            helditems: v.helditems,
            bankLimit: v.bankLimit + ""
        }
    }
    console.log(obj)
    writeFileSync(`users.json`, JSON.stringify(obj, null, 4))
    writeFileSync("global.json", JSON.stringify(globalData, function(k, v){
        if (typeof v == "bigint") return `BigInt:${v}`
        return v
    }, 4))
    process.exit(0)
})
setInterval(() => {
    for (let [k, v] of users) {
        v.money.points += (BigInt(v.banks) * (v.multiplier))*60n
    }
}, 1000)