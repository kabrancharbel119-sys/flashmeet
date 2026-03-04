import { supabase } from '../config/supabase.js';

export async function createOrGetUser(phone) {
  try {
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (existingUser) {
      console.log(`User found: ${phone}`);
      return existingUser;
    }

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          phone,
          status: 'offline',
          is_verified: false,
          is_premium: false,
          matches_today: 0,
          last_active: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (createError) throw createError;

    console.log(`New user created: ${phone}`);
    return newUser;
  } catch (error) {
    console.error('Error in createOrGetUser:', error);
    throw error;
  }
}

export async function getUserByPhone(phone) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in getUserByPhone:', error);
    return null;
  }
}

export async function updateUserStatus(phone, status) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ 
        status,
        last_active: new Date().toISOString()
      })
      .eq('phone', phone)
      .select()
      .single();

    if (error) throw error;
    console.log(`User ${phone} status updated to: ${status}`);
    return data;
  } catch (error) {
    console.error('Error in updateUserStatus:', error);
    throw error;
  }
}

export async function onboardingFlow(phone, message) {
  try {
    const user = await getUserByPhone(phone);
    
    if (!user) {
      return "Une erreur s'est produite. Réessaye en envoyant 'START'.";
    }

    if (!user.gender) {
      if (message.toLowerCase() === 'homme' || message.toLowerCase() === 'femme') {
        await supabase
          .from('users')
          .update({ gender: message.toLowerCase() })
          .eq('phone', phone);
        
        console.log(`User ${phone} set gender: ${message.toLowerCase()}`);
        return "Super ! 👍\n\nTu recherches : HOMME ou FEMME ?";
      } else {
        return "Bienvenue sur FlashMeet ! 👋 Le speed dating sur WhatsApp.\n\nPour commencer, tu es : HOMME ou FEMME ?";
      }
    }

    if (!user.looking_for) {
      if (message.toLowerCase() === 'homme' || message.toLowerCase() === 'femme') {
        await supabase
          .from('users')
          .update({ looking_for: message.toLowerCase() })
          .eq('phone', phone);
        
        console.log(`User ${phone} set looking_for: ${message.toLowerCase()}`);
        return "Parfait ! 😊\n\nQuel est ton âge ? (Entre 18 et 99)";
      } else {
        return "Réponds HOMME ou FEMME s'il te plaît.";
      }
    }

    if (!user.age) {
      const age = parseInt(message);
      if (isNaN(age) || age < 18 || age > 99) {
        return "Entre un âge valide entre 18 et 99 ans.";
      }
      
      await supabase
        .from('users')
        .update({ age })
        .eq('phone', phone);
      
      console.log(`User ${phone} set age: ${age}`);
      return "Merci ! 🌍\n\nDans quelle ville es-tu ? (Ex: Dakar, Abidjan, Lomé...)";
    }

    if (!user.city) {
      if (message.trim().length < 2) {
        return "Entre le nom de ta ville s'il te plaît.";
      }
      
      await supabase
        .from('users')
        .update({ 
          city: message.trim(),
          is_verified: true,
          status: 'available'
        })
        .eq('phone', phone);
      
      console.log(`User ${phone} completed onboarding. City: ${message.trim()}`);
      return `🎉 Profil créé avec succès !\n\nTu peux maintenant trouver des matchs. Le service est ouvert de 20h à minuit.\n\nEnvoie START pour lancer ta première rencontre ! ✨`;
    }

    return "Profil déjà complété ! Envoie START pour trouver un match.";
  } catch (error) {
    console.error('Error in onboardingFlow:', error);
    return "Une erreur s'est produite. Réessaye plus tard.";
  }
}

export async function incrementMatchCount(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('matches_today')
      .eq('id', userId)
      .single();

    if (error) throw error;

    await supabase
      .from('users')
      .update({ matches_today: (data.matches_today || 0) + 1 })
      .eq('id', userId);

    console.log(`User ${userId} match count incremented to ${(data.matches_today || 0) + 1}`);
  } catch (error) {
    console.error('Error in incrementMatchCount:', error);
    throw error;
  }
}

export async function resetDailyMatches() {
  try {
    const { error } = await supabase
      .from('users')
      .update({ matches_today: 0 })
      .neq('id', 0);

    if (error) throw error;
    console.log('Daily match counts reset for all users');
  } catch (error) {
    console.error('Error in resetDailyMatches:', error);
    throw error;
  }
}

export async function setAllUsersOffline() {
  try {
    const { error } = await supabase
      .from('users')
      .update({ status: 'offline' })
      .neq('id', 0);

    if (error) throw error;
    console.log('All users set to offline');
  } catch (error) {
    console.error('Error in setAllUsersOffline:', error);
    throw error;
  }
}

export async function getActiveUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('phone')
      .neq('status', 'offline');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getActiveUsers:', error);
    return [];
  }
}
