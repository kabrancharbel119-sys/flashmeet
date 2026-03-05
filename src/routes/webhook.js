import express from 'express';
import { supabase } from '../config/supabase.js';
import { metaConfig } from '../config/meta.js';
import { 
  createOrGetUser, 
  getUserByPhone, 
  updateUserStatus, 
  onboardingFlow 
} from '../services/userService.js';
import { 
  findMatch, 
  createMatch, 
  handleMatchResponse, 
  getPendingMatch, 
  getActiveMatch 
} from '../services/matchingService.js';
import { 
  sendWhatsAppMessage, 
  relayMessage, 
  handleFinalChoice, 
  getLastEndedMatch, 
  hasUserMadeFinalChoice,
  endChat
} from '../services/chatService.js';

const router = express.Router();

function isServiceOpen() {
  const now = new Date();
  const utcHours = now.getUTCHours();
  return utcHours >= 20 || utcHours < 0;
}

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === metaConfig.verifyToken) {
    console.log('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('Webhook verification failed');
    res.sendStatus(403);
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (!body.entry || !body.entry[0]?.changes || !body.entry[0].changes[0]?.value?.messages) {
      return res.sendStatus(200);
    }

    const message = body.entry[0].changes[0].value.messages[0];
    const from = message.from;
    const messageText = message.text?.body;

    if (!messageText || !from) {
      return res.sendStatus(200);
    }

    console.log(`[META WEBHOOK] Raw 'from' received:`, from);
    console.log(`[META WEBHOOK] Message: ${messageText}`);

    const phone = from.startsWith('+') ? from : `+${from}`;
    const messageLower = messageText.trim().toLowerCase();

    let user = await createOrGetUser(phone);

    if (!user.is_verified) {
      const response = await onboardingFlow(phone, messageText);
      await sendWhatsAppMessage(phone, response);
      return res.status(200).send('OK');
    }

    if (messageLower === 'start') {
      if (!isServiceOpen()) {
        await sendWhatsAppMessage(
          phone,
          "Le service est disponible de 20h à minuit (heure d'Afrique de l'Ouest). Tu recevras une notification à l'ouverture 🕗"
        );
        return res.status(200).send('OK');
      }

      user = await getUserByPhone(phone);

      if (user.status === 'in_chat') {
        await sendWhatsAppMessage(phone, "Tu es déjà en conversation ! Termine d'abord ton chat en cours.");
        return res.status(200).send('OK');
      }

      const pendingMatch = await getPendingMatch(user.id);
      if (pendingMatch) {
        await sendWhatsAppMessage(phone, "Tu as déjà une proposition de match en attente ! Réponds OUI ou NON.");
        return res.status(200).send('OK');
      }

      if (!user.is_premium && user.matches_today >= 10) {
        await sendWhatsAppMessage(
          phone,
          "Tu as atteint ta limite de 10 matchs aujourd'hui ! 😊\n\nReviens demain ou passe Premium pour des matchs illimités."
        );
        return res.status(200).send('OK');
      }

      await updateUserStatus(phone, 'available');

      const match = await findMatch(user.id);

      if (!match) {
        await sendWhatsAppMessage(
          phone,
          "Aucun match disponible pour le moment 😔\n\nRéessaye dans quelques minutes !"
        );
        return res.status(200).send('OK');
      }

      const newMatch = await createMatch(user.id, match.id);

      await sendWhatsAppMessage(
        phone,
        "✨ Match trouvé ! Acceptes-tu de discuter 5 minutes ?\n\nRéponds OUI ou NON"
      );

      await sendWhatsAppMessage(
        match.phone,
        "✨ Match trouvé ! Acceptes-tu de discuter 5 minutes ?\n\nRéponds OUI ou NON"
      );

      console.log(`Match proposal sent to users ${user.id} and ${match.id}`);
      return res.status(200).send('OK');
    }

    if (messageLower === 'oui' || messageLower === 'non') {
      const pendingMatch = await getPendingMatch(user.id);
      
      if (pendingMatch) {
        const accepted = messageLower === 'oui';
        const result = await handleMatchResponse(user.id, pendingMatch.id, accepted);

        if (result.status === 'active') {
          const otherUserId = pendingMatch.user1_id === user.id ? pendingMatch.user2_id : pendingMatch.user1_id;
          const { data: otherUser } = await supabase
            .from('users')
            .select('phone')
            .eq('id', otherUserId)
            .single();

          await sendWhatsAppMessage(
            phone,
            "🎉 C'est parti ! Tu as 5 minutes pour discuter. Bonne chance 😊\n\n(Tape STOP pour terminer)"
          );

          if (otherUser) {
            await sendWhatsAppMessage(
              otherUser.phone,
              "🎉 C'est parti ! Tu as 5 minutes pour discuter. Bonne chance 😊\n\n(Tape STOP pour terminer)"
            );
          }
        } else if (result.status === 'rejected') {
          await sendWhatsAppMessage(phone, "Match annulé. Envoie START pour trouver quelqu'un d'autre !");
          await updateUserStatus(phone, 'available');
        } else if (result.status === 'waiting') {
          await sendWhatsAppMessage(phone, "Merci ! En attente de la réponse de l'autre personne... ⏳");
        }

        return res.status(200).send('OK');
      }

      const lastEndedMatch = await getLastEndedMatch(user.id);
      
      if (lastEndedMatch) {
        const alreadyChosen = await hasUserMadeFinalChoice(user.id, lastEndedMatch.id);
        
        if (!alreadyChosen) {
          const choice = messageLower === 'oui';
          const result = await handleFinalChoice(user.id, lastEndedMatch.id, choice);

          if (result.status === 'waiting_for_other') {
            await sendWhatsAppMessage(phone, "Merci pour ta réponse ! En attente de l'autre personne... ⏳");
          } else if (result.status === 'already_chosen') {
            await sendWhatsAppMessage(phone, "Tu as déjà fait ton choix pour ce match !");
          }

          return res.status(200).send('OK');
        }
      }
    }

    if (messageLower === 'stop') {
      const activeMatch = await getActiveMatch(user.id);
      
      if (activeMatch) {
        await endChat(activeMatch.id);
        return res.status(200).send('OK');
      } else {
        await sendWhatsAppMessage(phone, "Tu n'es pas en conversation actuellement.");
        return res.status(200).send('OK');
      }
    }

    if (user.status === 'in_chat') {
      const activeMatch = await getActiveMatch(user.id);
      
      if (activeMatch) {
        await relayMessage(user.id, messageText.trim());
      } else {
        await sendWhatsAppMessage(phone, "Ta conversation est terminée. Envoie START pour un nouveau match !");
        await updateUserStatus(phone, 'available');
      }
      
      return res.status(200).send('OK');
    }

    if (!isServiceOpen()) {
      await sendWhatsAppMessage(
        phone,
        "Le service est disponible de 20h à minuit (heure d'Afrique de l'Ouest). Tu recevras une notification à l'ouverture 🕗"
      );
      return res.status(200).send('OK');
    }

    await sendWhatsAppMessage(
      phone,
      "Envoie START pour trouver un match ! ✨"
    );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error in webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
