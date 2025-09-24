const discord = require('discord.js')
const bot = require('../../index')
const client = bot.client

const LOG_USER_ID = "253584434123636736"

/**
 * Send a log message to the specified user
 * @param {string} title - The title of the log message
 * @param {string} description - The description of the log message  
 * @param {string} color - The color for the embed (hex)
 * @param {Object} additionalFields - Additional fields to add to the embed
 */
const sendLogToUser = async (title, description, color = "#3498db", additionalFields = {}) => {
    try {
        const logUser = await client.users.fetch(LOG_USER_ID)
        if (!logUser) return

        const embed = new discord.EmbedBuilder()
            .setTitle(`🤖 Bot Event: ${title}`)
            .setDescription(description)
            .setColor(color)
            .setTimestamp()

        // Add additional fields
        Object.keys(additionalFields).forEach(key => {
            embed.addFields({
                name: key,
                value: String(additionalFields[key]),
                inline: true
            })
        })

        await logUser.send({ embeds: [embed] })
    } catch (error) {
        console.log(`Failed to send log to user: ${error.message}`)
    }
}

module.exports = {
    // Ticket Events
    logTicketCreated: (user, channel, guild, ticketType) => {
        sendLogToUser(
            "Ticket Created",
            `A new ticket has been created`,
            "#2ecc71",
            {
                "User": `${user.username} (${user.id})`,
                "Channel": `#${channel.name}`,
                "Guild": guild.name,
                "Ticket Type": ticketType
            }
        )
    },

    logTicketClosed: (user, channel, guild, reason) => {
        sendLogToUser(
            "Ticket Closed",
            `A ticket has been closed`,
            "#e74c3c",
            {
                "Closed By": `${user.username} (${user.id})`,
                "Channel": `#${channel.name}`,
                "Guild": guild.name,
                "Reason": reason || "No reason provided"
            }
        )
    },

    logTicketDeleted: (user, channel, guild) => {
        sendLogToUser(
            "Ticket Deleted",
            `A ticket has been deleted permanently`,
            "#95a5a6",
            {
                "Deleted By": `${user.username} (${user.id})`,
                "Channel": `#${channel.name}`,
                "Guild": guild.name
            }
        )
    },

    logTicketReopened: (user, channel, guild) => {
        sendLogToUser(
            "Ticket Reopened",
            `A ticket has been reopened`,
            "#f39c12",
            {
                "Reopened By": `${user.username} (${user.id})`,
                "Channel": `#${channel.name}`,
                "Guild": guild.name
            }
        )
    },

    // Role Events
    logRoleGranted: (grantedBy, grantedTo, role, guild, ticketChannel) => {
        sendLogToUser(
            "Role Granted",
            `A role has been granted through ticket system`,
            "#9b59b6",
            {
                "Granted By": `${grantedBy.username} (${grantedBy.id})`,
                "Granted To": `${grantedTo.username} (${grantedTo.id})`,
                "Role": `@${role.name}`,
                "Guild": guild.name,
                "Ticket": `#${ticketChannel.name}`
            }
        )
    },

    // Bot Events
    logBotStarted: () => {
        sendLogToUser(
            "Bot Started",
            `The bot has successfully started and is ready!`,
            "#00ff00"
        )
    },

    logBotError: (error, context) => {
        sendLogToUser(
            "Bot Error",
            `An error occurred: ${error.message}`,
            "#ff0000",
            {
                "Error Type": error.name,
                "Context": context,
                "Stack": error.stack?.substring(0, 500) + "..." || "No stack trace"
            }
        )
    },

    // Command Events
    logCommandUsed: (user, command, guild, channel) => {
        sendLogToUser(
            "Command Used",
            `A command has been executed`,
            "#3498db",
            {
                "User": `${user.username} (${user.id})`,
                "Command": command,
                "Guild": guild?.name || "DM",
                "Channel": channel?.name || "DM"
            }
        )
    },

    // General logging function
    logCustomEvent: (title, description, color, fields) => {
        sendLogToUser(title, description, color, fields)
    }
}