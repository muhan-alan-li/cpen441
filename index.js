import { 
    Client, 
    GatewayIntentBits, 
    Events, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    GuildScheduledEventPrivacyLevel,
    GuildScheduledEventEntityType,
} from 'discord.js';
import { config } from 'dotenv';

config(); // Load environment variables from .env

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildMembers
  ],
});

// Store user availability for each time slot
let availability = {};
let usersSubmitted = new Set(); // Track users who have clicked submit
let rows = [];

const timeSlots = [
  "𝟶𝟿꞉𝟶𝟶᲼𝙰𝙼᲼᲼",
  "𝟷𝟶꞉𝟶𝟶᲼𝙰𝙼᲼᲼",
  "𝟷𝟷꞉𝟶𝟶᲼𝙰𝙼᲼᲼",
];

const daysOfWeek = [
  "𝙼𝚘𝚗𝚍𝚊𝚢᲼᲼᲼᲼",
  "𝚃𝚞𝚎𝚜𝚍𝚊𝚢᲼᲼᲼",
  "𝚆𝚎𝚍𝚗𝚎𝚜𝚍𝚊𝚢",
  "𝚃𝚑𝚞𝚛𝚜𝚍𝚊𝚢᲼",
  "𝙵𝚛𝚒𝚍𝚊𝚢᲼᲼᲼"
];
    
// Add buttons for days of the week
let currentRow = new ActionRowBuilder();
daysOfWeek.forEach((day, index) => {
  currentRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`available_day_${index}`)
      .setLabel(day)
      .setStyle(ButtonStyle.Primary)
  );
});
rows.push(currentRow);

// Add buttons for time slots
timeSlots.forEach((timeSlot, index) => {
  const timeRow = new ActionRowBuilder();
  for (let i = 0; i < 5; i++) {
    let timeSlotWithPadding = timeSlot
    if (i == 1) {
      timeSlotWithPadding += "᲼"
    }
    timeRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`available_${index}_${i}`)
        .setLabel(timeSlotWithPadding)
        .setStyle(ButtonStyle.Secondary)
    );
  }
  rows.push(timeRow);
});

const submitRow = new ActionRowBuilder();
submitRow.addComponents(
  new ButtonBuilder()
    .setCustomId(`submit`)
    .setLabel("𝑆𝑈𝐵𝑀𝐼𝑇")
    .setStyle(ButtonStyle.Secondary)
);
rows.push(submitRow)

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    // Get the first guild the bot is a part of
    const guild = client.guilds.cache.first();
    
    if (!guild) {
      console.log('Bot is not part of any guild.');
      return;
    }

    console.log(`Bot is in the guild: ${guild.name} (ID: ${guild.id})`);

    const allUsers = await guild.members.fetch(); // Fetch all members in the guild
    
    // Initialize availability for non-bot users
    allUsers.forEach((member) => {
      if (!member.user.bot) { // Ensure we're only adding non-bot users
        availability[member.user.username] = [new Set(), new Set(), new Set(), new Set(), new Set()];
      }
    });
  } catch (error) {
    console.error('Error fetching members:', error);
  }
})



