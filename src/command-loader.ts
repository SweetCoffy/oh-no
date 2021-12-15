import { ApplicationCommandDataResolvable, CommandInteraction, Collection, Guild, ContextMenuInteraction, ApplicationCommandData, ChatInputApplicationCommandData, UserApplicationCommandData } from "discord.js";
import { readdir } from "fs/promises"
import { resolve } from "path"

export type ChatInputCommand = ChatInputApplicationCommandData & { run(i: CommandInteraction): any }
export type UserCommand = UserApplicationCommandData & { run(i: ContextMenuInteraction): any }

export type Command = ChatInputCommand | UserCommand

export var commands: Collection<string, Command> = new Collection()

export async function load(file: string) {
    var h: Command = (await import(file)).command
    commands.set(h.name, h)
    return h
}

export async function loadDir(dir: string) {
    var fulldir = resolve(`./build/${dir}`)
    var files = await readdir(fulldir)
    return await Promise.all(files.map(el => load(`${fulldir}/${el}`)))
}

export async function addCommands(g: Guild, cmds: Command[]) {
    await Promise.all(cmds.map(el => {
        console.log(el)
        return g.commands.create(el)
    }))
}