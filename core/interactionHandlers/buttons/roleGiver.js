const discord = require('discord.js')
const bot = require('../../../index')
const client = bot.client
const config = bot.config
const l = bot.language
const eventLogger = require('../../utils/eventLogger')

/**
 * Create role giver buttons based on config
 * @param {Array} roleGivers - Array of role giver configs
 * @returns {discord.ActionRowBuilder}
 */
const createRoleGiverButtons = (roleGivers) => {
    if (!roleGivers || roleGivers.length === 0) return null

    const row = new discord.ActionRowBuilder()
    
    roleGivers.forEach(roleGiver => {
        const button = new discord.ButtonBuilder()
            .setCustomId(`roleGiver_${roleGiver.id}`)
            .setLabel(roleGiver.name)
            .setStyle(getButtonStyle(roleGiver.color))
            .setEmoji(roleGiver.emoji || null)

        row.addComponents(button)
    })

    return row
}

/**
 * Get Discord button style from config color
 * @param {string} color 
 * @returns {discord.ButtonStyle}
 */
const getButtonStyle = (color) => {
    switch (color.toLowerCase()) {
        case 'green': return discord.ButtonStyle.Success
        case 'red': return discord.ButtonStyle.Danger
        case 'blue': return discord.ButtonStyle.Primary
        case 'grey': case 'gray': return discord.ButtonStyle.Secondary
        default: return discord.ButtonStyle.Primary
    }
}

/**
 * Handle role giver button interactions
 */
const handleRoleGiverInteraction = async (interaction) => {
    if (!interaction.customId.startsWith('roleGiver_')) return false

    const roleGiverId = interaction.customId.split('roleGiver_')[1]
    
    // Find the ticket option and role giver config
    let ticketOption = null
    let roleGiverConfig = null

    for (const option of config.options) {
        if (option.roleGivers) {
            const roleGiver = option.roleGivers.find(rg => rg.id === roleGiverId)
            if (roleGiver) {
                ticketOption = option
                roleGiverConfig = roleGiver
                break
            }
        }
    }

    if (!roleGiverConfig) {
        await interaction.reply({
            content: '❌ Role giver configuration not found.',
            ephemeral: true
        })
        return true
    }

    try {
        await interaction.deferReply({ ephemeral: true })

        // Get the ticket creator from the channel
        const ticketCreatorId = bot.storage.get("userFromChannel", interaction.channel.id)
        if (!ticketCreatorId) {
            await interaction.editReply({
                content: '❌ Could not find the ticket creator.',
                ephemeral: true
            })
            return true
        }

        // Get the ticket creator member
        const ticketCreator = await interaction.guild.members.fetch(ticketCreatorId)
        if (!ticketCreator) {
            await interaction.editReply({
                content: '❌ Ticket creator no longer in server.',
                ephemeral: true
            })
            return true
        }

        // Get the role to give
        const roleToGive = await interaction.guild.roles.fetch(roleGiverConfig.roleId)
        if (!roleToGive) {
            await interaction.editReply({
                content: '❌ Role not found. Please check the configuration.',
                ephemeral: true
            })
            return true
        }

        // Check if user already has the role
        if (ticketCreator.roles.cache.has(roleToGive.id)) {
            await interaction.editReply({
                content: `✅ ${ticketCreator.user.username} already has the **${roleToGive.name}** role.`,
                ephemeral: true
            })
            return true
        }

        // Give the role
        await ticketCreator.roles.add(roleToGive, `Role granted by ${interaction.user.username} via ticket system`)

        // Send success message
        await interaction.editReply({
            content: `✅ Successfully granted **${roleToGive.name}** role to ${ticketCreator.user.username}!`,
            ephemeral: true
        })

        // Send message to the ticket channel
        const successEmbed = new discord.EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('✅ Role Granted!')
            .setDescription(`${ticketCreator.user.username} has been granted the **${roleToGive.name}** role by ${interaction.user.username}.`)
            .setTimestamp()

        await interaction.channel.send({ embeds: [successEmbed] })

        // Log the event
        eventLogger.logRoleGranted(
            interaction.user,
            ticketCreator.user,
            roleToGive,
            interaction.guild,
            interaction.channel
        )

        // Try to DM the user (optional)
        try {
            const dmEmbed = new discord.EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🎉 Role Granted!')
                .setDescription(`You have been granted the **${roleToGive.name}** role in **${interaction.guild.name}**!`)
                .setTimestamp()

            await ticketCreator.send({ embeds: [dmEmbed] })
        } catch (error) {
            // Silently fail if DM can't be sent
        }

        // Update button to show it's been used (disable it)
        if (roleGiverConfig.disableAfterUse !== false) {
            const disabledButton = discord.ButtonBuilder.from(interaction.component)
                .setDisabled(true)
                .setLabel(`✅ ${roleGiverConfig.name} (Used)`)

            const updatedRow = new discord.ActionRowBuilder()
                .addComponents(disabledButton)

            // Get the original message and update it
            const originalMessage = interaction.message
            const newComponents = originalMessage.components.map(row => {
                const newRow = new discord.ActionRowBuilder()
                row.components.forEach(component => {
                    if (component.customId === interaction.customId) {
                        newRow.addComponents(disabledButton)
                    } else {
                        newRow.addComponents(component)
                    }
                })
                return newRow
            })

            await originalMessage.edit({ components: newComponents })
        }

    } catch (error) {
        console.error('Error in role giver:', error)
        await interaction.editReply({
            content: '❌ An error occurred while granting the role. Please try again later.',
            ephemeral: true
        })

        // Log the error
        eventLogger.logBotError(error, 'Role Giver System')
    }

    return true
}

module.exports = {
    createRoleGiverButtons,
    handleRoleGiverInteraction
}