import { SlashCommandBuilder } from "discord.js"

type LowercaseString = Lowercase<string>

declare module "discord.js" {
  interface SlashCommandBuilder {
    setName(name: LowercaseString): this
  }
}
