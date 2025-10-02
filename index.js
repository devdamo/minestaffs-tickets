require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const Database = require('better-sqlite3');
const db = new Database('tickets.db');

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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: []
});

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
                    name: 'panel',
                    description: 'Create a ticket panel',
                    type: 1,
                    default_member_permissions: '8', // Administrator
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
                            description: 'Categories to include (comma separated, e.g: Support,Bug Report,Applications)',
                            type: 3,
                            required: true
                        }
                    ]
                },
                {
                    name: 'create',
                    description: 'Create a new ticket category',
                    type: 1,
                    default_member_permissions: '8', // Administrator
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
                    type: 1,
                    default_member_permissions: '8' // Administrator
                },
                {
                    name: 'alerts',
                    description: 'Toggle DM notifications for new tickets',
                    type: 1,
                    default_member_permissions: '8' // Administrator
                },
                {
                    name: 'categories',
                    description: 'List all available ticket categories',
                    type: 1,
                    default_member_permissions: '8' // Administrator
                },
                {
                    name: 'close',
                    description: 'Close the current ticket',
                    type: 1
                },
                {
                    name: 'menu',
                    description: 'Show ticket info and actions (admin only)',
                    type: 1,
                    default_member_permissions: '8' // Administrator
                }
            ]
        }
    ];

    try {
        await client.application.commands.set(commands);
        console.log('Slash commands registered!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Handle interactions
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            const { commandName, options } = interaction;
            
            // Must be used in a guild with available guild object
            if (!interaction.guild) {
                console.log('Command used outside guild - rejecting');
                return interaction.reply({ content: '❌ This command must be used in a Discord server!', flags: MessageFlags.Ephemeral }).catch(console.error);
            }
            
            const guild = interaction.guild;
            console.log(`Command ${commandName} used in guild: ${guild.name} (${guild.id})`);
        
        if (commandName === 'ticket') {
            const subcommand = options.getSubcommand();
            
            if (subcommand === 'panel') {
                const channelOption = options.getChannel('channel');
                const title = options.getString('title');
                const description = options.getString('description');
                const categoriesInput = options.getString('categories');
                
                // Parse categories from comma-separated input
                const requestedCategories = categoriesInput.split(',').map(c => c.trim()).filter(c => c.length > 0);
                
                if (requestedCategories.length === 0) {
                    return interaction.reply({ content: '❌ Please provide at least one category!', flags: MessageFlags.Ephemeral });
                }
                
                // Fetch the actual channel object from the guild
                const channel = await guild.channels.fetch(channelOption.id);
                
                // Get all available categories
                const allCategories = db.prepare('SELECT name FROM ticket_categories WHERE guild_id = ?').all(guild.id);
                const availableCategoryNames = allCategories.map(c => c.name);
                
                if (allCategories.length === 0) {
                    return interaction.reply({ content: '❌ No ticket categories found! Create some with `/ticket create` first.', flags: MessageFlags.Ephemeral });
                }
                
                // Validate that requested categories exist
                const validCategories = [];
                const invalidCategories = [];
                
                for (const reqCat of requestedCategories) {
                    if (availableCategoryNames.includes(reqCat)) {
                        validCategories.push(reqCat);
                    } else {
                        invalidCategories.push(reqCat);
                    }
                }
                
                if (validCategories.length === 0) {
                    return interaction.reply({ 
                        content: `❌ None of the specified categories exist!\n\nAvailable categories: ${availableCategoryNames.join(', ')}`, 
                        flags: MessageFlags.Ephemeral 
                    });
                }
                
                // Warn about invalid categories but continue with valid ones
                let warningMessage = '';
                if (invalidCategories.length > 0) {
                    warningMessage = `\n⚠️ Note: These categories don't exist and were skipped: ${invalidCategories.join(', ')}`;
                }
                
                // Create embed
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(0xFFFFFF)
                    .setFooter({ text: 'Managed by overtimehosting' });
                
                // Create dropdown with only the valid categories
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
                
                // Save panel with its specific categories
                db.prepare('INSERT INTO ticket_panels VALUES (?, ?, ?, ?, ?, ?)').run(
                    guild.id,
                    channel.id,
                    panelMsg.id,
                    title,
                    description,
                    JSON.stringify(validCategories)
                );
                
                const successMsg = `✅ Ticket panel created in ${channel}!\n🏷️ Categories: ${validCategories.join(', ')}${warningMessage}`;
                await interaction.reply({ content: successMsg, flags: MessageFlags.Ephemeral });
            }
            
            else if (subcommand === 'create') {
                const title = options.getString('title');
                const role = options.getRole('role');
                
                // Check if exists
                const exists = db.prepare('SELECT name FROM ticket_categories WHERE guild_id = ? AND name = ?').get(guild.id, title);
                if (exists) {
                    return interaction.reply({ content: `❌ Category **${title}** already exists!`, flags: MessageFlags.Ephemeral });
                }
                
                const roles = role ? JSON.stringify([role.id]) : JSON.stringify([]);
                db.prepare('INSERT INTO ticket_categories VALUES (?, ?, ?)').run(guild.id, title, roles);
                
                const roleText = role ? ` (Role: ${role})` : '';
                await interaction.reply({ content: `✅ Created ticket category: **${title}**${roleText}`, flags: MessageFlags.Ephemeral });
            }
            
            else if (subcommand === 'list') {
                const tickets = db.prepare('SELECT channel_id, user_id, category, created_at FROM active_tickets WHERE guild_id = ?').all(guild.id);
                
                if (tickets.length === 0) {
                    return interaction.reply({ content: '📋 No active tickets found!', flags: MessageFlags.Ephemeral });
                }
                
                const embed = new EmbedBuilder()
                    .setTitle('🎫 Active Tickets')
                    .setDescription(`Total: ${tickets.length} ticket(s)`)
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
                    await interaction.reply({ content: '🔕 Ticket alerts **disabled**', flags: MessageFlags.Ephemeral });
                } else {
                    db.prepare('INSERT INTO ticket_alerts VALUES (?, ?)').run(guild.id, interaction.user.id);
                    await interaction.reply({ content: '🔔 Ticket alerts **enabled**! You\'ll receive DMs when tickets are opened.', flags: MessageFlags.Ephemeral });
                }
            }
            
            else if (subcommand === 'categories') {
                const categories = db.prepare('SELECT name, roles FROM ticket_categories WHERE guild_id = ?').all(guild.id);
                
                if (categories.length === 0) {
                    return interaction.reply({ content: '📋 No ticket categories found! Create some with `/ticket create` first.', flags: MessageFlags.Ephemeral });
                }
                
                const embed = new EmbedBuilder()
                    .setTitle('🏷️ Available Ticket Categories')
                    .setDescription(`Total: ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}\n\n**Use these names when creating panels:**`)
                    .setColor(0xFFFFFF)
                    .setFooter({ text: 'Managed by overtimehosting' });
                
                for (const cat of categories) {
                    const roleIds = JSON.parse(cat.roles);
                    let roleText = 'No role (support ticket)';
                    
                    if (roleIds.length > 0) {
                        const roles = roleIds.map(id => {
                            const role = guild.roles.cache.get(id);
                            return role ? role.name : 'Unknown Role';
                        });
                        roleText = `Role given on approval: ${roles.join(', ')}`;
                    }
                    
                    embed.addFields({
                        name: `\`${cat.name}\``,
                        value: roleText,
                        inline: false
                    });
                }
                
                embed.addFields({
                    name: '💡 Example Usage',
                    value: '`/ticket panel channel:#tickets title:Support categories:' + categories.slice(0, 2).map(c => c.name).join(',') + '`',
                    inline: false
                });
                
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            
            else if (subcommand === 'close') {
                // Check if this is a ticket channel
                const ticket = db.prepare('SELECT user_id, category FROM active_tickets WHERE channel_id = ?').get(interaction.channelId);
                
                if (!ticket) {
                    return interaction.reply({ content: '❌ This command can only be used in ticket channels!', flags: MessageFlags.Ephemeral });
                }
                
                // Check if user is ticket owner or has admin perms
                const isOwner = ticket.user_id === interaction.user.id;
                const isAdmin = interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
                
                if (!isOwner && !isAdmin) {
                    return interaction.reply({ content: '❌ You can only close your own tickets!', flags: MessageFlags.Ephemeral });
                }
                
                await interaction.reply('🔒 Closing ticket in 5 seconds...');
                
                setTimeout(async () => {
                    // Delete from database
                    db.prepare('DELETE FROM active_tickets WHERE channel_id = ?').run(interaction.channelId);
                    
                    if (isOwner && !isAdmin) {
                        // User closed their own ticket - delete it completely
                        await interaction.channel.delete();
                    } else {
                        // Admin closed ticket - move to closed category for record keeping
                        let closedCategory = guild.channels.cache.find(c => c.name === 'Closed Tickets' && c.type === ChannelType.GuildCategory);
                        
                        if (closedCategory) {
                            try {
                                await interaction.channel.setParent(closedCategory.id);
                                // Remove ticket owner's access
                                await interaction.channel.permissionOverwrites.edit(ticket.user_id, {
                                    ViewChannel: false
                                });
                                await interaction.channel.permissionOverwrites.edit(guild.id, {
                                    SendMessages: false
                                });
                                await interaction.channel.send('🔒 **Ticket closed!**');
                            } catch (e) {
                                console.error('Error moving ticket:', e);
                                await interaction.channel.delete();
                            }
                        } else {
                            // No closed category, just delete
                            await interaction.channel.delete();
                        }
                    }
                }, 5000);
            }
            
            else if (subcommand === 'menu') {
                // Check if this is a ticket channel
                const ticket = db.prepare('SELECT user_id, category FROM active_tickets WHERE channel_id = ?').get(interaction.channelId);
                
                if (!ticket) {
                    return interaction.reply({ content: '❌ This command can only be used in ticket channels!', flags: MessageFlags.Ephemeral });
                }
                
                // Get ticket info
                const ticketUser = await guild.members.fetch(ticket.user_id).catch(() => null);
                const userName = ticketUser ? ticketUser.user.tag : `Unknown User (${ticket.user_id})`;
                
                // Get category info (check if it has roles for approval)
                const categoryData = db.prepare('SELECT roles FROM ticket_categories WHERE guild_id = ? AND name = ?').get(guild.id, ticket.category);
                const hasRoles = categoryData && JSON.parse(categoryData.roles).length > 0;
                
                // Create info embed
                const embed = new EmbedBuilder()
                    .setTitle('🎫 Ticket Information')
                    .setColor(0xFFFFFF)
                    .addFields(
                        { name: '👤 Opened By', value: ticketUser ? `${ticketUser} (${userName})` : userName, inline: true },
                        { name: '🏷️ Category', value: ticket.category, inline: true },
                        { name: '📝 Channel', value: `<#${interaction.channelId}>`, inline: true },
                        { name: '✅ Approval Required', value: hasRoles ? 'Yes' : 'No', inline: true }
                    )
                    .setFooter({ text: 'Managed by overtimehosting' });
                
                // Add approve/deny buttons if roles exist (approval needed)
                if (hasRoles) {
                    const approveButton = new ButtonBuilder()
                        .setCustomId(`approve_ticket_${interaction.channelId}`)
                        .setLabel('Approve')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅');
                    
                    const denyButton = new ButtonBuilder()
                        .setCustomId(`deny_ticket_${interaction.channelId}`)
                        .setLabel('Deny')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌');
                    
                    const closeButton = new ButtonBuilder()
                        .setCustomId(`close_ticket_menu_${interaction.channelId}`)
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔒');
                    
                    const row = new ActionRowBuilder().addComponents(approveButton, denyButton, closeButton);
                    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
                } else {
                    // No approval needed, just show close button
                    const closeButton = new ButtonBuilder()
                        .setCustomId(`close_ticket_menu_${interaction.channelId}`)
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒');
                    
                    const row = new ActionRowBuilder().addComponents(closeButton);
                    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
                }
            }
            
            else if (subcommand === 'menu') {
                // Check if this is a ticket channel
                const ticket = db.prepare('SELECT user_id, category FROM active_tickets WHERE channel_id = ?').get(interaction.channelId);
                
                if (!ticket) {
                    return interaction.reply({ content: '❌ This command can only be used in ticket channels!', flags: MessageFlags.Ephemeral });
                }
                
                // Get ticket info
                const ticketUser = await guild.members.fetch(ticket.user_id).catch(() => null);
                const userName = ticketUser ? ticketUser.user.tag : `Unknown User (${ticket.user_id})`;
                
                // Get category info (check if it has roles for approval)
                const categoryData = db.prepare('SELECT roles FROM ticket_categories WHERE guild_id = ? AND name = ?').get(guild.id, ticket.category);
                const hasRoles = categoryData && JSON.parse(categoryData.roles).length > 0;
                
                // Create info embed
                const embed = new EmbedBuilder()
                    .setTitle('🎫 Ticket Information')
                    .setColor(0xFFFFFF)
                    .addFields(
                        { name: '👤 Opened By', value: ticketUser ? `${ticketUser} (${userName})` : userName, inline: true },
                        { name: '🏷️ Category', value: ticket.category, inline: true },
                        { name: '📝 Channel', value: `<#${interaction.channelId}>`, inline: true },
                        { name: '✅ Approval Required', value: hasRoles ? 'Yes' : 'No', inline: true }
                    )
                    .setFooter({ text: 'Managed by overtimehosting' });
                
                // Add approve/deny buttons if roles exist (approval needed)
                if (hasRoles) {
                    const approveButton = new ButtonBuilder()
                        .setCustomId(`approve_ticket_${interaction.channelId}`)
                        .setLabel('Approve')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅');
                    
                    const denyButton = new ButtonBuilder()
                        .setCustomId(`deny_ticket_${interaction.channelId}`)
                        .setLabel('Deny')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌');
                    
                    const closeButton = new ButtonBuilder()
                        .setCustomId(`close_ticket_menu_${interaction.channelId}`)
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔒');
                    
                    const row = new ActionRowBuilder().addComponents(approveButton, denyButton, closeButton);
                    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
                } else {
                    // No approval needed, just show close button
                    const closeButton = new ButtonBuilder()
                        .setCustomId(`close_ticket_menu_${interaction.channelId}`)
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒');
                    
                    const row = new ActionRowBuilder().addComponents(closeButton);
                    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
                }
            }
        }
    }
    
    // Handle dropdown selection
    else if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_dropdown') {
        if (!interaction.guild) return;
        const guild = interaction.guild;
        
        const category = interaction.values[0];
        
        // Check if user already has a ticket
        const existing = db.prepare('SELECT channel_id FROM active_tickets WHERE guild_id = ? AND user_id = ?').get(guild.id, interaction.user.id);
        
        if (existing) {
            // Verify the channel actually exists
            const channelExists = await guild.channels.fetch(existing.channel_id).catch(() => null);
            
            if (channelExists) {
                // Channel exists, deny
                return interaction.reply({ content: `❌ You already have an active ticket: <#${existing.channel_id}>`, flags: MessageFlags.Ephemeral });
            } else {
                // Channel was deleted but database still has it, clean it up
                db.prepare('DELETE FROM active_tickets WHERE channel_id = ?').run(existing.channel_id);
                console.log(`Cleaned up orphaned ticket record for user ${interaction.user.id}`);
            }
        }
        
        // Check how many tickets this user has opened for this category
        const userCategoryTickets = db.prepare('SELECT channel_id FROM active_tickets WHERE guild_id = ? AND user_id = ? AND category = ?').all(guild.id, interaction.user.id, category);
        
        // Verify each ticket channel exists and clean up orphaned records
        let validTicketCount = 0;
        for (const ticket of userCategoryTickets) {
            const channelExists = await guild.channels.fetch(ticket.channel_id).catch(() => null);
            if (channelExists) {
                validTicketCount++;
            } else {
                // Clean up orphaned record
                db.prepare('DELETE FROM active_tickets WHERE channel_id = ?').run(ticket.channel_id);
                console.log(`Cleaned up orphaned ticket record for channel ${ticket.channel_id}`);
            }
        }
        
        // Check if user has reached limit for this category
        if (validTicketCount >= 4) {
            return interaction.reply({ content: `❌ You have reached the maximum of 4 tickets for **${category}**. Please close some tickets before opening more.`, flags: MessageFlags.Ephemeral });
        }
        
        // Get roles for category (only used for approval, NOT for permissions)
        const catData = db.prepare('SELECT roles FROM ticket_categories WHERE guild_id = ? AND name = ?').get(guild.id, category);
        const roleIds = catData ? JSON.parse(catData.roles) : [];
        
        // Create permissions - ONLY user, bot, and admins can see
        const permissionOverwrites = [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: interaction.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            },
            {
                id: client.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            }
        ];
        
        // Add admin roles (not the category role!)
        // Find roles with Administrator permission
        guild.roles.cache.forEach(role => {
            if (role.permissions.has(PermissionFlagsBits.Administrator)) {
                permissionOverwrites.push({
                    id: role.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                });
            }
        });
        
        // Find or create Open Tickets category
        let openCategory = guild.channels.cache.find(c => c.name === 'Open Tickets' && c.type === ChannelType.GuildCategory);
        
        if (!openCategory) {
            openCategory = await guild.channels.create({
                name: 'Open Tickets',
                type: ChannelType.GuildCategory
            });
        }
        
        // Also create Closed Tickets category if it doesn't exist
        let closedCategory = guild.channels.cache.find(c => c.name === 'Closed Tickets' && c.type === ChannelType.GuildCategory);
        
        if (!closedCategory) {
            closedCategory = await guild.channels.create({
                name: 'Closed Tickets',
                type: ChannelType.GuildCategory
            });
        }
        
        // Create ticket channel
        const ticketChannel = await guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: openCategory.id,
            topic: `Ticket by ${interaction.user.username} | ${category}`,
            permissionOverwrites
        });
        
        // Save to database
        db.prepare('INSERT INTO active_tickets VALUES (?, ?, ?, ?, ?)').run(
            guild.id,
            ticketChannel.id,
            interaction.user.id,
            category,
            new Date().toISOString()
        );
        
        // Send alerts
        const alertUsers = db.prepare('SELECT user_id FROM ticket_alerts WHERE guild_id = ?').all(guild.id);
        for (const { user_id } of alertUsers) {
            const user = await guild.members.fetch(user_id).catch(() => null);
            if (user) {
                try {
                    await user.send(`🎫 New ticket opened in **${guild.name}**\nCategory: **${category}**\nBy: ${interaction.user}\nChannel: ${ticketChannel}`);
                } catch (e) {
                    console.log(`Could not send DM to ${user.user.tag} - DMs may be disabled`);
                }
            }
        }
        
        // Create ticket embed
        const embed = new EmbedBuilder()
            .setTitle(`🎫 Ticket - ${category}`)
            .setDescription(`Welcome ${interaction.user}!\n\nPlease describe your issue and a staff member will be with you shortly.\n\n🔒 To close this ticket, use \`/ticket close\``)
            .setColor(0xFFFFFF)
            .addFields(
                { name: 'Category', value: category, inline: true },
                { name: 'Opened by', value: `${interaction.user}`, inline: true }
            )
            .setFooter({ text: 'Managed by overtimehosting' });
        
        await ticketChannel.send({ embeds: [embed] });
        await interaction.reply({ content: `✅ Ticket created! ${ticketChannel}`, flags: MessageFlags.Ephemeral });
    }
    
    // Handle close button (legacy, admin only)
    else if (interaction.isButton() && interaction.customId.startsWith('close_ticket_')) {
        if (!interaction.guild) return;
        
        // Only admins can use the button
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Only administrators can use this button! Use `/ticket close` instead.', flags: MessageFlags.Ephemeral });
        }
        
        const channelId = interaction.customId.replace('close_ticket_', '');
        
        await interaction.reply('🔒 Closing ticket in 5 seconds...');
        
        setTimeout(async () => {
            db.prepare('DELETE FROM active_tickets WHERE channel_id = ?').run(channelId);
            await interaction.channel.delete();
        }, 5000);
    }
    
    // Handle approve button
    else if (interaction.isButton() && interaction.customId.startsWith('approve_ticket_')) {
        if (!interaction.guild) return;
        const guild = interaction.guild;
        
        // Only admins
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Only administrators can use this button!', flags: MessageFlags.Ephemeral });
        }
        
        const channelId = interaction.customId.replace('approve_ticket_', '');
        
        // Get ticket info
        const ticket = db.prepare('SELECT user_id, category FROM active_tickets WHERE channel_id = ?').get(channelId);
        
        if (!ticket) {
            return interaction.reply({ content: '❌ Ticket not found!', flags: MessageFlags.Ephemeral });
        }
        
        // Get the roles for this category
        const categoryData = db.prepare('SELECT roles FROM ticket_categories WHERE guild_id = ? AND name = ?').get(guild.id, ticket.category);
        const roleIds = categoryData ? JSON.parse(categoryData.roles) : [];
        
        // Get the user
        const ticketUser = await guild.members.fetch(ticket.user_id).catch(() => null);
        
        if (!ticketUser) {
            return interaction.reply({ content: '❌ Could not find the user!', flags: MessageFlags.Ephemeral });
        }
        
        // Give the user the role(s)
        let rolesGiven = [];
        let rolesFailed = [];
        
        for (const roleId of roleIds) {
            const role = guild.roles.cache.get(roleId);
            if (role) {
                try {
                    await ticketUser.roles.add(role);
                    rolesGiven.push(role.name);
                    console.log(`Gave role ${role.name} to ${ticketUser.user.tag}`);
                } catch (e) {
                    rolesFailed.push(role.name);
                    console.error(`Failed to give role ${role.name} to ${ticketUser.user.tag}:`, e);
                }
            }
        }
        
        // Create approval message
        let approvalDescription = 'Your ticket has been approved!';
        
        if (rolesGiven.length > 0) {
            approvalDescription += `\n\n✅ **Role(s) given:** ${rolesGiven.join(', ')}`;
        }
        
        if (rolesFailed.length > 0) {
            approvalDescription += `\n\n⚠️ **Could not give:** ${rolesFailed.join(', ')}`;
        }
        
        approvalDescription += '\n\nA staff member will assist you shortly.';
        
        // Send approval message in ticket
        const approveEmbed = new EmbedBuilder()
            .setTitle('✅ Ticket Approved')
            .setDescription(approvalDescription)
            .setColor(0x00FF00)
            .setFooter({ text: 'Managed by overtimehosting' });
        
        await interaction.channel.send({ embeds: [approveEmbed] });
        
        // Reply to admin
        let adminReply = '✅ Ticket approved!';
        if (rolesGiven.length > 0) {
            adminReply += ` Gave ${rolesGiven.join(', ')} to ${ticketUser.user.tag}`;
        }
        if (rolesFailed.length > 0) {
            adminReply += ` (Failed to give: ${rolesFailed.join(', ')})`;
        }
        
        await interaction.reply({ content: adminReply, flags: MessageFlags.Ephemeral });
        
        // Update the menu message to remove buttons
        try {
            await interaction.message.edit({ components: [] });
        } catch (e) {}
    }
    
    // Handle deny button
    else if (interaction.isButton() && interaction.customId.startsWith('deny_ticket_')) {
        if (!interaction.guild) return;
        const guild = interaction.guild;
        
        // Only admins
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Only administrators can use this button!', flags: MessageFlags.Ephemeral });
        }
        
        const channelId = interaction.customId.replace('deny_ticket_', '');
        
        // Get ticket info
        const ticket = db.prepare('SELECT user_id, category FROM active_tickets WHERE channel_id = ?').get(channelId);
        
        if (!ticket) {
            return interaction.reply({ content: '❌ Ticket not found!', flags: MessageFlags.Ephemeral });
        }
        
        // Send DM to user
        const ticketUser = await guild.members.fetch(ticket.user_id).catch(() => null);
        let dmSent = false;
        
        if (ticketUser) {
            try {
                const denyEmbed = new EmbedBuilder()
                    .setTitle('❌ Ticket Denied')
                    .setDescription(`Your ticket in **${guild.name}** has been denied.\n\nCategory: **${ticket.category}**\n\nIf you have questions, please contact a staff member.`)
                    .setColor(0xFF0000)
                    .setFooter({ text: 'Managed by overtimehosting' });
                
                await ticketUser.send({ embeds: [denyEmbed] });
                dmSent = true;
                console.log(`Denial DM sent to ${ticketUser.user.tag}`);
            } catch (e) {
                console.log(`Could not send denial DM to ${ticketUser.user.tag} (${ticket.user_id}) - User may have DMs disabled or blocked the bot`);
            }
        } else {
            console.log(`Could not fetch user ${ticket.user_id} to send denial DM`);
        }
        
        // Inform admin if DM failed
        const replyMsg = dmSent 
            ? '❌ Ticket denied! User notified via DM. Closing in 5 seconds...' 
            : '❌ Ticket denied! (Could not DM user - they may have DMs disabled). Closing in 5 seconds...';
        
        await interaction.reply({ content: replyMsg, flags: MessageFlags.Ephemeral });
        await interaction.channel.send('❌ **Ticket has been denied by an administrator. Closing...**');
        
        setTimeout(async () => {
            // Delete from database
            db.prepare('DELETE FROM active_tickets WHERE channel_id = ?').run(channelId);
            
            // Try to find closed tickets category
            let closedCategory = guild.channels.cache.find(c => c.name === 'Closed Tickets' && c.type === ChannelType.GuildCategory);
            
            if (closedCategory) {
                try {
                    await interaction.channel.setParent(closedCategory.id);
                    await interaction.channel.permissionOverwrites.edit(guild.id, {
                        SendMessages: false
                    });
                    await interaction.channel.send('❌ **Ticket denied and closed!**');
                } catch (e) {
                    console.error('Error moving denied ticket:', e);
                    await interaction.channel.delete();
                }
            } else {
                await interaction.channel.delete();
            }
        }, 5000);
    }
    
    // Handle close button from menu
    else if (interaction.isButton() && interaction.customId.startsWith('close_ticket_menu_')) {
        if (!interaction.guild) return;
        const guild = interaction.guild;
        
        // Only admins
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Only administrators can close tickets!', flags: MessageFlags.Ephemeral });
        }
        
        const channelId = interaction.customId.replace('close_ticket_menu_', '');
        
        await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...', flags: MessageFlags.Ephemeral });
        await interaction.channel.send('🔒 **Ticket is being closed by an administrator...**');
        
        setTimeout(async () => {
            // Delete from database
            db.prepare('DELETE FROM active_tickets WHERE channel_id = ?').run(channelId);
            
            // Try to find closed tickets category
            let closedCategory = guild.channels.cache.find(c => c.name === 'Closed Tickets' && c.type === ChannelType.GuildCategory);
            
            if (closedCategory) {
                // Move to closed category and lock
                try {
                    await interaction.channel.setParent(closedCategory.id);
                    await interaction.channel.permissionOverwrites.edit(guild.id, {
                        SendMessages: false
                    });
                    await interaction.channel.send('🔒 **Ticket closed!**');
                } catch (e) {
                    console.error('Error moving ticket:', e);
                    await interaction.channel.delete();
                }
            } else {
                // No closed category, just delete
                await interaction.channel.delete();
            }
        }, 5000);
    }
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (interaction.isRepliable && !interaction.replied && !interaction.deferred) {
            interaction.reply({ content: '❌ An error occurred!', flags: MessageFlags.Ephemeral }).catch(console.error);
        }
    }
});

// Login
client.login(process.env.DISCORD_TOKEN || 'YOUR_BOT_TOKEN_HERE');

// Global error handlers to prevent crashes
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});