# 🎫 MineStaffs Ticket Bot

A feature-rich Discord ticket bot with approval system, categories, and admin controls.

## ✨ Features

- 🎯 **Dropdown ticket panels** - Easy ticket selection
- 🔐 **Role-based permissions** - Add staff roles to ticket categories
- 📩 **DM alerts** - Get notified when tickets are opened
- 🎨 **Clean white embeds** - Professional look with custom branding
- 🔒 **User-friendly closing** - `/ticket close` command for everyone
- 🎛️ **Admin ticket menu** - Review and approve/deny tickets
- 📁 **Auto categories** - "Open Tickets" and "Closed Tickets"
- ✅ **Approval system** - Approve or deny tickets with role requirements
- 🚫 **Duplicate prevention** - One ticket per user at a time
- 💾 **SQLite database** - Persistent data storage

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
- `/ticket panel` - Create ticket panel with dropdown
- `/ticket create` - Create ticket category (with optional role for approvals)
- `/ticket list` - View all active tickets
- `/ticket alerts` - Toggle DM notifications when tickets open
- `/ticket menu` - Show ticket info and approve/deny buttons (in ticket channels)

### Everyone Can Use
- `/ticket close` - Close your own ticket (admins can close any)

## 📖 Usage Examples

### Basic Setup
```
1. Create categories:
   /ticket create title:Support role:@Staff

2. Create panel:
   /ticket panel channel:#tickets title:Support description:Need help? Open a ticket!

3. Users click dropdown and select ticket type
4. Ticket opens in "Open Tickets" category
5. User or admin closes with /ticket close
```

### Approval System
```
1. Create approval category:
   /ticket create title:Staff Application role:@Management

2. User opens "Staff Application" ticket
3. Admin goes to ticket and uses:
   /ticket menu

4. Admin sees ticket info with Approve/Deny buttons
5. Click Approve → User gets @Management role, success message shown
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
└── CHANGELOG.md      # Update history
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

## 🔐 Security

- Never commit `.env` file
- Keep bot token secret
- Use environment variables in production

---

**Managed by overtimehosting** 🚀