client.on('messageCreate', async (message) => {
  if (message.content === '!s') {
    // Send the message with the grid of buttons
    await message.reply({
      content: "Select your available time slots:",
      components: rows,
    });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const user = interaction.user;

  // Modify the button color for the user who clicked it
  if (interaction.customId.includes('available_')) {
    const chosenTimeIndex = parseInt(interaction.customId.split('_')[1])
    const chosenDayIndex = parseInt(interaction.customId.split('_')[2])
    availability[user.username][chosenDayIndex].add(chosenTimeIndex);
    
    const rowsCopy = JSON.parse(JSON.stringify(rows));
    for (let x = 0; x < daysOfWeek.length; x++) { 
      availability[user.username][x].forEach((_, y) => {
        let chosenTime = timeSlots[y];
        if (x == 1) {
          chosenTime += "᲼"
        }
        rowsCopy[y + 1].components[x] = new ButtonBuilder()
            .setCustomId(`available_${x}_${y}`)
            .setLabel(chosenTime)
            .setStyle(ButtonStyle.Success);
      })
    }
    
    // Edit the message with the updated button rows
    await interaction.update({
      components: rowsCopy,
      ephemeral: true, //TODO: Not sure if need this
    });
  }

  // Check if the user clicked the 'Submit' button
  if (interaction.customId === 'submit') {
    usersSubmitted.add(user.username); // Track user submission

    // Fetch all members of the guild (excluding bots)
    const allUsers = await interaction.guild.members.fetch();
    const totalUsers = allUsers.filter(member => !member.user.bot).size;

    // Check if all non-bot users have submitted their availability
    if (usersSubmitted.size === totalUsers) {
      // All users have submitted, now calculate the best time slots
      let availableTimes = [];

      // Iterate over all time slots and find common availability
      timeSlots.forEach((timeSlot, timeIndex) => {
        let availableCount = 0;
        for (let user in availability) {
          if (availability[user].some(day => day.has(timeIndex))) {
            availableCount++;
          }
        }
        // If every user has selected this time slot, add it to the availableTimes
        if (availableCount === totalUsers) {
          availableTimes.push(timeSlot); // Add to the list if all users are available at this time
        }
      });

      // Send out the best available times
      if (availableTimes.length > 0) {
        await interaction.channel.send(`The best times for everyone to meet are: ${availableTimes.join(', ')}`);
      } else {
        await interaction.channel.send("No common time slots found. Please try again later.");
      }

      // Reset after calculating
      availability = {}; // Clear availability data
      usersSubmitted.clear(); // Reset submitted users
    } else {
      await interaction.reply({ content: `Thank you for submitting, ${user.username}! Waiting for others to submit...`, ephemeral: true });
    }
  }
});

// Command to display the availability grid
client.on('messageCreate', async (message) => {
  if (message.content === '!showSchedule') {
    let schedule = 'Availability Schedule:\n';

    timeSlots.forEach((timeSlot) => {
      schedule += `${timeSlot}: ${availability[timeSlot] ? availability[timeSlot].join(', ') : 'No one'}\n`;
    });

    await message.reply(schedule);
  }
});

// Command to create event
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!e')) {
        // Ask the user for the event duration
        const reply = await message.reply('How many hours will the event last? Please enter an integer.');

        // Create a message collector to wait for the user's response
        const filter = (response) => response.author.id === message.author.id && !isNaN(response.content);
        const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

        collector.on('collect', async (collectedMessage) => {
            const duration = parseInt(collectedMessage.content);

            if (duration <= 0) {
                return message.channel.send('Invalid duration. Please enter a positive integer.');
            }

            const bestTimes = findBestAvailability(duration); // Replace with your function to find best time slots

            // Create buttons for the top 3 available times
            const buttons = bestTimes.map((time, index) => 
                new ButtonBuilder()
                    .setCustomId(`event_time_${index}`)
                    .setLabel(time)
                    .setStyle(ButtonStyle.Primary)
            );

            const row = new ActionRowBuilder().addComponents(buttons);

            const selectionMessage = await message.channel.send({
                content: `Top 3 best time slots for a ${duration}-hour event. Choose one:`,
                components: [row]
            });

            // Create an interaction collector to listen for button clicks
            const interactionFilter = (interaction) => interaction.user.id === message.author.id;
            const interactionCollector = selectionMessage.createMessageComponentCollector({ filter: interactionFilter, time: 30000 });

            interactionCollector.on('collect', async (interaction) => {
                const selectedIndex = parseInt(interaction.customId.split('_')[2]); // Extract index from button ID
                const selectedTime = bestTimes[selectedIndex];

                await interaction.update({ content: `✅ You selected: **${selectedTime}**. Creating event...`, components: [] });

                createDiscordEvent(message.guild, selectedTime);
            });

            interactionCollector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    selectionMessage.edit({ content: '⏳ You took too long to respond. Please try again.', components: [] });
                }
            });
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                message.channel.send('You took too long to respond. Please try again.');
            }
        });
    }
});

const findBestAvailability = (duration) => {
    let scores = {}; // Store how many users are available for each start time
    
    // Iterate over time slots and calculate available users for each duration window
    for (let i = 0; i < timeSlots.length - (duration - 1); i++) {
        let startSlot = timeSlots[i];
        let count = 0;
        
        for (let user in availability) {
        let userAvailable = true;
        
        // Check if user is available for the entire duration
        for (let j = 0; j < duration; j++) {
            if (!availability[user].includes(timeSlots[i + j])) {
            userAvailable = false;
            break;
            }
        }
        
        if (userAvailable) count++;
        }
        
        scores[startSlot] = count;
    }

    // Sort time slots by the number of available users (descending)
    let sortedTimes = Object.entries(scores)
        .sort((a, b) => b[1] - a[1]) // Sort by user count
        .slice(0, 3) // Take the top 3
        .map(entry => `${entry[0]} - ${entry[1]} users available`);

    return sortedTimes;
}

const createDiscordEvent = async (guild, eventTime) => {
    const startTime = new Date(); // Replace this with actual parsed time from eventTime
    startTime.setMinutes(0, 0, 0); // Example: Round to the nearest hour

    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + 1); // 1-hour event duration (adjust as needed)

    try {
        const event = await guild.scheduledEvents.create({
            name: `📅 Community Event - ${eventTime}`,
            scheduledStartTime: startTime.toISOString(),
            scheduledEndTime: endTime.toISOString(),
            privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
            entityType: GuildScheduledEventEntityType.Voice,
            description: `An event scheduled at ${eventTime}. Be sure to join!`,
            channel: guild.channels.cache.find(c => c.type === 2), // Select a voice channel
        });

        guild.systemChannel.send(`📢 **New Event Created!**\n📅 **${event.name}**\n🕒 **Time:** ${eventTime}\n🔗 [Join Event](${event.url})`);
    } catch (error) {
        console.error('Error creating event:', error);
    }
};

client.login(process.env.TOKEN);
