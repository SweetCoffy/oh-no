// "stable" version info command
import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js"
import { calcMul, statusTypes, teamNames } from "../../battle.js"
import { Command } from "../../command-loader.js"
import { StatID } from "../../stats.js"
import { getUser } from "../../users.js"
import { bar, barDelta, dispDelta, dispMul, formatString } from "../../util.js"
export let command: Command = {
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
        let u = getUser(i.user)
        if (!u.lobby?.battle) return await i.respond([])
        let b = u.lobby.battle;
        return await i.respond(b.players.map((el, i) => ({name: `#${i} ${el.name} (${Math.floor(el.hp / el.maxhp * 100)}%, Team ${teamNames[el.team]})`, value: i + ""})))
    },
    async run(i: ChatInputCommandInteraction) {
        function findPlayerID(name: string) {
            let split = name.split(" ")
            let num = parseInt(split[0])
            return num || Number(name)
        }
        let lobby = getUser(i.user).lobby
        if (!lobby?.battle) return await i.reply({
            ephemeral: true,
            content: "bruh",
        })
        let idx = findPlayerID(i.options.getString("player", false) || "") ?? lobby.battle.players.findIndex(el => el.user?.id == i.user.id)
        let player = lobby.battle.players[idx]
        let userPlayer = lobby.battle.players.find((v) => v.user?.id == i.user.id)
        if (!player) return await i.reply({
            ephemeral: true,
            content: "bruh",
        })
        let finalStats = player.getFinalStats()
        let details = userPlayer && !lobby.battle.isEnemy(player, userPlayer)
        function statsString() {
            return Object.keys(player.modifiers).map(el => {
                let mds = player.modifiers[el as StatID]

                return formatString(`${el.toUpperCase().padEnd(6, " ")}: [a]${Math.floor(player.stats[el as StatID])}[r] ${dispDelta(Math.ceil(finalStats[el as StatID] - player.stats[el as StatID]), true)}`
                    + (details ? `\n${mds.filter(el => !el.disabled)
                        .map(el => {
                            return `· ${el.label || "Unknown Modifier"}: ${el.type == "add" ? `${dispDelta(el.value, true)}` : `${dispMul(el.value, true, true)}`}`
                        })
                        .join("\n")}` : ``))
            }).join("\n")
        }
        await i.reply({
            ephemeral: true,
            content: "```ansi\n" +
                `${player.name.padEnd(32, " ")} Lv ${player.level}\nHP [${barDelta(player.hp, player.prevHp, player.maxhp, 24)}]\n${Math.floor(player.hp)}/${Math.floor(player.maxhp)}${player.absorption > 0 ? `\n\nT${player.absorptionTier} [${bar(player.absorption, player.maxhp, 20)}]\n${Math.floor(player.absorption / player.maxhp * 100)}%\n` : ``}\nCHG ${player.charge.toString().padStart(3, " ")}  MAG ${player.magic.toString().padStart(3, " ")}\nDeath Point: ${-player.plotArmor} HP (effectively ${Math.ceil(player.hp + player.plotArmor)} HP)\n${player.status.map(el => {
                return `${statusTypes.get(el.type)?.name} [${el.duration.toString().padEnd(2, " ")} Turns]`
                }).join("\n") || "No status effects."}\n` + 
                `Stats:\n${statsString()}\n`
                + "\n```",
        })
    }
}