import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js"
import * as dotenv from "dotenv"

dotenv.config()

const BOT_TOKEN = process.env.BOT_TOKEN
const GOLD_API_KEY = String(process.env.GOLD_API_KEY)

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
})

// Default values
let threshold = 0.0001 // in percentage
let defaultChannel = "general"
let notificationInterval = 60000 // in milliseconds
let prefix = "!"
let includePrices = false

client.on("ready", () => {
  console.log(`Logged in as ${client.user?.displayName}!`)
})

client.on("message", async (message) => {
  if (message.author.bot) return

  if (message.content === `${prefix}help`) {
    const embed = new EmbedBuilder()
      .setTitle("Available Commands")
      .addFields(
        {
          name: `${prefix}help`,
          value: "Get a list of available commands."
        },
        {
          name: `${prefix}setchannel <channel name>`,
          value: "Set the channel where notifications will be sent."
        }
      )
      .addFields(
        {
          name: `${prefix}setthreshold <percentage>`,
          value: "Set the percentage threshold for price change notifications."
        },
        {
          name: `${prefix}setnotificationtime <minute>`,
          value: "Set the time when notifications will be sent."
        }
      )
      .addFields({
        name: `${prefix}goldpricesonly`,
        value: "Receive notifications for gold prices only."
      })
      .addFields(
        {
          name: `${prefix}both`,
          value: "Receive notifications for both gold prices and news."
        },
        {
          name: `${prefix}getgoldpricenow`,
          value: "Get the current gold price."
        }
      )
      .setColor("#F1C40F")
    message.channel.send({
      embeds: [embed]
    })
  }

  if (message.content.startsWith(`${prefix}setchannel`)) {
    const channel = message.mentions.channels.first()
    if (!channel) return message.reply("Invalid channel!")
    defaultChannel = channel.name
    message.reply(`Alerts will be sent to ${channel} from now on.`)
  }
  if (message.content.startsWith(`${prefix}setthreshold`)) {
    const percentage = message.content.split(" ")[1]
    if (!Number(percentage)) {
      message.reply(`Please enter a valid number for percentage threshold.`)
    } else {
      threshold = parseInt(percentage)
      message.reply(`Percentage threshold set to ${threshold}%.`)
    }
  }
  if (message.content.startsWith(`${prefix}setnotificationtime`)) {
    const [interval] = message.content.split(" ").slice(1)
    if (!Number(interval) || interval < 1) {
      message.reply(
        `Please enter a valid positive integer for the notification interval in minutes.`
      )
    } else {
      notificationInterval = parseInt(interval) * 60 * 1000 // convert minutes to milliseconds
      message.reply(`Notification interval set to ${interval} minutes.`)
    }
  }

  if (message.content === `${prefix}goldpricesonly`) {
    includePrices = true
    message.reply("You will now receive notifications for gold prices only.")
    runBot(includePrices)
  }
  if (message.content === `${prefix}goldnewsonly`) {
    includePrices = false
    message.reply(
      "You will now receive notifications for news about gold only."
    )
    runBot(includePrices)
  }
  if (message.content === `${prefix}both`) {
    includePrices = true
    message.reply(
      "You will now receive notifications for both gold prices and news."
    )
    runBot(includePrices)
  }
  if (message.content === `${prefix}getgoldpricenow`) {
    const goldData = await getGoldPrices()
    const price = goldData.price
    message.reply(`The current gold price is **$${price}** per ounce.`)
  }
})

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
    // Find the first guild the bot is in
    const guild = client.guilds.cache.first()
    if (!guild) {
      console.error("Bot is not in any guild")
      return
    }

    // Find the channel in the guild and ensure it's a text channel
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

    // Now TypeScript knows this is a text channel that can send messages
    channel.send({ embeds: [embed] })
    message = ""
  }
}

const runBot = (includePrices: boolean) => {
  setInterval(async () => {
    await sendNotification(includePrices)
  }, notificationInterval)
}

client.login(BOT_TOKEN)

runBot(includePrices)
