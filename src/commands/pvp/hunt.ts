import { Player } from "../../battle.js";
import { Command } from "../../command-loader.js";
import { enemies, Enemy } from "../../enemies.js";
import { createLobby } from "../../lobby.js";
import { getString } from "../../locale.js";
import { calcStats } from "../../stats.js";
import { addXP, getUser, users } from "../../users.js";
import { money, randomRange, weightedDistribution, weightedRandom } from "../../util.js";

export var command: Command = {
    name: "hunt",
    description: "a",
    type: "CHAT_INPUT",
    options: [
        {
            type: "BOOLEAN",
            name: "dont_start",
            required: false,
            description: "fuc",
        }
    ],
    async run(i) {
        if (!i.channel) return await i.reply("what")
        var u = getUser(i.user)
        if (u.lobby) return await i.reply("You are already in a lobby")
        var l = createLobby(i.user, `${i.user.username}'s hunt`, 1)
        await i.reply({
            ephemeral: true,
            content: "get real",
        })
        var e = []
        var possibleEnemies = enemies.filter(el => !!el.encounter && u.level >= el.encounter.minPlayerLevel && u.level <= el.encounter.maxPlayerLevel)
        
        //@ts-ignore
        var chances = weightedDistribution(possibleEnemies.map(el => el.encounter.rate), 100)
        
        var h = chances.map((el, i) => [possibleEnemies.at(i), el])
        
        var enemyCount = 1 + Math.max(Math.floor(Math.cbrt(u.level / 10)) - 1, 0)
        
        if (Math.random() < 0.25) enemyCount++
        for (var j = 0; j < enemyCount; j++) {
            //@ts-ignore
            e.push(weightedRandom<Enemy>(h))
        }
        if (u.forceEncounter) {
            e = u.forceEncounter;
            u.forceEncounter = null;
        }
        l.level = u.level
        l.botCount = 0
        l.type = "pve"
        if (e.some(el => el?.boss)) {
            l.type = "boss"
            e = e.filter(el => el?.boss)
        }
        l.start()
        u.lobby = l;
        let threateningBonus = 1
        for (var enemy of e) {
            if (!enemy) continue
            var p = new Player()
            p._nickname = enemy.name
            p.baseStats = {...enemy.stats}
            p.xpYield = enemy.xpYield
            p.ai = enemy.ai
            p.team = 1
            if (enemy.encounter) {
                if (enemy.encounter.relativeLevel) {
                    p.level = Math.round(randomRange(enemy.encounter.minLevel, enemy.encounter.maxLevel) * u.level)
                } else {
                    p.level = Math.round(randomRange(enemy.encounter.minLevel, enemy.encounter.maxLevel))
                }
            } else {
                p.level = Math.ceil(randomRange(0.9, 1) * u.level)
            }
            if (enemy.name == "The Skeleton") {
                l.battle?.logL("enemy.appears", {name: enemy.name}, "yellow")
            }
            if (Math.random() < 1/16 * threateningBonus) {
                l.battle?.logL("hunt.threatening", {name: enemy.name}, "red")
                p.level = Math.floor(p.level * 1.5)
                p.xpYield *= 2
            }
            p.updateStats()
            if (enemy.boss) {
                if (enemy.boost) {
                    for (var k in enemy.boost) {
                        l.battle?.statBoost(p, k, enemy.boost[k])
                    }
                }
            }
            l.battle?.players.push(p)
        }
        //if (l.battle) l.battle.type = "pve"
        
        
        var lastinfo = await l.battle?.infoMessage(i.channel)
        l.battle?.on("newTurn", async() => {
            if (!i.channel) return
            if (lastinfo?.deletable) lastinfo.delete()
            lastinfo = await l.battle?.infoMessage(i.channel)
        })
        l.battle?.on("end", async(winner: string) => {
            if (!i.channel) return
            if (lastinfo?.deletable) lastinfo.delete()
            lastinfo = await l.battle?.infoMessage(i.channel)
            if (winner == "players") {
                var enemies = l.battle?.players.filter(el => !el.user) || []
                var xp = Math.ceil(
                    enemies
                    .map(el => (el.level * el.xpYield) / 5)
                    .reduce((prev, cur) => prev + cur, 0) || 0)
                var oldStats = calcStats(u.level, u.baseStats)
                var m = BigInt(Math.floor(xp * (xp * 0.075)))/100n*15n
                getUser(i.user).money.points += m
                await i.followUp(`You won, gained ${xp} XP and ${money(m)}`)
                var levels = addXP(i.user, xp)
                var newStats = calcStats(u.level, u.baseStats)
                if (levels > 0) {
                    await i.followUp(`+${levels} levels\n${
                        Object.keys(oldStats)
                        .map(el => `\`${el.padEnd(6, " ")} ${oldStats[el].toString().padStart(6, " ")} + ${(newStats[el] - oldStats[el]).toString().padEnd(6, " ")}\``)
                        .join("\n")
                    }`)
                }
            } else {
                await i.followUp("You lost")
            }
        })
    }
}