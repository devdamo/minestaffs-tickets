require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('tickets.db');

// Load config
let config = { panels: [], bypass_user_id: null };
try {
    if (fs.existsSync('./config.json')) {
        config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        console.log(`✅ Loaded ${config.panels.length} panel(s) from config.json`);
        if (config.bypass_user_id) {
            console.log(`✅ Bypass user configured: ${config.bypass_user_id}`);
        }
    } else {
        console.log('⚠️ No config.json found, using empty config');
    }
} catch (error) {
    console.error('❌ Error loading config.json:', error);
}

// Initialize database
db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_categories (
        guild_id TEXT,
        name TEXT,
        roles TEXT
    );
    
    CREATE TABLE IF NOT EXISTS ticket_panels (
        guild_id TEXT,
        channel_id TEXT,
        message_id TEXT,
        title TEXT,
        description TEXT,
        categories TEXT
    );
    
    CREATE TABLE IF NOT EXISTS active_tickets (
        guild_id TEXT,
        channel_id TEXT,
        user_id TEXT,
        category TEXT,
        created_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS ticket_alerts (
        guild_id TEXT,
        user_id TEXT
    );
`);

// Migrate database - add new columns if they don't exist
try {
    // Check and add config_name to ticket_panels
    const panelsInfo = db.pragma('table_info(ticket_panels)');
    const hasConfigName = panelsInfo.some(col => col.name === 'config_name');
    
    if (!hasConfigName) {
        console.log('🔄 Adding config_name column to ticket_panels...');
        db.exec('ALTER TABLE ticket_panels ADD COLUMN config_name TEXT');
        console.log('✅ Added config_name column!');
    }
    
    // Check and add status to active_tickets
    const ticketsInfo = db.pragma('table_info(active_tickets)');
    const hasStatus = ticketsInfo.some(col => col.name === 'status');
    
    if (!hasStatus) {
        console.log('🔄 Adding status column to active_tickets...');
        db.exec('ALTER TABLE active_tickets ADD COLUMN status TEXT DEFAULT "open"');
        // Update existing rows to have 'open' status
        db.exec('UPDATE active_tickets SET status = "open" WHERE status IS NULL');
        console.log('✅ Added status column!');
    }
    
    // Check and add form_data to active_tickets
    const hasFormData = ticketsInfo.some(col => col.name === 'form_data');
    
    if (!hasFormData) {
        console.log('🔄 Adding form_data column to active_tickets...');
        db.exec('ALTER TABLE active_tickets ADD COLUMN form_data TEXT');
        console.log('✅ Added form_data column!');
    }
    
    console.log('✅ Database migration complete!');
} catch (error) {
    console.error('❌ Database migration error:', error);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: []
});

// Helper: Check if user can bypass permissions
function canBypassPermissions(userId) {
    return config.bypass_user_id && userId === config.bypass_user_id;
}

// Helper: Check if user has admin permissions or is bypass user
function hasAdminOrBypass(interaction) {
    if (canBypassPermissions(interaction.user.id)) return true;
    if (interaction.guild && interaction.memberPermissions) {
        return interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
    }
    return false;
}

client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Bot is in ${client.guilds.cache.size} server(s):`);
    client.guilds.cache.forEach(guild => {
        console.log(`  - ${guild.name} (${guild.id})`);
    });
    
    // Register slash commands
    const commands = [
        {
            name: 'ticket',
            description: 'Ticket management commands',
            options: [
                {
                    name: 'deploy',
                    description: 'Deploy all panels to their configured channels (cleans old messages)',
                    type: 1
                },
                {
                    name: 'cleanup',
                    description: 'Delete old bot messages from panel channels',
                    type: 1
                },
                {
                    name: 'setup',
                    description: 'Setup a panel from config.json',
                    type: 1,
                    options: [
                        {
                            name: 'panel',
                            description: 'Panel name from config.json',
                            type: 3,
                            required: true,
                            autocomplete: true
                        },
                        {
                            name: 'channel',
                            description: 'Channel to send the panel to',
                            type: 7,
                            required: true
                        }
                    ]
                },
                {
                    name: 'refresh',
                    description: 'Refresh all panels (updates dropdowns)',
                    type: 1
                },
                {
                    name: 'panel',
                    description: 'Create a ticket panel (legacy method)',
                    type: 1,
                    options: [
                        {
                            name: 'channel',
                            description: 'Channel to send the panel to',
                            type: 7,
                            required: true
                        },
                        {
                            name: 'title',
                            description: 'Panel title',
                            type: 3,
                            required: true
                        },
                        {
                            name: 'description',
                            description: 'Panel description',
                            type: 3,
                            required: true
                        },
                        {
                            name: 'categories',
                            description: 'Categories to include (comma separated)',
                            type: 3,
                            required: true
                        }
                    ]
                },
                {
                    name: 'create',
                    description: 'Create a new ticket category',
                    type: 1,
                    options: [
                        {
                            name: 'title',
                            description: 'Category title',
                            type: 3,
                            required: true
                        },
                        {
                            name: 'role',
                            description: 'Role to add to tickets (optional)',
                            type: 8,
                            required: false
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'Show all active tickets',
                    type: 1
                },
                {
                    name: 'alerts',
                    description: 'Toggle DM notifications for new tickets',
                    type: 1
                },
                {
                    name: 'categories',
                    description: 'List all available ticket categories',
                    type: 1
                },
                {
                    name: 'close',
                    description: 'Close the current ticket',
                    type: 1
                },
                {
                    name: 'menu',
                    description: 'Show ticket info and actions',
                    type: 1
                }
            ]
        }
    ];

    try {
        await client.application.commands.set(commands);
        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Helper function to get panel config
function getPanelConfig(panelName) {
    return config.panels.find(p => p.name.toLowerCase() === panelName.toLowerCase());
}

// Helper function to get category config from panel
function getCategoryConfig(panelName, categoryName) {
    const panel = getPanelConfig(panelName);
    if (!panel) return null;
    return panel.categories.find(c => c.name === categoryName);
}

// Helper function to format channel name with form data
function formatChannelName(template, username, formData = {}) {
    let channelName = template;
    
    // Replace {username}
    channelName = channelName.replace('{username}', username);
    
    // Replace form field placeholders with fallback
    // Format: {field_name|fallback}
    const regex = /{([^}|]+)(?:\|([^}]+))?}/g;
    channelName = channelName.replace(regex, (match, fieldName, fallback) => {
        if (formData[fieldName]) {
            return formData[fieldName];
        }
        if (fallback) {
            return fallback === 'username' ? username : fallback;
        }
        return username;
    });
    
    // Clean up channel name (Discord requirements)
    channelName = channelName.toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    
    return channelName;
}

// Helper: Delete bot messages in a channel
async function cleanupChannel(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const botMessages = messages.filter(m => m.author.id === client.user.id);
        
        if (botMessages.size === 0) return 0;
        
        // Delete messages one by one (bulk delete only works for messages < 14 days old)
        let deleted = 0;
        for (const msg of botMessages.values()) {
            try {
                await msg.delete();
                deleted++;
                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                console.error(`Failed to delete message ${msg.id}:`, e);
            }
        }
        
        return deleted;
    } catch (error) {
        console.error(`Error cleaning up channel ${channel.id}:`, error);
        return 0;
    }
}

