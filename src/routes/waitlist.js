import express from 'express';
import { supabase } from '../config/supabase.js';
import { sendMetaWhatsAppMessage } from '../config/meta.js';

const router = express.Router();

function isWithinServiceHours() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  return utcHour >= 20 && utcHour < 24;
}

router.post('/', async (req, res) => {
  try {
    const { prenom, phone, ville } = req.body;

    if (!prenom || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Prénom et numéro de téléphone requis' 
      });
    }

    const formattedPhone = phone.trim().startsWith('+') ? phone.trim() : `+${phone.trim()}`;

    const { data: existingWaitlist, error: checkError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('phone', formattedPhone)
      .single();

    if (existingWaitlist) {
      return res.status(200).json({ 
        success: true
      });
    }

    const { data: waitlistEntry, error: waitlistError } = await supabase
      .from('waitlist')
      .insert([
        {
          prenom: prenom.trim(),
          phone: formattedPhone,
          ville: ville ? ville.trim() : null
        }
      ])
      .select()
      .single();

    if (waitlistError) throw waitlistError;

    if (isWithinServiceHours()) {
      const welcomeMessage = `Bienvenue sur FlashMeet ${prenom} ! 🎉\nLe service est ouvert maintenant jusqu'à minuit.\nEnvoie START pour trouver ton premier match ! ✨`;
      
      try {
        await sendMetaWhatsAppMessage(formattedPhone, welcomeMessage);
        console.log(`Waitlist entry created for ${formattedPhone} and welcome message sent`);
      } catch (whatsappError) {
        console.error('Error sending WhatsApp message:', whatsappError);
      }
    } else {
      console.log(`Waitlist entry created for ${formattedPhone} (outside service hours, no message sent)`);
    }

    return res.status(200).json({ 
      success: true
    });

  } catch (error) {
    console.error('Error in waitlist endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Une erreur est survenue. Réessaye plus tard.' 
    });
  }
});

export default router;
