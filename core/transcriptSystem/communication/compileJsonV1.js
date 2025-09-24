const discord = require('discord.js')

const bot = require("../../../index")
const tsconfig = bot.tsconfig
const tsembeds = require("../embeds")
const tsdb = require("../tsdb")

const otversion = require("../../../package.json").version
const version = require("../info.json").version

/**@typedef {{style:{enableCustomBackground:Boolean, backgroundModus:"color"|"image", backgroundData:String, titleColor:String}, bot:{name:String, id:Number, pfp:String}, ticket:{creatorname:String, creatorid:Number, closedtime:Number, openedtime:Number}}} OThtsDataOption */


/**==========================================================
=============================================================
================THIS FILE ISN'T USED ANYMORE!!===============
            This file is for html transcripts V1! 
       Visit compileJsonV2.js for the current version!
=============================================================
===========================================================*/

/**
 * 
 * @param {discord.Guild} guild 
 * @param {discord.Channel} channel 
 * @param {discord.User} user 
 * @param {discord.Message[]} messagesInv
 * @param {OThtsDataOption} data 
 */
exports.compile = (guild,channel,user,messagesInv,data) => {
    const messages = messagesInv.reverse()
    var invisibleMessages = 0
    
    const rawfiles = messages.filter((m) => Array.from(m.attachments).length > 0)
    var fileAmount = 0
    rawfiles.forEach((msg) => {
        fileAmount = fileAmount + Array.from(msg.attachments).length
    })

    const messagesArray = []
    messages.forEach((msg) => {
        if (msg.content || msg.embeds.length > 0 || msg.attachments.toJSON().length > 0){

            const embedArray = []
            const fileArray = []

            msg.attachments.forEach((file) => {
                fileArray.push({
                    name:file.name,
                    type:file.contentType,
                    size:file.size.toString()+" bytes",
                    url:file.url
                })
            })

            msg.embeds.forEach((embed) => {
                embedArray.push({
                    title:embed.title || false,
                    description:embed.description ? embed.description : false,
                    authorimg:((embed.author && embed.author.iconURL) ? embed.author.iconURL : false),
                    authortext:(embed.author ? embed.author.name : false),
                    footerimg:((embed.footer && embed.footer.iconURL) ? embed.footer.iconURL : false),
                    footertext:(embed.footer ? embed.footer.text : false),
                    color:embed.hexColor,
                    image:((embed.image && embed.image.url) ? embed.image.url : false),
                    thumbnail:((embed.thumbnail && embed.thumbnail.url) ? embed.thumbnail.url : false),
                    url:(embed.url ? embed.url : false)
                })
            })

            const memberColor = msg.member ? msg.member.displayHexColor : "#ffffff"
            messagesArray.push({
                author:{
                    name:msg.author.username,
                    id:Number(msg.author.id),
                    color:memberColor,
                    pfp:msg.author.displayAvatarURL()
                },
                content:msg.content || "",
                timestamp:msg.createdTimestamp,
                embeds:embedArray,
                files:fileArray
            })
        }else {invisibleMessages++}
    })

    const result = {
        version,otversion,
        style:{
            backgroundData:data.style.backgroundData || "",
            backgroundModus:data.style.backgroundModus || "",
            enableCustomBackground:data.style.enableCustomBackground || false,
            titleColor:data.style.titleColor || "#F8BA00"
        },
        bot:{
            name:data.bot.name || "Open Ticket",
            id:Number(data.bot.id) || 0,
            pfp:data.bot.pfp || "transcripts.dj-dj.be/favicon.png"
        },
        ticket:{
            name:channel.name,
            id:Number(channel.id),

            guildname:guild.name,
            guildid:Number(guild.id),

            creatorname:data.ticket.creatorname,
            creatorid:Number(data.ticket.creatorid),
            closedbyname:user.username,
            closedbyid:Number(user.id),

            closedtime:data.ticket.closedtime,
            openedtime:data.ticket.openedtime,
            
            messages:Array.from(messages).length-invisibleMessages,
            files:fileAmount
        },
        messages:messagesArray
    }


    return result
}