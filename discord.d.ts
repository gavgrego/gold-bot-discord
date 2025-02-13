import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js"

type LowercaseString = Lowercase<string>

// Define all valid command names as a union type
type ValidCommandNames =
  | "help"
  | "setchannel"
  | "setnotificationtime"
  | "getprice"
  | "setthreshold"
  | "goldpricesonly"
  | "goldnewsonly"
  | "both"
  | "getgoldpricenow"

declare module "discord.js" {
  interface SlashCommandBuilder {
    setName(name: LowercaseString): this
  }

  interface ChatInputCommandInteraction {
    commandName: ValidCommandNames
  }
}
