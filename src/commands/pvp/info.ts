// "stable" version info command
import { calcMul, statusTypes } from "../../battle.js"
import { Command } from "../../command-loader.js"
import { getUser } from "../../users.js"
import { bar } from "../../util.js"
export var command: Command = {
    type: "CHAT_INPUT",
    name: "info",
    description: "pingery",
    options: [
        {
            type: "INTEGER",
            name: "player",
            required: false,
            description: "a"
        }
    ],
    async run(i) {
        var lobby = getUser(i.user).lobby
        if (!lobby?.battle) return await i.reply({
            ephemeral: true,
            content: "bruh",
        })
        var idx = i.options.getInteger("player") ?? lobby.battle.players.findIndex(el => el.user?.id == i.user.id)
        var player = lobby.battle.players[idx]
        if (!player) return await i.reply({
            ephemeral: true,
            content: "bruh",
        })
        await i.reply({
            ephemeral: true,
            content: "```diff\n" +
            `${player.name.padEnd(32, " ")} Lv ${player.level}\nStats:\n${Object.keys(player.stats).map(k => {
                if (k == "hp") return `${player.hp < player.stats.hp / 5 ? "-" : " "}${k.toUpperCase().padEnd(6, " ")} ${Math.round(player.hp).toString().padStart(6, " ")}/${player.stats.hp.toString().padEnd(6, " ")} [${bar(player.hp, player.stats.hp, 10)}]`
                var fill = player.statStages[k] > 0 ? "˄" : "˅"
                var a = ""
                while (a.length < Math.min(Math.abs(player.statStages[k]), 6)) {
                    a += fill
                }
                while (a.length < 6) {
                    a += "-"
                }
                return `${player.statStages[k] == 0 ? " " : (player.statStages[k] > 0 ? "+" : "-")}${k.toUpperCase().padEnd(6, " ")} ${Math.round(player[k]).toString().padStart(6, " ")} [${calcMul(player.statStages[k]).toFixed(1).padStart(3, " ")}x] ${a}`
            }).join("\n")}\nCharge ${player.charge.toString().padStart(3, " ")}\nMagik  ${player.magic.toString().padStart(3, " ")}\n${player.status.map(el => {
                return `${statusTypes.get(el.type)?.name.padEnd(16, " ")} | ${el.duration.toString().padEnd(2, " ")} Turns left`
            }).join("\n") || "---------------- | -- Turns left"}\n`
            +  "\n```"
        })
    }
}