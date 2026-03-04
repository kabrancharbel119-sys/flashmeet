import { supabase } from '../config/supabase.js';
import { incrementMatchCount } from './userService.js';

async function hasRecentMatch(user1Id, user2Id) {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('matches')
      .select('id')
      .or(`and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`)
      .gte('created_at', sevenDaysAgo.toISOString())
      .limit(1);

    if (error) throw error;
    return data && data.length > 0;
  } catch (error) {
    console.error('Error in hasRecentMatch:', error);
    return false;
  }
}

function calculateScore(user, candidate) {
  let score = 0;

  if (user.personality_type && candidate.personality_type && user.personality_type === candidate.personality_type) {
    score += 20;
  }

  if (user.evening_style && candidate.evening_style && user.evening_style === candidate.evening_style) {
    score += 20;
  }

  if (user.communication_style && candidate.communication_style && user.communication_style === candidate.communication_style) {
    score += 15;
  }

  if (user.relationship_type && candidate.relationship_type && user.relationship_type === candidate.relationship_type) {
    score += 10;
  }

  if (candidate.last_active) {
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
    const lastActive = new Date(candidate.last_active);
    if (lastActive >= tenMinutesAgo) {
      score += 10;
    }
  }

  if (user.city && candidate.city && user.city.toLowerCase() === candidate.city.toLowerCase()) {
    score += 15;
  }

  if (candidate.is_premium) {
    score += 10;
  }

  return score;
}

export async function findMatch(userId) {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    const now = new Date();
    const currentHour = now.getUTCHours();
    if (currentHour < 20 && currentHour >= 0) {
      console.log(`Service not available at this time (${currentHour}h UTC)`);
      return null;
    }

    if (!user.is_premium && user.matches_today >= 10) {
      console.log(`User ${userId} has reached daily match limit`);
      return null;
    }

    const { data: blockedUsers } = await supabase
      .from('blocks_reports')
      .select('reported_id')
      .eq('reporter_id', userId)
      .eq('type', 'block');

    const blockedIds = blockedUsers ? blockedUsers.map(b => b.reported_id) : [];

    const { data: blockedByUsers } = await supabase
      .from('blocks_reports')
      .select('reporter_id')
      .eq('reported_id', userId)
      .eq('type', 'block');

    const blockedByIds = blockedByUsers ? blockedByUsers.map(b => b.reporter_id) : [];

    const excludedIds = [...blockedIds, ...blockedByIds, userId];

    let query = supabase
      .from('users')
      .select('*')
      .eq('status', 'available')
      .eq('is_verified', true)
      .eq('gender', user.looking_for)
      .eq('looking_for', user.gender)
      .not('id', 'in', `(${excludedIds.join(',')})`);

    if (!user.is_premium) {
      query = query.lte('matches_today', 9);
    }

    const { data: potentialMatches, error: matchError } = await query;

    if (matchError) throw matchError;

    if (!potentialMatches || potentialMatches.length === 0) {
      console.log(`No matches found for user ${userId}`);
      return null;
    }

    const candidatesWithScore = [];

    for (const candidate of potentialMatches) {
      const hasRecent = await hasRecentMatch(userId, candidate.id);
      if (hasRecent) {
        continue;
      }

      if (user.min_age_pref && candidate.age < user.min_age_pref) {
        continue;
      }
      if (user.max_age_pref && candidate.age > user.max_age_pref) {
        continue;
      }

      const score = calculateScore(user, candidate);
      candidatesWithScore.push({ candidate, score });
    }

    if (candidatesWithScore.length === 0) {
      console.log(`No valid candidates after filtering for user ${userId}`);
      return null;
    }

    candidatesWithScore.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const aLastActive = new Date(a.candidate.last_active || 0);
      const bLastActive = new Date(b.candidate.last_active || 0);
      return bLastActive - aLastActive;
    });

    const bestMatch = candidatesWithScore[0].candidate;
    console.log(`Match found for user ${userId}: ${bestMatch.id} with score ${candidatesWithScore[0].score}`);
    return bestMatch;
  } catch (error) {
    console.error('Error in findMatch:', error);
    throw error;
  }
}

export async function createMatch(user1Id, user2Id) {
  try {
    const now = new Date();
    const endsAt = new Date(now.getTime() + 5 * 60 * 1000);

    const { data, error } = await supabase
      .from('matches')
      .insert([
        {
          user1_id: user1Id,
          user2_id: user2Id,
          status: 'pending',
          user1_accepted: false,
          user2_accepted: false,
          started_at: null,
          ends_at: endsAt.toISOString(),
          created_at: now.toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    console.log(`Match created: ${data.id} between users ${user1Id} and ${user2Id}`);
    return data;
  } catch (error) {
    console.error('Error in createMatch:', error);
    throw error;
  }
}

export async function handleMatchResponse(userId, matchId, response) {
  try {
    const { data: match, error: fetchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (fetchError) throw fetchError;

    const isUser1 = match.user1_id === userId;
    const updateField = isUser1 ? 'user1_accepted' : 'user2_accepted';

    await supabase
      .from('matches')
      .update({ [updateField]: response })
      .eq('id', matchId);

    console.log(`User ${userId} responded ${response} to match ${matchId}`);

    const { data: updatedMatch, error: refetchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (refetchError) throw refetchError;

    if (updatedMatch.user1_accepted && updatedMatch.user2_accepted) {
      const now = new Date();
      const endsAt = new Date(now.getTime() + 5 * 60 * 1000);

      await supabase
        .from('matches')
        .update({
          status: 'active',
          started_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
        })
        .eq('id', matchId);

      await supabase
        .from('users')
        .update({ status: 'in_chat' })
        .in('id', [match.user1_id, match.user2_id]);

      await incrementMatchCount(match.user1_id);
      await incrementMatchCount(match.user2_id);

      console.log(`Match ${matchId} is now active`);
      return { status: 'active', match: updatedMatch };
    }

    if (!response) {
      await supabase
        .from('matches')
        .update({ status: 'ended' })
        .eq('id', matchId);

      console.log(`Match ${matchId} rejected by user ${userId}`);
      return { status: 'rejected', match: updatedMatch };
    }

    return { status: 'waiting', match: updatedMatch };
  } catch (error) {
    console.error('Error in handleMatchResponse:', error);
    throw error;
  }
}

export async function getPendingMatch(userId) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'pending')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    console.error('Error in getPendingMatch:', error);
    return null;
  }
}

export async function getActiveMatch(userId) {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'active')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    console.error('Error in getActiveMatch:', error);
    return null;
  }
}

export async function getExpiredMatches() {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'active')
      .lt('ends_at', now);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getExpiredMatches:', error);
    return [];
  }
}
