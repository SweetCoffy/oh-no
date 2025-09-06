import { ApplicationCommandType, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, User } from "discord.js";
import { Command } from "../command-loader";
import { prefList } from "../user_prefs";
import { prefData } from "../save_special";
import { getUser } from "../users";
function prefsComponent(user: User) {
    let root = new ContainerBuilder()
    let prefs = Object.values(prefList)
    let u = getUser(user)
    let data = prefData.get(u)
    for (let pref of prefs) {
        let value = data[pref.key]
        let valueLabel = pref.values.vk[value] ?? "Invalid Value"
        let section = new SectionBuilder()
        let keys = Object.keys(pref.values.kv) as (keyof typeof pref.values.kv)[]
        section.addTextDisplayComponents(new TextDisplayBuilder({
            content: `## ${pref.name}\n${pref.description}`
        }))
        if (keys.length == 2) {
            section.setButtonAccessory(new ButtonBuilder({
                label: valueLabel,
                style: ButtonStyle.Primary,
                customId: `prefs:set/${pref.key}/toggle`
            }))
        } else {
            // TODO: handle more than two possible options, but not necessary as of now
        }
        root.addSectionComponents(section)
    }
    return root
}
export let command: Command = {
    name: "prefs",
    type: ApplicationCommandType.ChatInput,
    description: "Set your preferences",
    associatedCustomIds: ["prefs:"],
    async interaction(i) {
        let splits = i.customId.split("/")
        let u = getUser(i.user)
        let data = prefData.get(u)
        if (splits[0] == "prefs:set") {
            let pref = prefList[splits[1] as keyof typeof prefList]
            if (!pref) {
                return await i.reply({ flags: ["Ephemeral"], content: "huh?" })
            }
            let v = splits[2]
            let curValue = data[pref.key]
            if (v == "toggle") {
                let nextValue = Object.values(pref.values.kv).find(x => x != curValue)!
                data[pref.key] = nextValue
                return await i.update({ components: [prefsComponent(i.user)] })
            }
        }
    },
    async run(i) {
        await i.reply({
            flags: ["IsComponentsV2", "Ephemeral"],
            components: [prefsComponent(i.user)]
        });
    }
}