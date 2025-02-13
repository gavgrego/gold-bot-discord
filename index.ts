import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  TextChannel
} from "discord.js"
import * as dotenv from "dotenv"

dotenv.config()

const BOT_TOKEN = process.env.BOT_TOKEN
const GOLD_API_KEY = String(process.env.GOLD_API_KEY)

if (!BOT_TOKEN || !GOLD_API_KEY) {
  throw new Error("Missing required environment variables")
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
})

// Default values
let threshold = 0.0001
let defaultChannel = "general"
let notificationInterval = 60000
let includePrices = false
let notificationTimer: NodeJS.Timeout | null = null

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get a list of available commands"),
  new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("Set the channel for notifications")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to send notifications to")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("setnotificationtime")
    .setDescription("Set notification interval in minutes")
    .addIntegerOption((option) =>
      option
        .setName("minutes")
        .setDescription("Interval in minutes")
        .setRequired(true)
        .setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName("getprice")
    .setDescription("Get the current gold price")
]

// Register slash commands when bot is ready
client.once("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}!`)

  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN)

  try {
    console.log("Refreshing slash commands...")
    await rest.put(Routes.applicationCommands(client.user!.id), {
      body: commands
    })
    console.log("Successfully registered slash commands")
    runBot(includePrices)
  } catch (error) {
    console.error("Error registering slash commands:", error)
  }
})

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  try {
    switch (interaction.commandName) {
      case "help":
        await handleHelp(interaction)
        break
      case "setchannel":
        await handleSetChannel(interaction)
        break
      case "setnotificationtime":
        await handleSetNotificationTime(interaction)
        break
      case "getprice":
        await handleGetGoldPriceNow(interaction)
        break
    }
  } catch (error) {
    console.error("Error handling command:", error)
    await interaction.reply({
      content: "There was an error executing this command!",
      ephemeral: true
    })
  }
})

// Command handlers
async function handleHelp(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle("Available Commands")
    .addFields(
      { name: `/help`, value: "Get a list of available commands." },
      {
        name: `/setchannel`,
        value: "Set the channel where notifications will be sent."
      },
      {
        name: `/setnotificationtime`,
        value: "Set the notification interval in minutes."
      },
      { name: `/getprice`, value: "Get the current gold price." }
    )
    .setColor("#F1C40F")

  await interaction.reply({ embeds: [embed] })
}

async function handleSetChannel(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel("channel")
  if (!channel || !(channel instanceof TextChannel)) {
    await interaction.reply("Please select a valid text channel!")
    return
  }
  defaultChannel = channel.name
  await interaction.reply(`Alerts will be sent to ${channel} from now on.`)
}

async function handleSetNotificationTime(
  interaction: ChatInputCommandInteraction
) {
  const minutes = interaction.options.getInteger("minutes")
  if (!minutes || minutes < 1) {
    await interaction.reply(
      "Please provide a valid positive number of minutes!"
    )
    return
  }
  notificationInterval = minutes * 60 * 1000
  await interaction.reply(`Notification interval set to ${minutes} minutes.`)
  runBot(includePrices) // Restart the notification timer
}

async function handleGetGoldPriceNow(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply() // For potentially slow API calls
  try {
    const goldData = await getGoldPrices()
    await interaction.editReply(
      `The current gold price is **$${goldData.price}** per ounce.`
    )
  } catch (error) {
    await interaction.editReply(
      "Sorry, I could not fetch the current gold price."
    )
  }
}

const getGoldPrices = async () => {
  try {
    const response = await fetch("https://www.goldapi.io/api/XAU/USD", {
      headers: {
        "x-access-token": GOLD_API_KEY
      }
    })
    return await response.json()
  } catch (error) {
    console.error(error)
  }
}

const sendNotification = async (includePrices: boolean) => {
  let message = ""

  if (includePrices) {
    console.log("sending price alert")
    try {
      const response = await fetch("https://www.goldapi.io/api/XAU/USD", {
        headers: {
          "x-access-token": GOLD_API_KEY
        }
      })
      var goldData = await response.json()
      console.log("done sending price alert")

      console.log(goldData)
    } catch (error) {
      console.error(error)
    }

    const oldPriceData = goldData.prev_close_price
    const newPriceData = goldData.price
    const priceChange = ((newPriceData - oldPriceData) / oldPriceData) * 100
    if (Math.abs(priceChange) >= threshold) {
      message += `**[ Gold Prices Alert ]**\n\n`
      if (priceChange > 0) {
        message += `Gold prices are up by ${priceChange.toFixed(2)}%**\n`
      } else {
        message += `Gold prices are **down by ${Math.abs(priceChange).toFixed(
          2
        )}%**\n`
      }
      message += `**Old price:** $${oldPriceData.toFixed(
        2
      )}\n**New price:** $${newPriceData.toFixed(2)}`
    }
  }

  if (message) {
    const guild = client.guilds.cache.first()
    if (!guild) {
      console.error("Bot is not in any guild")
      return
    }

    const channel = guild.channels.cache.find(
      (ch) => ch.name === defaultChannel && ch.isTextBased()
    )
    if (!channel || !channel.isTextBased()) {
      console.error(`Could not find text channel "${defaultChannel}"`)
      return
    }

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setDescription(message)
      .setTimestamp()

    channel.send({ embeds: [embed] })
    message = ""
  }
}

const runBot = (includePrices: boolean) => {
  if (notificationTimer) {
    clearInterval(notificationTimer)
  }
  notificationTimer = setInterval(async () => {
    await sendNotification(includePrices)
  }, notificationInterval)
}

client.login(BOT_TOKEN)
