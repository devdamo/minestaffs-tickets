const discord = require('discord.js')
const bot = require('../../../index')
const client = bot.client
const roleGiverSystem = require('../buttons/roleGiver')

module.exports = () => {
    client.on("interactionCreate", async interaction => {
        if (!interaction.isButton()) return
        
        // Handle role giver interactions
        const handled = await roleGiverSystem.handleRoleGiverInteraction(interaction)
        if (handled) return // Exit if this was a role giver interaction
    })
}