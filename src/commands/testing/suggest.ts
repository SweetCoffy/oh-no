import { ActionRow, SelectMenuComponent, TextInputComponent } from "@discordjs/builders";
import { ApplicationCommandType, ComponentType, Modal, TextInputStyle } from "discord.js";
import { Command } from "../../command-loader";

export var command: Command = {
    name: "suggest",
    description: "sussy modal test",
    type: ApplicationCommandType.ChatInput,
    async run(i) {
        await i.showModal(new Modal({ title: "h", customId: "e", components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        label: "sus",
                        minLength: 1,
                        maxLength: 2000,
                        customId: "a",
                        style: TextInputStyle.Paragraph
                    }
                ]
            }
        ] }))
        // var n = await i.showModal(new Modal().addComponents(
        //     new ActionRow<any>().addComponents(
        //         //new SelectMenuComponent({}).setCustomId("type")
        //         //.setMaxValues(1).setMinValues(1)
        //         //.setPlaceholder("Select a type")
        //         //.addOptions({ label: "Add", value: "add" }, { label: "Remove", value: "remove" }, { label: "Modify", value: "modify" }),
        //         new TextInputComponent().setCustomId("text")
        //         .setLabel("Thing").setMinLength(16).setMaxLength(4000)
        //         .setRequired(true).setStyle(TextInputStyle.Paragraph).setValue("").setPlaceholder("bruh"))
        // ).setTitle("Suggestion").setCustomId("suggest"))
        // if (!i.isModalSubmit()) return;
    }
}