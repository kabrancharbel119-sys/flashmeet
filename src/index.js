import express from 'express';
import cron from 'node-cron';
import dotenv from 'dotenv';
import webhookRouter from './routes/webhook.js';
import { getExpiredMatches } from './services/matchingService.js';
import { endChat, sendWhatsAppMessage } from './services/chatService.js';
import { resetDailyMatches, setAllUsersOffline, getActiveUsers } from './services/userService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/webhook', webhookRouter);

app.get('/', (req, res) => {
  res.send('FlashMeet Backend is running! 🚀');
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'FlashMeet Backend'
  });
});

cron.schedule('* * * * *', async () => {
  try {
    console.log('Checking for expired matches...');
    const expiredMatches = await getExpiredMatches();
    
    for (const match of expiredMatches) {
      console.log(`Ending expired match: ${match.id}`);
      await endChat(match.id);
    }
    
    if (expiredMatches.length > 0) {
      console.log(`Ended ${expiredMatches.length} expired match(es)`);
    }
  } catch (error) {
    console.error('Error in expired matches cron job:', error);
  }
});

cron.schedule('55 19 * * *', async () => {
  try {
    console.log('Sending service opening notifications...');
    const activeUsers = await getActiveUsers();
    
    const notificationMessage = "🔔 Le service FlashMeet ouvre dans 5 minutes ! Prépare-toi à rencontrer de nouvelles personnes 😊";
    
    for (const user of activeUsers) {
      try {
        await sendWhatsAppMessage(user.phone, notificationMessage);
      } catch (error) {
        console.error(`Failed to send notification to ${user.phone}:`, error);
      }
    }
    
    console.log(`Sent opening notifications to ${activeUsers.length} user(s)`);
  } catch (error) {
    console.error('Error in opening notification cron job:', error);
  }
}, {
  timezone: "Africa/Abidjan"
});

cron.schedule('0 0 * * *', async () => {
  try {
    console.log('Running midnight reset...');
    
    await setAllUsersOffline();
    console.log('All users set to offline');
    
    await resetDailyMatches();
    console.log('Daily match counts reset');
    
    console.log('Midnight reset completed successfully');
  } catch (error) {
    console.error('Error in midnight reset cron job:', error);
  }
}, {
  timezone: "Africa/Abidjan"
});

app.listen(PORT, () => {
  console.log(`🚀 FlashMeet Backend running on port ${PORT}`);
  console.log(`📱 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`⏰ Service hours: 20:00 - 00:00 (UTC+0)`);
  console.log(`✅ Cron jobs initialized:`);
  console.log(`   - Expired matches check: Every minute`);
  console.log(`   - Opening notification: Daily at 19:55`);
  console.log(`   - Midnight reset: Daily at 00:00`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down FlashMeet Backend...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down FlashMeet Backend...');
  process.exit(0);
});

export default app;
