// "stable" version info command
import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js"
import { calcMul, statusTypes, teamNames } from "../../battle.js"
import { Command } from "../../command-loader.js"
import { StatID } from "../../stats.js"
import { getUser } from "../../users.js"
import { bar } from "../../util.js"
import { inspect } from "util"
export var command: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "info",
    description: "pingery",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "player",
            required: false,
            description: "a",
            autocomplete: true,
        }
    ],
    async autocomplete(i) {
        var u = getUser(i.user)
        if (!u.lobby?.battle) return await i.respond([])
        var b = u.lobby.battle;
        return await i.respond(b.players.map((el, i) => ({name: `#${i} ${el.name} (${Math.floor(el.hp / el.maxhp * 100)}%, Team ${teamNames[el.team]})`, value: i + ""})))
    },
    async run(i: ChatInputCommandInteraction) {
        function findPlayerID(name: string) {
            var split = name.split(" ")
            var num = parseInt(split[0])
            return num || Number(name)
        }
        var lobby = getUser(i.user).lobby
        if (!lobby?.battle) return await i.reply({
            ephemeral: true,
            content: "bruh",
        })
        var idx = findPlayerID(i.options.getString("player", false) || "") ?? lobby.battle.players.findIndex(el => el.user?.id == i.user.id)
        var player = lobby.battle.players[idx]
        if (!player) return await i.reply({
            ephemeral: true,
            content: "bruh",
        })
        await i.reply({
            ephemeral: true,
            content: "```diff\n" +
            `${player.name.padEnd(32, " ")} Lv ${player.level}\nHP [${bar(player.hp, player.maxhp, 20)}]\n${Math.floor(player.hp)}/${Math.floor(player.maxhp)}${player.absorption > 0 ? `\n\nT${player.absorptionTier} [${bar(player.absorption, player.maxhp, 20)}]\n${Math.floor(player.absorption / player.maxhp * 100)}%\n` : ``}\nCHG ${player.charge.toString().padStart(3, " ")}  MAG ${player.magic.toString().padStart(3, " ")}\nDeath point: ${-player.plotArmor} HP (Must take ${Math.ceil(player.hp + player.plotArmor)} damage before death)\n${player.status.map(el => {
                return `${statusTypes.get(el.type)?.name.padEnd(16, " ")} | ${el.duration.toString().padEnd(2, " ")} Turns left`
            }).join("\n") || "---------------- | -- Turns left"}\n` + 
            `Stats:\n${Object.keys(player.modifiers).map(el => {
                var mds = player.modifiers[el]
                return `${el.toUpperCase()}: ${Math.floor(player.stats[el as StatID])}\n├${mds.filter(el => !el.disabled).map(el => `${el.label || "Unknown modifier"}: ${el.type == "add" ? `+` : "x"}${el.value.toFixed(2)}`).join("\n├")}\n└Stage modifier: ${calcMul(player.statStages[el as StatID]).toFixed(2)}x`
            }).join("\n")}\n`
                + "\n```",
        })
    }
}