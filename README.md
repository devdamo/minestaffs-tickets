# 🎫 MineStaffs Ticket Bot

A feature-rich Discord ticket bot with approval system, categories, and admin controls.

## ✨ Features

- 🎯 **Dropdown ticket panels** - Easy ticket selection
- 🔐 **Private tickets** - Only ticket owner and admins can see
- 📩 **DM alerts** - Get notified when tickets are opened
- 🎨 **Clean white embeds** - Professional look with custom branding
- 🔒 **User-friendly closing** - `/ticket close` command for everyone
- 🎛️ **Admin ticket menu** - Review and approve/deny tickets
- 📁 **Auto categories** - "Open Tickets" and "Closed Tickets"
- ✅ **Approval system** - Approve or deny tickets with role rewards
- 🚫 **Duplicate prevention** - One ticket per user at a time
- 🔢 **Smart limits** - Max 4 tickets per category type per user
- 🧹 **Auto cleanup** - Removes orphaned database records if channels deleted
- 💾 **SQLite database** - Persistent data storage
- 🔒 **Privacy protection** - Roles are for rewards only, not viewing access

## 🔒 Privacy & Permissions

**IMPORTANT**: When you create a ticket category with a role:
- The role is ONLY used to give to users when approved
- People with that role CANNOT see the tickets
- Only ticket owner + admins can view tickets

Example:
```
/ticket create title:Role Verification role:@Member

When user opens ticket:
✅ User can see it
✅ Admins can see it
❌ Existing @Members CANNOT see it

When admin approves:
✅ User gets @Member role
```

This prevents privacy issues with verification/application tickets.

## 🚀 Quick Start

### Installation
```bash
# Install dependencies
npm install

# Set your bot token in .env file
DISCORD_TOKEN=your_bot_token_here

# Run the bot
npm start
```

## 📝 Commands

### Administrator Only
- `/ticket panel` - Create ticket panel with specific categories
- `/ticket create` - Create ticket category (role is for approval rewards, not viewing)
- `/ticket list` - View all active tickets
- `/ticket alerts` - Toggle DM notifications when tickets open
- `/ticket categories` - List all available categories (useful before creating panels)
- `/ticket menu` - Show ticket info and approve/deny buttons (in ticket channels)

### Everyone Can Use
- `/ticket close` - Close your own ticket (admins can close any)

## 📖 Usage Examples

### Basic Setup
```
1. Create categories:
   /ticket create title:Support
   /ticket create title:Bug Report
   /ticket create title:Applications role:@Staff

2. Check available categories:
   /ticket categories

3. Create panel with specific categories:
   /ticket panel channel:#tickets title:Support categories:Support,Bug Report
   
4. Create another panel with different categories:
   /ticket panel channel:#applications title:Apply categories:Applications

5. Users click dropdown and select from available options
6. Ticket opens in "Open Tickets" category (only user + admins see it)
7. User or admin closes with /ticket close
```

### Approval System with Privacy
```
1. Create approval category:
   /ticket create title:Role Verification role:@Verified

2. User opens "Role Verification" ticket
   - ONLY user and admins can see it
   - Existing @Verified members CANNOT see it

3. Admin goes to ticket and uses:
   /ticket menu

4. Admin sees ticket info with Approve/Deny buttons
5. Click Approve → User gets @Verified role automatically
   Click Deny → User gets DM, ticket closes
```

## 🎛️ Ticket Menu Features

When an admin uses `/ticket menu` in a ticket:
- **Only visible to you** - Menu appears as ephemeral message (private)
- **Shows**: Who opened it, category, if approval needed
- **Three action buttons**:
  
  1. **✅ Approve button** (if role approval needed): 
     - Automatically gives user the role(s) from category
     - Shows confirmation with which roles were given
     - Admin sees ephemeral feedback
     - If role add fails, shows warning but continues
  
  2. **❌ Deny button** (if role approval needed): 
     - Sends anonymous DM to user
     - Posts public denial message in channel
     - Closes ticket automatically
     - Moves to "Closed Tickets" category
  
  3. **🔒 Close Ticket button** (always available):
     - Quick way to close without typing `/ticket close`
     - Moves to "Closed Tickets" and locks
     - Shows public closing message

Perfect for:
- Staff applications (give @Staff role)
- Verification systems (give @Verified role)
- Partner requests (give @Partner role)
- Any approval-based system with role rewards
- Quick ticket management without commands

## 🔧 Technical Details

- Built with discord.js v14
- SQLite database for persistence
- Auto-creates "Open Tickets" and "Closed Tickets" categories
- Permission system using Discord's default_member_permissions
- Proper error handling with try-catch blocks
- Works with Nixpacks for easy deployment

## 📁 File Structure
```
minestaffs-bot/
├── index.js          # Main bot file
├── package.json      # Dependencies
├── tickets.db        # SQLite database (auto-created)
├── .env              # Token (don't commit!)
├── .gitignore        # Git ignore rules
├── nixpacks.toml     # Deployment config
└── README.md         # This file
```

## 🛡️ DM Safety Features

The bot gracefully handles DM failures:
- **Never crashes** if user has DMs disabled
- **Logs attempts** for debugging
- **Informs admins** when denial DMs fail
- **Continues operation** even if DMs are blocked

Users don't need to enable DMs for the bot to work - they just won't receive notifications if DMs are disabled.

## 🛠️ Troubleshooting

**Commands not showing?**
- Make sure bot has `applications.commands` scope
- Wait a few minutes for Discord to sync
- Restart the bot

**Tickets not creating?**
- Check bot has "Manage Channels" permission
- Ensure bot role is above ticket roles

**Roles not being given on approval?**
- Make sure bot has "Manage Roles" permission
- Bot's role must be ABOVE the role you're trying to give
- Check console for "Failed to give role" errors
- Bot role hierarchy: Server Settings → Roles → Drag bot role higher

**Approve/Deny not working?**
- Make sure category has a role attached
- Use `/ticket create title:Category role:@Role`
- Only categories with roles show approve/deny

**DMs not working?**
- This is normal - bot will continue working
- Check console logs to see who has DMs disabled
- Admins get notified when denial DMs fail
- Users can enable DMs in: Server Settings → Privacy Settings → Allow direct messages

**Privacy concerns?**
- Roles in categories are for giving to users, not viewing access
- Only ticket owner and admins can see tickets
- Existing role holders cannot see verification tickets

**Ticket limit reached?**
- Users can have max 4 tickets per category type
- Close some tickets before opening more in that category
- Different categories have separate limits (4 Support + 4 Applications = 8 total OK)

**Channel deleted but database still has ticket?**
- Bot automatically cleans up orphaned records
- User can create new tickets after cleanup
- Check console logs for "Cleaned up orphaned ticket record" messages

## 🔐 Security

- Never commit `.env` file
- Keep bot token secret
- Use environment variables in production

---

**Managed by overtimehosting** 🚀