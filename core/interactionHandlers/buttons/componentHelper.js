const discord = require('discord.js')
const bot = require('../../../index')
const client = bot.client
const config = bot.config
const roleGiverSystem = require('./roleGiver')

/**
 * Get the ticket type and role givers for a channel
 * @param {string} channelId - The channel ID
 * @returns {Object|null} - The ticket options or null
 */
const getTicketOptionsForChannel = (channelId) => {
    try {
        const hiddendata = bot.hiddenData.readHiddenData(channelId)
        if (hiddendata.length < 1) return null
        
        const ticketId = hiddendata.find(d => d.key == "type")?.value
        if (!ticketId) return null
        
        const ticketOption = config.options.find(opt => opt.id === ticketId)
        return ticketOption || null
    } catch (error) {
        return null
    }
}

/**
 * Build complete components array including role giver buttons
 * @param {discord.ActionRowBuilder[]} baseComponents - Base button rows
 * @param {string} channelId - The channel ID to check for role givers
 * @returns {discord.ActionRowBuilder[]} - Complete components array
 */
const buildCompleteComponents = (baseComponents, channelId) => {
    const ticketOptions = getTicketOptionsForChannel(channelId)
    
    if (!ticketOptions || !ticketOptions.roleGivers || ticketOptions.roleGivers.length === 0) {
        return baseComponents
    }
    
    // Create role giver buttons
    const roleGiverRow = roleGiverSystem.createRoleGiverButtons(ticketOptions.roleGivers)
    
    if (!roleGiverRow) {
        return baseComponents
    }
    
    // Return base components + role giver row
    return [...baseComponents, roleGiverRow]
}

/**
 * Enhanced button row builders that include role givers
 */
const createEnhancedButtonRows = (channelId) => {
    const l = bot.language
    const storage = bot.storage
    const claimdata = storage.get("claimData", channelId)
    
    // Base button rows (same as original)
    const normalRow = new discord.ActionRowBuilder()
        .addComponents(
            new discord.ButtonBuilder()
                .setCustomId("OTclaimTicket")
                .setDisabled(false)
                .setStyle(discord.ButtonStyle.Success)
                .setLabel("Claim Ticket")
                .setEmoji("📌")
        )
        .addComponents(
            new discord.ButtonBuilder()
                .setCustomId("OTcloseTicket")
                .setDisabled(false)
                .setStyle(discord.ButtonStyle.Secondary)
                .setLabel(l.buttons.close)
                .setEmoji("🔒")
        )
        .addComponents(
            new discord.ButtonBuilder()
                .setCustomId("OTdeleteTicket")
                .setDisabled(false)
                .setStyle(discord.ButtonStyle.Danger)
                .setLabel(l.buttons.delete)
                .setEmoji("✖️")
        )

    const noClaimRow = new discord.ActionRowBuilder()
        .addComponents(
            new discord.ButtonBuilder()
                .setCustomId("OTclaimTicket")
                .setDisabled(true)
                .setStyle(discord.ButtonStyle.Secondary)
                .setLabel("Claim Ticket")
                .setEmoji("📌")
        )
        .addComponents(
            new discord.ButtonBuilder()
                .setCustomId("OTcloseTicket")
                .setDisabled(false)
                .setStyle(discord.ButtonStyle.Secondary)
                .setLabel(l.buttons.close)
                .setEmoji("🔒")
        )
        .addComponents(
            new discord.ButtonBuilder()
                .setCustomId("OTdeleteTicket")
                .setDisabled(false)
                .setStyle(discord.ButtonStyle.Danger)
                .setLabel(l.buttons.delete)
                .setEmoji("✖️")
        )

    // Choose the appropriate base row
    const baseRow = (claimdata && claimdata != "false") ? noClaimRow : normalRow
    
    // Return complete components including role givers
    return buildCompleteComponents([baseRow], channelId)
}

module.exports = {
    buildCompleteComponents,
    createEnhancedButtonRows,
    getTicketOptionsForChannel
}