// Handle interactions
client.on('interactionCreate', async (interaction) => {
    try {
        // Handle autocomplete
        if (interaction.isAutocomplete()) {
            if (interaction.commandName === 'ticket' && interaction.options.getSubcommand() === 'setup') {
                const focusedValue = interaction.options.getFocused().toLowerCase();
                const choices = config.panels
                    .filter(panel => panel.name.toLowerCase().includes(focusedValue))
                    .map(panel => ({ name: panel.title, value: panel.name }));
                await interaction.respond(choices.slice(0, 25));
            }
            return;
        }

        if (interaction.isChatInputCommand()) {
            const { commandName, options } = interaction;
            
            // For DM commands, check if user is bypass user
            const isFromDM = !interaction.guild;
            if (isFromDM && !canBypassPermissions(interaction.user.id)) {
                return interaction.reply({ content: '❌ This command cannot be used in DMs!', flags: MessageFlags.Ephemeral });
            }
            
            // Get guild (for DM commands, use the first guild the bot is in)
            let guild = interaction.guild;
            if (isFromDM) {
                guild = client.guilds.cache.first();
                if (!guild) {
                    return interaction.reply({ content: '❌ Bot is not in any servers!', flags: MessageFlags.Ephemeral });
                }
            }
        
        if (commandName === 'ticket') {
            const subcommand = options.getSubcommand();
            
            // Check permissions (admin or bypass user)
            const needsAdmin = ['deploy', 'cleanup', 'setup', 'refresh', 'panel', 'create', 'list', 'categories', 'alerts', 'menu'];
            if (needsAdmin.includes(subcommand) && !hasAdminOrBypass(interaction)) {
                return interaction.reply({ content: '❌ You need Administrator permission or be the bypass user!', flags: MessageFlags.Ephemeral });
            }
            
            if (subcommand === 'deploy') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                
                let deployed = 0;
                let cleaned = 0;
                const results = [];
                
                for (const panelConfig of config.panels) {
                    if (!panelConfig.channel_id) {
                        results.push(`⚠️ ${panelConfig.title}: No channel_id configured`);
                        continue;
                    }
                    
                    try {
                        const channel = await guild.channels.fetch(panelConfig.channel_id);
                        
                        // Cleanup old bot messages
                        const deletedCount = await cleanupChannel(channel);
                        cleaned += deletedCount;
                        
                        // Create embed
                        const embed = new EmbedBuilder()
                            .setTitle(panelConfig.title)
                            .setDescription(panelConfig.description)
                            .setColor(0xFFFFFF)
                            .setFooter({ text: 'Managed by overtimehosting' });
                        
                        // Create dropdown
                        const selectMenu = new StringSelectMenuBuilder()
                            .setCustomId(`ticket_dropdown_${panelConfig.name}`)
                            .setPlaceholder('Select a ticket type...')
                            .addOptions(
                                panelConfig.categories.map(cat => ({
                                    label: cat.name,
                                    value: cat.name,
                                    emoji: cat.emoji || '🎫'
                                }))
                            );
                        
                        const row = new ActionRowBuilder().addComponents(selectMenu);
                        const panelMsg = await channel.send({ embeds: [embed], components: [row] });
                        
                        // Save to database (with 7 columns now)
                        db.prepare('INSERT INTO ticket_panels (guild_id, channel_id, message_id, title, description, categories, config_name) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
                            guild.id,
                            channel.id,
                            panelMsg.id,
                            panelConfig.title,
                            panelConfig.description,
                            JSON.stringify(panelConfig.categories.map(c => c.name)),
                            panelConfig.name
                        );
                        
                        deployed++;
                        results.push(`✅ ${panelConfig.title} → <#${channel.id}>`);
                    } catch (error) {
                        console.error(`Failed to deploy panel ${panelConfig.name}:`, error);
                        results.push(`❌ ${panelConfig.title}: ${error.message}`);
                    }
                }
                
                const summary = `🚀 **Deployment Complete!**\n\n📋 Deployed: ${deployed} panel(s)\n🗑️ Cleaned: ${cleaned} old message(s)\n\n${results.join('\n')}`;
                await interaction.editReply({ content: summary });
            }
            
            else if (subcommand === 'cleanup') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                
                let totalCleaned = 0;
                const results = [];
                
                for (const panelConfig of config.panels) {
                    if (!panelConfig.channel_id) continue;
                    
                    try {
                        const channel = await guild.channels.fetch(panelConfig.channel_id);
                        const deleted = await cleanupChannel(channel);
                        totalCleaned += deleted;
                        results.push(`🗑️ <#${channel.id}>: ${deleted} message(s)`);
                    } catch (error) {
                        console.error(`Failed to cleanup channel ${panelConfig.channel_id}:`, error);
                        results.push(`❌ ${panelConfig.title}: ${error.message}`);
                    }
                }
                
                const summary = `🧹 **Cleanup Complete!**\n\nDeleted ${totalCleaned} old bot message(s)\n\n${results.join('\n')}`;
                await interaction.editReply({ content: summary });
            }
            
            else if (subcommand === 'setup') {
                const panelName = options.getString('panel');
                const channelOption = options.getChannel('channel');
                
                const panelConfig = getPanelConfig(panelName);
                if (!panelConfig) {
                    return interaction.reply({ content: `❌ Panel "${panelName}" not found in config.json!`, flags: MessageFlags.Ephemeral });
                }
                
                const channel = await guild.channels.fetch(channelOption.id);
                
                // Create embed
                const embed = new EmbedBuilder()
                    .setTitle(panelConfig.title)
                    .setDescription(panelConfig.description)
                    .setColor(0xFFFFFF)
                    .setFooter({ text: 'Managed by overtimehosting' });
                
                // Create dropdown
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`ticket_dropdown_${panelName}`)
                    .setPlaceholder('Select a ticket type...')
                    .addOptions(
                        panelConfig.categories.map(cat => ({
                            label: cat.name,
                            value: cat.name,
                            emoji: cat.emoji || '🎫'
                        }))
                    );
                
                const row = new ActionRowBuilder().addComponents(selectMenu);
                const panelMsg = await channel.send({ embeds: [embed], components: [row] });
                
                // Save to database
                db.prepare('INSERT INTO ticket_panels (guild_id, channel_id, message_id, title, description, categories, config_name) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
                    guild.id,
                    channel.id,
                    panelMsg.id,
                    panelConfig.title,
                    panelConfig.description,
                    JSON.stringify(panelConfig.categories.map(c => c.name)),
                    panelName
                );
                
                await interaction.reply({ 
                    content: `✅ Panel "${panelConfig.title}" created in ${channel}!\n📋 Categories: ${panelConfig.categories.map(c => c.name).join(', ')}`, 
                    flags: MessageFlags.Ephemeral 
                });
            }
            
            else if (subcommand === 'refresh') {
                const panels = db.prepare('SELECT * FROM ticket_panels WHERE guild_id = ?').all(guild.id);
                
                if (panels.length === 0) {
                    return interaction.reply({ content: '❌ No panels found!', flags: MessageFlags.Ephemeral });
                }
                
                let refreshed = 0;
                let failed = 0;
                
                for (const panel of panels) {
                    try {
                        const channel = await guild.channels.fetch(panel.channel_id);
                        const message = await channel.messages.fetch(panel.message_id);
                        
                        // Recreate the dropdown from config if available
                        if (panel.config_name) {
                            const panelConfig = getPanelConfig(panel.config_name);
                            if (panelConfig) {
                                const selectMenu = new StringSelectMenuBuilder()
                                    .setCustomId(`ticket_dropdown_${panel.config_name}`)
                                    .setPlaceholder('Select a ticket type...')
                                    .addOptions(
                                        panelConfig.categories.map(cat => ({
                                            label: cat.name,
                                            value: cat.name,
                                            emoji: cat.emoji || '🎫'
                                        }))
                                    );
                                
                                const row = new ActionRowBuilder().addComponents(selectMenu);
                                await message.edit({ components: [row] });
                                refreshed++;
                            }
                        } else {
                            // Legacy panel - recreate from stored categories
                            const categories = JSON.parse(panel.categories);
                            const selectMenu = new StringSelectMenuBuilder()
                                .setCustomId('ticket_dropdown')
                                .setPlaceholder('Select a ticket type...')
                                .addOptions(
                                    categories.map(catName => ({
                                        label: catName,
                                        value: catName,
                                        emoji: '🎫'
                                    }))
                                );
                            
                            const row = new ActionRowBuilder().addComponents(selectMenu);
                            await message.edit({ components: [row] });
                            refreshed++;
                        }
                    } catch (error) {
                        console.error(`Failed to refresh panel ${panel.message_id}:`, error);
                        failed++;
                    }
                }
                
                await interaction.reply({ 
                    content: `✅ Refreshed ${refreshed} panel(s)${failed > 0 ? ` (${failed} failed)` : ''}`, 
                    flags: MessageFlags.Ephemeral 
                });
            }
            
            else if (subcommand === 'panel') {
                const channelOption = options.getChannel('channel');
                const title = options.getString('title');
                const description = options.getString('description');
                const categoriesInput = options.getString('categories');
                
                const requestedCategories = categoriesInput.split(',').map(c => c.trim()).filter(c => c.length > 0);
                
                if (requestedCategories.length === 0) {
                    return interaction.reply({ content: '❌ Please provide at least one category!', flags: MessageFlags.Ephemeral });
                }
                
                const channel = await guild.channels.fetch(channelOption.id);
                const allCategories = db.prepare('SELECT name FROM ticket_categories WHERE guild_id = ?').all(guild.id);
                const availableCategoryNames = allCategories.map(c => c.name);
                
                if (allCategories.length === 0) {
                    return interaction.reply({ content: '❌ No ticket categories found! Create some with `/ticket create` first.', flags: MessageFlags.Ephemeral });
                }
                
                const validCategories = requestedCategories.filter(cat => availableCategoryNames.includes(cat));
                const invalidCategories = requestedCategories.filter(cat => !availableCategoryNames.includes(cat));
                
                if (validCategories.length === 0) {
                    return interaction.reply({ 
                        content: `❌ None of the specified categories exist!\n\nAvailable: ${availableCategoryNames.join(', ')}`, 
                        flags: MessageFlags.Ephemeral 
                    });
                }
                
                let warningMessage = '';
                if (invalidCategories.length > 0) {
                    warningMessage = `\n⚠️ Skipped: ${invalidCategories.join(', ')}`;
                }
                
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(0xFFFFFF)
                    .setFooter({ text: 'Managed by overtimehosting' });
                
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('ticket_dropdown')
                    .setPlaceholder('Select a ticket type...')
                    .addOptions(
                        validCategories.map(catName => ({
                            label: catName,
                            value: catName
                        }))
                    );
                
                const row = new ActionRowBuilder().addComponents(selectMenu);
                const panelMsg = await channel.send({ embeds: [embed], components: [row] });
                
                db.prepare('INSERT INTO ticket_panels (guild_id, channel_id, message_id, title, description, categories, config_name) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
                    guild.id,
                    channel.id,
                    panelMsg.id,
                    title,
                    description,
                    JSON.stringify(validCategories),
                    null
                );
                
                await interaction.reply({ 
                    content: `✅ Panel created in ${channel}!\n🏷️ Categories: ${validCategories.join(', ')}${warningMessage}`, 
                    flags: MessageFlags.Ephemeral 
                });
            }
            
            else if (subcommand === 'create') {
                const title = options.getString('title');
                const role = options.getRole('role');
                
                const exists = db.prepare('SELECT name FROM ticket_categories WHERE guild_id = ? AND name = ?').get(guild.id, title);
                if (exists) {
                    return interaction.reply({ content: `❌ Category **${title}** already exists!`, flags: MessageFlags.Ephemeral });
                }
                
                const roles = role ? JSON.stringify([role.id]) : JSON.stringify([]);
                db.prepare('INSERT INTO ticket_categories VALUES (?, ?, ?)').run(guild.id, title, roles);
                
                const roleText = role ? ` (Role: ${role})` : '';
                await interaction.reply({ content: `✅ Created category: **${title}**${roleText}`, flags: MessageFlags.Ephemeral });
            }
            
            else if (subcommand === 'list') {
                const tickets = db.prepare('SELECT channel_id, user_id, category, created_at FROM active_tickets WHERE guild_id = ? AND (status = "open" OR status IS NULL)').all(guild.id);
                
                if (tickets.length === 0) {
                    return interaction.reply({ content: '📋 No active tickets!', flags: MessageFlags.Ephemeral });
                }
                
                const embed = new EmbedBuilder()
                    .setTitle('🎫 Active Tickets')
                    .setDescription(`Total: ${tickets.length}`)
                    .setColor(0xFFFFFF)
                    .setFooter({ text: 'Managed by overtimehosting' });
                
                for (const ticket of tickets) {
                    const user = await guild.members.fetch(ticket.user_id).catch(() => null);
                    const userName = user ? `<@${user.id}>` : `User ID: ${ticket.user_id}`;
                    embed.addFields({
                        name: `#${ticket.category}`,
                        value: `Channel: <#${ticket.channel_id}>\nUser: ${userName}\nCreated: ${ticket.created_at.substring(0, 10)}`,
                        inline: true
                    });
                }
                
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            
            else if (subcommand === 'alerts') {
                const exists = db.prepare('SELECT user_id FROM ticket_alerts WHERE guild_id = ? AND user_id = ?').get(guild.id, interaction.user.id);
                
                if (exists) {
                    db.prepare('DELETE FROM ticket_alerts WHERE guild_id = ? AND user_id = ?').run(guild.id, interaction.user.id);
                    await interaction.reply({ content: '🔕 Alerts disabled', flags: MessageFlags.Ephemeral });
                } else {
                    db.prepare('INSERT INTO ticket_alerts VALUES (?, ?)').run(guild.id, interaction.user.id);
                    await interaction.reply({ content: '🔔 Alerts enabled!', flags: MessageFlags.Ephemeral });
                }
            }
            
            else if (subcommand === 'categories') {
                const categories = db.prepare('SELECT name, roles FROM ticket_categories WHERE guild_id = ?').all(guild.id);
                
                if (categories.length === 0) {
                    return interaction.reply({ content: '📋 No categories found!', flags: MessageFlags.Ephemeral });
                }
                
                const embed = new EmbedBuilder()
                    .setTitle('🏷️ Available Categories')
                    .setDescription(`Total: ${categories.length}`)
                    .setColor(0xFFFFFF)
                    .setFooter({ text: 'Managed by overtimehosting' });
                
                for (const cat of categories) {
                    const roleIds = JSON.parse(cat.roles);
                    let roleText = 'Support ticket';
                    
                    if (roleIds.length > 0) {
                        const roles = roleIds.map(id => {
                            const role = guild.roles.cache.get(id);
                            return role ? role.name : 'Unknown';
                        });
                        roleText = `Role: ${roles.join(', ')}`;
                    }
                    
                    embed.addFields({ name: `\`${cat.name}\``, value: roleText, inline: false });
                }
                
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            
            else if (subcommand === 'close') {
                if (isFromDM) {
                    return interaction.reply({ content: '❌ Cannot close tickets from DMs!', flags: MessageFlags.Ephemeral });
                }
                
                const ticket = db.prepare('SELECT user_id, category FROM active_tickets WHERE channel_id = ?').get(interaction.channelId);
                
                if (!ticket) {
                    return interaction.reply({ content: '❌ Not a ticket channel!', flags: MessageFlags.Ephemeral });
                }
                
                const isOwner = ticket.user_id === interaction.user.id;
                const isAdmin = hasAdminOrBypass(interaction);
                
                if (!isOwner && !isAdmin) {
                    return interaction.reply({ content: '❌ You can only close your own tickets!', flags: MessageFlags.Ephemeral });
                }
                
                await interaction.reply('🔒 Closing in 5 seconds...');
                
                setTimeout(async () => {
                    db.prepare('DELETE FROM active_tickets WHERE channel_id = ?').run(interaction.channelId);
                    await interaction.channel.delete();
                }, 5000);
            }
            
            else if (subcommand === 'menu') {
                if (isFromDM) {
                    return interaction.reply({ content: '❌ Cannot use menu from DMs!', flags: MessageFlags.Ephemeral });
                }
                
                const ticket = db.prepare('SELECT user_id, category, status, form_data FROM active_tickets WHERE channel_id = ?').get(interaction.channelId);
                
                if (!ticket) {
                    return interaction.reply({ content: '❌ Not a ticket channel!', flags: MessageFlags.Ephemeral });
                }
                
                const ticketUser = await guild.members.fetch(ticket.user_id).catch(() => null);
                const userName = ticketUser ? ticketUser.user.tag : `Unknown (${ticket.user_id})`;
                
                const categoryData = db.prepare('SELECT roles FROM ticket_categories WHERE guild_id = ? AND name = ?').get(guild.id, ticket.category);
                const hasRoles = categoryData && JSON.parse(categoryData.roles).length > 0;
                
                const embed = new EmbedBuilder()
                    .setTitle('🎫 Ticket Information')
                    .setColor(0xFFFFFF)
                    .addFields(
                        { name: '👤 User', value: ticketUser ? `${ticketUser}` : userName, inline: true },
                        { name: '🏷️ Category', value: ticket.category, inline: true },
                        { name: '📄 Status', value: ticket.status === 'closed' ? 'Closed' : 'Open', inline: true }
                    )
                    .setFooter({ text: 'Managed by overtimehosting' });
                
                // Add form data if exists
                if (ticket.form_data) {
                    try {
                        const formData = JSON.parse(ticket.form_data);
                        const formFields = Object.entries(formData)
                            .map(([key, value]) => `**${key.replace(/_/g, ' ').toUpperCase()}:** ${value}`)
                            .join('\n');
                        embed.addFields({ name: '📋 Form Data', value: formFields, inline: false });
                    } catch (e) {}
                }
                
                if (hasRoles && ticket.status !== 'closed') {
                    const approveBtn = new ButtonBuilder()
                        .setCustomId(`approve_ticket_${interaction.channelId}`)
                        .setLabel('Approve')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅');
                    
                    const denyBtn = new ButtonBuilder()
                        .setCustomId(`deny_ticket_${interaction.channelId}`)
                        .setLabel('Deny')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌');
                    
                    const closeBtn = new ButtonBuilder()
                        .setCustomId(`close_ticket_menu_${interaction.channelId}`)
                        .setLabel('Close')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔒');
                    
                    const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn, closeBtn);
                    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
                } else {
                    const closeBtn = new ButtonBuilder()
                        .setCustomId(`close_ticket_menu_${interaction.channelId}`)
                        .setLabel('Close')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒');
                    
                    const row = new ActionRowBuilder().addComponents(closeBtn);
                    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
                }
            }
        }
    }
    
    // Handle dropdown - REMOVED RESTRICTION - Multi-use enabled!
    else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_dropdown')) {
        if (!interaction.guild) return;
        const guild = interaction.guild;
        
        const category = interaction.values[0];
        
        // Extract panel name if it's a config-based dropdown
        const panelName = interaction.customId.replace('ticket_dropdown_', '') || null;
        const categoryConfig = panelName ? getCategoryConfig(panelName, category) : null;
        
        // NO RESTRICTION - Users can create unlimited tickets!
        
        // Check if category needs a form
        if (categoryConfig && categoryConfig.form) {
            // Show modal
            const modal = new ModalBuilder()
                .setCustomId(`ticket_form_${panelName}_${category}`)
                .setTitle(categoryConfig.form.title);
            
            const rows = [];
            for (const field of categoryConfig.form.fields) {
                const textInput = new TextInputBuilder()
                    .setCustomId(field.id)
                    .setLabel(field.label)
                    .setStyle(field.style === 'long' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setPlaceholder(field.placeholder || '')
                    .setRequired(field.required !== false);
                
                rows.push(new ActionRowBuilder().addComponents(textInput));
            }
            
            modal.addComponents(...rows.slice(0, 5)); // Discord limit: 5 components
            await interaction.showModal(modal);
        } else {
            // Create ticket without form
            await createTicket(interaction, guild, category, categoryConfig, {});
        }
    }
    
    // Handle modal submit
    else if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_form_')) {
        if (!interaction.guild) return;
        const guild = interaction.guild;
        
        const parts = interaction.customId.split('_');
        const panelName = parts[2];
        const category = parts.slice(3).join('_');
        
        const categoryConfig = getCategoryConfig(panelName, category);
        
        // Collect form data
        const formData = {};
        if (categoryConfig && categoryConfig.form) {
            for (const field of categoryConfig.form.fields) {
                try {
                    const value = interaction.fields.getTextInputValue(field.id);
                    if (value) {
                        formData[field.id] = value;
                    }
                } catch (e) {
                    // Field might not be required and empty
                }
            }
        }
        
        await createTicket(interaction, guild, category, categoryConfig, formData);
    }
    
    // Handle buttons
    else if (interaction.isButton()) {
        if (!interaction.guild) return;
        const guild = interaction.guild;
        
        if (interaction.customId.startsWith('approve_ticket_')) {
            if (!hasAdminOrBypass(interaction)) {
                return interaction.reply({ content: '❌ Admin only!', flags: MessageFlags.Ephemeral });
            }
            
            const channelId = interaction.customId.replace('approve_ticket_', '');
            const ticket = db.prepare('SELECT user_id, category FROM active_tickets WHERE channel_id = ?').get(channelId);
            
            if (!ticket) {
                return interaction.reply({ content: '❌ Ticket not found!', flags: MessageFlags.Ephemeral });
            }
            
            const categoryData = db.prepare('SELECT roles FROM ticket_categories WHERE guild_id = ? AND name = ?').get(guild.id, ticket.category);
            const roleIds = categoryData ? JSON.parse(categoryData.roles) : [];
            const ticketUser = await guild.members.fetch(ticket.user_id).catch(() => null);
            
            if (!ticketUser) {
                return interaction.reply({ content: '❌ User not found!', flags: MessageFlags.Ephemeral });
            }
            
            let rolesGiven = [];
            for (const roleId of roleIds) {
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    try {
                        await ticketUser.roles.add(role);
                        rolesGiven.push(role.name);
                    } catch (e) {}
                }
            }
            
            const approveEmbed = new EmbedBuilder()
                .setTitle('✅ Ticket Approved')
                .setDescription(`Your ticket has been approved!${rolesGiven.length > 0 ? `\n\n**Roles given:** ${rolesGiven.join(', ')}` : ''}`)
                .setColor(0x00FF00)
                .setFooter({ text: 'Managed by overtimehosting' });
            
            await interaction.channel.send({ embeds: [approveEmbed] });
            await interaction.reply({ content: `✅ Approved!${rolesGiven.length > 0 ? ` Gave: ${rolesGiven.join(', ')}` : ''}`, flags: MessageFlags.Ephemeral });
            
            try {
                await interaction.message.edit({ components: [] });
            } catch (e) {}
        }
        
        else if (interaction.customId.startsWith('deny_ticket_')) {
            if (!hasAdminOrBypass(interaction)) {
                return interaction.reply({ content: '❌ Admin only!', flags: MessageFlags.Ephemeral });
            }
            
            const channelId = interaction.customId.replace('deny_ticket_', '');
            const ticket = db.prepare('SELECT user_id FROM active_tickets WHERE channel_id = ?').get(channelId);
            
            if (ticket) {
                const ticketUser = await guild.members.fetch(ticket.user_id).catch(() => null);
                if (ticketUser) {
                    try {
                        await ticketUser.send(`❌ Your ticket in **${guild.name}** was denied.`);
                    } catch (e) {}
                }
            }
            
            await interaction.reply({ content: '❌ Denied! Closing...', flags: MessageFlags.Ephemeral });
            await interaction.channel.send('❌ **Ticket denied. Closing...**');
            
            setTimeout(async () => {
                db.prepare('DELETE FROM active_tickets WHERE channel_id = ?').run(channelId);
                await interaction.channel.delete();
            }, 5000);
        }
        
        else if (interaction.customId.startsWith('close_ticket_menu_')) {
            if (!hasAdminOrBypass(interaction)) {
                return interaction.reply({ content: '❌ Admin only!', flags: MessageFlags.Ephemeral });
            }
            
            const channelId = interaction.customId.replace('close_ticket_menu_', '');
            
            await interaction.reply({ content: '🔒 Closing...', flags: MessageFlags.Ephemeral });
            await interaction.channel.send('🔒 **Closing...**');
            
            setTimeout(async () => {
                db.prepare('DELETE FROM active_tickets WHERE channel_id = ?').run(channelId);
                await interaction.channel.delete();
            }, 5000);
        }
    }
    } catch (error) {
        console.error('Error:', error);
        if (interaction.isRepliable && !interaction.replied && !interaction.deferred) {
            interaction.reply({ content: '❌ Error!', flags: MessageFlags.Ephemeral }).catch(console.error);
        }
    }
});

