import express from 'express';
import { supabase } from '../config/supabase.js';
import { sendWhatsAppMessage } from '../services/chatService.js';
import { createOrGetUser } from '../services/userService.js';

const router = express.Router();

router.post('/join', async (req, res) => {
  try {
    const { name, phone, city } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Prénom et numéro de téléphone requis' 
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
        success: true, 
        message: 'Tu es déjà inscrit ! Vérifie tes messages WhatsApp.' 
      });
    }

    const { data: waitlistEntry, error: waitlistError } = await supabase
      .from('waitlist')
      .insert([
        {
          name: name.trim(),
          phone: formattedPhone,
          city: city ? city.trim() : null,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (waitlistError) throw waitlistError;

    const user = await createOrGetUser(formattedPhone);

    const welcomeMessage = `Salut ${name} ! 👋\n\nBienvenue sur FlashMeet, le speed dating sur WhatsApp.\n\nPour créer ton profil, réponds à quelques questions rapides.\n\nTu es : HOMME ou FEMME ?`;

    await sendWhatsAppMessage(formattedPhone, welcomeMessage);

    console.log(`Waitlist entry created for ${formattedPhone} and onboarding started`);

    return res.status(200).json({ 
      success: true, 
      message: `Inscription réussie ! 🎉\n\nVérifie WhatsApp au ${formattedPhone} pour compléter ton profil.` 
    });

  } catch (error) {
    console.error('Error in waitlist join:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Une erreur est survenue. Réessaye plus tard.' 
    });
  }
});

export default router;
