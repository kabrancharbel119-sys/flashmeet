import { supabase } from '../config/supabase.js';
import { sendMetaWhatsAppMessage } from '../config/meta.js';

export async function sendWhatsAppMessage(to, message) {
  return await sendMetaWhatsAppMessage(to, message);
}

export async function relayMessage(senderId, message) {
  try {
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'active')
      .or(`user1_id.eq.${senderId},user2_id.eq.${senderId}`)
      .single();

    if (matchError || !match) {
      console.log(`No active match found for user ${senderId}`);
      return false;
    }

    const recipientId = match.user1_id === senderId ? match.user2_id : match.user1_id;

    const { data: recipient, error: recipientError } = await supabase
      .from('users')
      .select('phone')
      .eq('id', recipientId)
      .single();

    if (recipientError) throw recipientError;

    await sendWhatsAppMessage(recipient.phone, message);
    console.log(`Message relayed from user ${senderId} to user ${recipientId}`);
    return true;
  } catch (error) {
    console.error('Error in relayMessage:', error);
    throw error;
  }
}

export async function endChat(matchId) {
  try {
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError) throw matchError;

    await supabase
      .from('matches')
      .update({ status: 'ended' })
      .eq('id', matchId);

    await supabase
      .from('users')
      .update({ status: 'available' })
      .in('id', [match.user1_id, match.user2_id]);

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('phone')
      .in('id', [match.user1_id, match.user2_id]);

    if (usersError) throw usersError;

    const endMessage = `⏱ Temps écoulé ! Tu as apprécié cette conversation ?\n\nRéponds OUI pour échanger vos contacts ou NON pour passer à autre chose.`;

    for (const user of users) {
      await sendWhatsAppMessage(user.phone, endMessage);
    }

    console.log(`Chat ended for match ${matchId}`);
    return true;
  } catch (error) {
    console.error('Error in endChat:', error);
    throw error;
  }
}

export async function handleFinalChoice(userId, matchId, choice) {
  try {
    const { data: existingChoice, error: checkError } = await supabase
      .from('final_choices')
      .select('*')
      .eq('match_id', matchId)
      .eq('user_id', userId)
      .single();

    if (existingChoice) {
      console.log(`User ${userId} already made a choice for match ${matchId}`);
      return { status: 'already_chosen' };
    }

    const { error: insertError } = await supabase
      .from('final_choices')
      .insert([
        {
          match_id: matchId,
          user_id: userId,
          chosen: choice,
          created_at: new Date().toISOString(),
        },
      ]);

    if (insertError) throw insertError;

    console.log(`User ${userId} chose ${choice} for match ${matchId}`);

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError) throw matchError;

    const { data: allChoices, error: choicesError } = await supabase
      .from('final_choices')
      .select('*')
      .eq('match_id', matchId);

    if (choicesError) throw choicesError;

    if (allChoices.length === 2) {
      const bothChoseYes = allChoices.every(c => c.chosen === true);

      if (bothChoseYes) {
        await supabase
          .from('matches')
          .update({ status: 'opted_in' })
          .eq('id', matchId);

        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('*')
          .in('id', [match.user1_id, match.user2_id]);

        if (usersError) throw usersError;

        for (const user of users) {
          const otherUser = users.find(u => u.id !== user.id);
          const revealMessage = `🎉 Coup de coeur mutuel !\n\nVoici son numéro : ${otherUser.phone}\n\nBonne continuation ! 💕`;
          await sendWhatsAppMessage(user.phone, revealMessage);
        }

        console.log(`Double opt-in for match ${matchId} - contacts revealed`);
        return { status: 'double_opt_in' };
      } else {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('phone')
          .in('id', [match.user1_id, match.user2_id]);

        if (usersError) throw usersError;

        const noMatchMessage = `Pas de match cette fois-ci ! 😊\n\nEnvoie START pour trouver une nouvelle personne.`;

        for (const user of users) {
          await sendWhatsAppMessage(user.phone, noMatchMessage);
        }

        console.log(`No mutual interest for match ${matchId}`);
        return { status: 'no_mutual_interest' };
      }
    }

    return { status: 'waiting_for_other' };
  } catch (error) {
    console.error('Error in handleFinalChoice:', error);
    throw error;
  }
}

export async function getLastEndedMatch(userId) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'ended')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    console.error('Error in getLastEndedMatch:', error);
    return null;
  }
}

export async function hasUserMadeFinalChoice(userId, matchId) {
  try {
    const { data, error } = await supabase
      .from('final_choices')
      .select('*')
      .eq('match_id', matchId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data !== null;
  } catch (error) {
    console.error('Error in hasUserMadeFinalChoice:', error);
    return false;
  }
}