// Helper function to create ticket
async function createTicket(interaction, guild, category, categoryConfig, formData) {
    try {
        // Get roles from config first, then fallback to database
        let roleIds = [];
        if (categoryConfig && categoryConfig.roles) {
            roleIds = categoryConfig.roles;
        } else {
            const catData = db.prepare('SELECT roles FROM ticket_categories WHERE guild_id = ? AND name = ?').get(guild.id, category);
            roleIds = catData ? JSON.parse(catData.roles) : [];
        }
        
        // Permissions
        const permissionOverwrites = [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ];
        
        guild.roles.cache.forEach(role => {
            if (role.permissions.has(PermissionFlagsBits.Administrator)) {
                permissionOverwrites.push({
                    id: role.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                });
            }
        });
        
        // Get/create category
        let openCategory = guild.channels.cache.find(c => c.name === 'Open Tickets' && c.type === ChannelType.GuildCategory);
        if (!openCategory) {
            openCategory = await guild.channels.create({
                name: 'Open Tickets',
                type: ChannelType.GuildCategory
            });
        }
        
        // Determine channel name
        let channelName = `ticket-${interaction.user.username}`;
        if (categoryConfig && categoryConfig.channelName) {
            channelName = formatChannelName(categoryConfig.channelName, interaction.user.username, formData);
        }
        
        // Add a unique number to avoid name conflicts
        const timestamp = Date.now().toString().slice(-4);
        channelName = `${channelName}-${timestamp}`;
        
        // Create channel
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: openCategory.id,
            topic: `Ticket by ${interaction.user.username} | ${category}`,
            permissionOverwrites
        });
        
        // Save to DB
        db.prepare('INSERT INTO active_tickets (guild_id, channel_id, user_id, category, created_at, status, form_data) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            guild.id,
            ticketChannel.id,
            interaction.user.id,
            category,
            new Date().toISOString(),
            'open',
            Object.keys(formData).length > 0 ? JSON.stringify(formData) : null
        );
        
        // Send alerts
        const alertUsers = db.prepare('SELECT user_id FROM ticket_alerts WHERE guild_id = ?').all(guild.id);
        for (const { user_id } of alertUsers) {
            const user = await guild.members.fetch(user_id).catch(() => null);
            if (user) {
                try {
                    await user.send(`🎫 New ticket in **${guild.name}**\nCategory: **${category}**\nBy: ${interaction.user}\nChannel: ${ticketChannel}`);
                } catch (e) {}
            }
        }
        
        // Create embed
        const embed = new EmbedBuilder()
            .setTitle(`🎫 Ticket - ${category}`)
            .setDescription(`Welcome ${interaction.user}!\n\nA staff member will be with you shortly.\n\n🔒 Close with \`/ticket close\``)
            .setColor(0xFFFFFF)
            .addFields(
                { name: 'Category', value: category, inline: true },
                { name: 'Opened by', value: `${interaction.user}`, inline: true }
            )
            .setFooter({ text: 'Managed by overtimehosting' });
        
        // Add form data to embed
        if (Object.keys(formData).length > 0) {
            const formFields = Object.entries(formData)
                .map(([key, value]) => `**${key.replace(/_/g, ' ').toUpperCase()}:** ${value}`)
                .join('\n');
            embed.addFields({ name: '📋 Information Provided', value: formFields, inline: false });
        }
        
        await ticketChannel.send({ embeds: [embed] });
        await interaction.reply({ content: `✅ Ticket created! ${ticketChannel}`, flags: MessageFlags.Ephemeral });
    } catch (error) {
        console.error('Error creating ticket:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Failed to create ticket!', flags: MessageFlags.Ephemeral });
        }
    }
}

// Login
client.login(process.env.DISCORD_TOKEN);

// Error handlers
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});
