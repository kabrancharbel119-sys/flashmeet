import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
  console.warn('Warning: Meta WhatsApp API credentials not fully configured');
}

export const metaConfig = {
  accessToken: META_ACCESS_TOKEN,
  phoneNumberId: META_PHONE_NUMBER_ID,
  verifyToken: META_VERIFY_TOKEN,
  apiUrl: `https://graph.facebook.com/v22.0/${META_PHONE_NUMBER_ID}/messages`,
};

function normalizePhone(phone) {
  let p = phone.replace('+', '').trim();
  
  // Meta envoie : 22589747248 (11 chiffres)
  // Décomposition : 225 + 89747248
  // Format correct : 225 + 0 + 7 + 89747248 = 2250789747248 (13 chiffres)
  // Le 7 du 07 est déjà dans 89747248, il faut juste ajouter le 0
  if (p.startsWith('225') && p.length === 11) {
    // 22589747248 → 225 + 0 + 789747248
    p = p.substring(0, 3) + '0' + p.substring(3);
  }
  
  return '+' + p;
}

export async function sendMetaWhatsAppMessage(to, message) {
  try {
    console.log(`[META API] Original phone:`, to);
    const normalizedPhone = normalizePhone(to);
    console.log(`[META API] Normalized phone:`, normalizedPhone);
    
    const response = await axios.post(
      metaConfig.apiUrl,
      {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          'Authorization': `Bearer ${metaConfig.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`[META API] Message sent successfully to ${normalizedPhone}`);
    return response.data;
  } catch (error) {
    console.error(`[META API] Error sending message to ${to}:`, error.response?.data || error.message);
    throw error;
  }
}
